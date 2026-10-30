<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Supabase Data API permissions

- Every migration creating a `public` table must declare its Data API permissions in the same file. RLS policies do not replace `GRANT` statements, including for `service_role`.
- Grant only the operations used by the application. Its database queries run on the server as `service_role`; do not copy generic `anon` / `authenticated` grants onto private tables.
- Keep tables written through `SECURITY DEFINER` RPCs read-only or inaccessible to API roles as intended. For a private table, explicitly revoke all table privileges from `PUBLIC`, `anon`, `authenticated`, and `service_role`.
- Grant sequence `USAGE` explicitly when a permitted insert uses a `SERIAL` / `BIGSERIAL` default. Give API views their own grants and check underlying relations for `security_invoker` views.
- Do not restore automatic grants with `ALTER DEFAULT PRIVILEGES`, or grant privileges on all tables/functions in `public`. Use named objects.
- Run `npm run check:supabase-grants` after changing migrations. Historical application access is completed by `20260923000200_explicit_data_api_grants.sql`; new tables must not rely on that catch-up migration.

## Game UI: visual clarity

- Follow the Quartier's cartoon village direction: readable paper panels and hand-cut, inked signs for buttons and navigation. Controls use complete textured plate artwork through nine-slice `border-image` with `fill`; make their native background, border colour and decorative shadow transparent/none so no geometric rectangle remains underneath. Use the `--game-control-art`, palette, slice and edge tokens from `ArenaRetro.module.css` (with fallbacks for portals), and update the material for selected/hover states. Do not replace this with corner drawings over ordinary CSS buttons. Preserve the intentional shapes of illustrated playing cards, dice, avatars and charts; never skew text or clip focus rings to decorate a control. Material sources and prompts: `docs/bete-de-concours/ui-control-material-provenance.json`.
- Reuse `src/components/placard/KqPrintedArt.tsx` for decorative vignettes. Each navigation destination has its own illustration; its section headers reuse that same illustration. Keep text, amounts and interactions in HTML; artwork provenance is recorded in `docs/bete-de-concours/ui-print-provenance.json` and `docs/bete-de-concours/ui-navigation-provenance.json`.
- Content surfaces use the quieter printed sheets in `public/placard/ui/panel-*-v1.webp`, with `--game-panel-art`, palette, slice and edge tokens. Keep their native background/border transparent so the illustrated contour stays visible. Reserve framed sheets for main panels and key numbers; use simple ink rules for rows inside a register. Keep charts, cards, dice and map geometry intact. Use `KqChapterHeading.tsx` for open illustrated chapter headings, and give existing scenes space without hiding costs or the next action on mobile. Panel prompts and processing: `docs/bete-de-concours/ui-panel-material-provenance.json`.
- Across game screens, lead with the player's key numbers, a useful visualization, and the next action. Keep labels short; put secondary explanations and formulas in expandable details.
- Use one clear heading per section. Do not add decorative uppercase overlines, repeated game/section branding, or slogans above titles. Keep short context labels only when they convey useful state, progress, dates, quantities or distinctions the title does not already express.
- Reuse `src/components/placard/KqVisuals.tsx` for progress toward a real goal, comparable quantities, and parts of a total. Preserve existing useful interactive charts and the game's cream, teal, gold and ink palette.
- Use `--game-surface-warm` for warm game panels and accents: warm apricot orange, alongside cream surfaces. Do not reintroduce the former brown panel backgrounds or pale peach.
- Show actual data with units and readable values. Never invent history, mix different units on a common scale, present an estimate as a result, or treat missing data as zero. The server's offered amounts remain authoritative.
- Preserve visible costs, prerequisites, errors and confirmation details. Graphs must work at 320 px, by keyboard where interactive, and without relying on colour alone.
