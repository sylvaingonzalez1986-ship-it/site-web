/** Reuses the shell/Commerce fixture to check the jury's exact-lot return, without submitting a duel. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve('output/clarity-lot12/navigation');
await mkdir(output, { recursive: true });
let source = (await readFile('scripts/audit-harvest-market-navigation-lot11.mjs', 'utf8'));
assert(source.includes("['workshop','storage']"));
source = source.replaceAll('output/clarity-lot11/navigation', 'output/clarity-lot12/navigation')
  .replaceAll('??3613', '??3621')
  .replace("[['./KqHarvests','KqHarvests'],['./KqWarehouseEntry','KqWarehouseEntry']]", "[['./KanabQuestDicePrototype','KanabQuestDicePrototype']]")
  .replace('props.onOpenMarket(props.initialFlowerId,"dashboard")', 'props.onOpenMarket(props.initialFlowerId)')
  .replaceAll("[['harvests',''],['harvests','storage'],['workshop','storage']]", "[['arena','']]")
  .replaceAll('empty-bulk-fixture', 'operations-lesson-flower')
  .replaceAll('[data-screen="dashboard"]', '[data-commerce-lot="operations-stock"]')
  .replace("assert.equal(params().get('section'),'dashboard')", "assert.equal(params().get('section'),'sales')")
  .replace('dashboard:true', 'exactPreparedLot:true');
const runtime = resolve(output, 'recipe.mjs');
await writeFile(runtime, source);
await import(pathToFileURL(runtime).href);
