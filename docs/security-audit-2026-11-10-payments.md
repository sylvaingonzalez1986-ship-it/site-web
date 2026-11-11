# Payment and commercial reward audit — 2026-11-10

Scope: source review plus isolated offline tests of checkout, Viva verification, payment/order transitions, inventory, commercial reward consumption and invoice access. No application, configuration, migration or dependency changes; no real payment, refund, email, provider request or production database access. Existing dirty work was preserved. Installed Next 16.4.1 route-handler and Vitest guides were read before adding tests.

## Findings

### PAY-01 — Medium — Confirmed: administrative archive leaves a payable Viva session unreconcilable

- Evidence: `src/app/api/admin/orders/[orderId]/route.ts:150-161` checks only the local incomplete status and archives immediately. It never invokes provider cancellation. `supabase/migrations/20260313170000_archive_incomplete_orders.sql:80-113` releases claims/promos and sets `archived_at`. The current finalizer, `supabase/migrations/20261108000800_viva_payment_monotonicity.sql:99-105`, deliberately excludes archived rows. `src/app/api/checkout/viva/webhook/route.ts:257-258,302-305` consequently returns 503 instead of recording a subsequent verified successful payment.
- Preconditions/flow: an administrator archives an order while the customer still has its unexpired Viva URL, or while a successful payment has not yet reached the webhook. The customer can finish payment but local accounting/fulfillment cannot reconcile it through the normal callback. Actual provider behavior and deployment timing were not exercised.
- Existing control: the customer cancellation endpoint correctly calls Viva before archive (`src/app/api/account/orders/[orderId]/cancel-pending-payment/route.ts:73-79`); DB row locks prevent archive after a locally recorded success. These do not cover an active external session or callback delay.
- Minimal fix: route administrative archival through confirmed provider cancellation; keep durable reconciliation for externally paid archived/cancelled orders and mark them for review. Do not simply discard verified captures.
- Test: `src/test/security-audit/payments-admin-boundaries.test.ts` reproduces successful administrative archive with no provider cancellation; the existing SQL payment suite independently verifies archived orders are excluded. Add a cancellation/success race test covering success before local webhook delivery.

### PAY-02 — Medium — Confirmed: manual paid transition commits before inventory validation

- Evidence: `src/lib/supabase/order-backend.ts:578-603` reads state, commits `.update({payment_state,status})`, then calls inventory in a separate RPC. A stock failure throws after the paid update without setting `payment_review_required`. The API masks this as 400 `Payload invalide` (`src/app/api/admin/orders/[orderId]/route.ts:70-83,129-130`). Deferred commercial reward triggers execute at the earlier update's commit: `supabase/migrations/20260927000500_kq_order_cash_rewards.sql:48-55,100-117`; contest reward gates likewise accept paid/review=false.
- Preconditions/flow: an administrator manually marks an unpaid order paid when stock is exhausted, or inventory RPC fails. State remains paid/review=false while stock is unapplied. Eligible game rewards can already be issued before inventory failure. The state split is reproduced; actual game reward issuance on this exact route was established by trigger inspection, not an integrated live DB test.
- Related boundary: manual payment updates use no row lock/CAS and permit regressions, while status/tracking writes are separate (`src/lib/supabase/order-backend.ts:554-568`). Therefore the otherwise strong webhook monotonicity does not extend to manual admin corrections or prevent processing/shipping an unpaid/review order.
- Minimal fix: implement explicit validated admin transitions in one row-locked DB operation; run inventory and final review decision before the transaction commits. Require a separate controlled correction/refund path for paid regressions; check payment/review state before fulfillment.
- Test: `payments-admin-boundaries.test.ts` calls the production adapter with a mocked committed DB update and inventory failure and asserts the observed paid/review=false state. Add DB integration tests for inventory failure, concurrent webhook/admin changes and fulfillment of unpaid/review orders.

### PAY-03 — Medium — Confirmed: omitting the variant ID bypasses variant availability and inventory

- Evidence: `src/app/api/checkout/viva/route.ts:170-187` only validates enabled/inStock when a variant suffix was supplied and otherwise uses base price. `src/lib/product-stock.ts:88-97` silently checks the first variant's quantity, but `src/app/api/checkout/viva/route.ts:240-241` persists the bare product ID. Inventory requires a variant suffix to decrement variant stock (`supabase/migrations/20260224000100_fix_inventory_rpc.sql:81-107,116-147`); if product `track_stock=false`, no stock decrements, yet the order is marked applied (`:152-168`). Printful synchronization creates variant products with `track_stock=false` (`src/lib/supabase/printful-backend.ts:829-857`).
- Preconditions/flow: authenticated adult customer submits a variant product's bare ID. With variant quantity positive but disabled/out-of-stock, explicit selection is rejected while bare ID succeeds at base price. For variant-managed inventory with base tracking off, repeated paid bare-ID orders leave variant inventory unchanged. Real catalog exposure was not queried.
- Minimal fix: require an enabled, available explicit variant whenever a product has variants; persist its canonical ID and price. Make inventory fail closed on a missing/unknown required variant. Define an explicit policy for packs containing variant products.
- Test: `src/test/security-audit/payments-variant-omission.test.ts` verifies production route returns 400 for the disabled explicit variant and 200 for its bare ID; the real inventory RPC in isolated PGlite reports applied=true/processed_items=0 and leaves stock unchanged. Change these to rejection assertions after remediation.

### PAY-04 — Medium — Confirmed behavior, contingent loss scenario: webhook busy claim returns success before durable completion

- Evidence: `src/app/api/checkout/viva/webhook/route.ts:240-244` returns 200 for both completed and busy events. `supabase/migrations/20260811000100_checkout_payment_security_hardening.sql:391-393` keeps an interrupted processing claim busy for ten minutes. The provider verification succeeds but the retry does not finalize payment or enqueue independent work.
- Preconditions/flow: a worker claims a valid callback then terminates before completion/failure; a provider retry arrives during the lease. The retry is acknowledged 200 while the order can still be pending or its effects incomplete. If the provider stops retries after success, processing is lost. Provider retry timing, response policy and any external reconciliation job were not observable; no repository replay worker was identified in the reviewed payment paths.
- Minimal fix: return retryable 503 plus Retry-After for busy; acknowledge completed only. Alternatively durably enqueue and reconcile stale leases independently of provider retries. Add lease ownership/fencing if stale workers can finish after takeover.
- Test: `src/test/security-audit/payments-webhook-busy.test.ts` reproduces 200/event_processing with pending order and no finalization. Add a crash/stale-lease integration test and verify documented provider retry semantics before rollout.

## Cross-audit financial impact

The DB audit's publicly executable reward-creation RPC finding directly reaches monetary checkout. `src/lib/supabase/lottery-backend.ts:2404-2421` loads the authenticated customer's available claim; `:553-560` returns its stored percentage. Checkout uses that percentage at `src/app/api/checkout/viva/route.ts:746-773`, reduces charged line totals at `:797-810`, and sends the reduced total to Viva at `:972-981`. Gift claims become free fulfillment lines at `:857-867`. Correct ownership checks at redemption cannot validate the economic legitimacy of attacker-created own claims. Coordinate with the DB audit; this is not an independent duplicate finding.

Unescaped legacy-order email matching in `src/lib/supabase/order-backend.ts:306-312` also feeds loyalty/badge discounts at `src/app/api/checkout/viva/route.ts:550-569`. Root audit owns its reproduction and data exposure/deletion impact.

## Controls checked

- Server resolves product prices, quantities, discounts and shipping; client amount/price/shipping-fee values do not authorize the charged total. Checkout requires an authenticated eligible adult, bounded item count/quantities, attempt UUID and rate limit.
- Viva callback independently retrieves transaction from the provider and compares order, transaction, configured source, EUR currency, exact minor-unit amount and status before mutation (`webhook/route.ts:199-225`). Public GET verification key does not authorize a payment.
- DB-backed checkout attempts and webhook state exist. Unique referral-discount reservation prevents multiple active first-order discounts; promo consumption is row-locked in order creation.
- Current Viva failure/success RPCs lock the same order; delayed failure cannot downgrade paid or release its claims. Inventory and released-claim failures remain paid but require review. Inventory is idempotent by `stock_applied_at` and locks product rows.
- Invoice numbering uses a row-locked counter and order-level advisory lock; account invoice route checks session ownership and paid eligibility. Resume/payment-status/cancel endpoints check customer ID. Return pages do not mutate payment state.
- Lottery ticket minting locks by order and skips existing tickets; loyalty and referral reward routines maintain durable application state. Modern order-cash and contest reward paths gate on paid, unarchived, noncancelled, review=false and use durable receipts.

## Tests and limits

Executed locally:

```text
npm.cmd exec -- vitest run src/test/security-audit/payments-admin-boundaries.test.ts src/test/security-audit/payments-webhook-busy.test.ts src/app/api/checkout/viva/route.test.ts src/app/api/checkout/viva/webhook/route.test.ts src/lib/viva-payment.test.ts src/lib/supabase/viva-payment-state.test.ts src/lib/supabase/viva-payment-state-sql.test.ts src/lib/invoice-routes.test.ts src/lib/supabase/invoice-backend.test.ts
9 files / 115 tests passed

npm.cmd exec -- vitest run src/test/security-audit/payments-variant-omission.test.ts
1 file / 2 tests passed
```

Total: 10 files, 117 tests passed, including 5 new behavior reproductions. Existing suites were inspected for mocked IO before running. New suites explicitly block fetch; SQL executes in in-memory PGlite only. The initial `npm` invocation was blocked by Windows PowerShell script policy; `npm.cmd` ran normally. The installed Vitest executable reported 4.1.11; no dependency installation/update occurred. Existing Vite configuration warning was informational.

No refund/chargeback reconciliation or real-world fulfillment dispatch implementation was found in the reviewed application paths; Printful code reviewed concerns catalog synchronization. Provider dashboard operations, refunds, chargebacks, external reconciliation, actual deployment grants/migrations, provider credential/environment settings, live catalog, webhook delivery history and real multi-connection DB concurrency remain unobservable. Unsupported events are ignored by the callback; no refund or reward reversal was attempted. These are coverage limits, not proof that external business procedures are absent.
