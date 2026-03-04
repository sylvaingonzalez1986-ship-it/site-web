BEGIN;

UPDATE public.lottery_reward_definitions
SET
  kind = 'custom',
  title = '600 euros de bon d''achat',
  description = '12 bons d''achat de 50 euros, emis a raison d''un bon par mois pendant 12 mois, utilisables sur toute la boutique. Frais de port non inclus et restant a la charge du client.',
  gift_weight_grams = NULL,
  gift_product_sku = NULL,
  gift_label = '600 euros de bon d''achat',
  custom_payload = jsonb_build_object(
    'rewardType', 'monthly_voucher',
    'monthlyAmount', 50,
    'months', 12,
    'totalAmount', 600,
    'scope', 'entire_shop',
    'shippingIncluded', false,
    'redemptionMode', 'manual_monthly_issue',
    'checkoutRedeemable', false
  ),
  updated_at = now()
WHERE code = 'TCG_PAGE_LEGENDARY';

COMMIT;
