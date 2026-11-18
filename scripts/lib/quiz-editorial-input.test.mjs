import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {test} from 'node:test';
import {loadQuizReleaseSelection} from './quiz-editorial-input.mjs';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const save=(path,value)=>writeFile(path,JSON.stringify(value));
async function fixture(t) {
  const prefix=resolve(tmpdir(),'quiz-scope-test-');
  const root=await mkdtemp(prefix);
  t.after(async()=>{
    assert(resolve(root).startsWith(prefix) && resolve(root)!==resolve(tmpdir()));
    await rm(root,{recursive:true,force:true});
  });
  const classified={id:'fixture-one',domain:'active',reason:'Direct active fact'};
  const classificationFile=join(root,'classification.json');
  const classificationRecord=join(root,'review.json');
  const row={id:classified.id,domain:'active',reason:classified.reason,contentHash:hash({question:'fixture'}),classifiedBy:'writer',reviewedBy:'reviewer',classificationRecord};
  await save(classificationFile,{items:[classified]});
  await save(classificationRecord,{classifiedBy:'writer',reviewer:'reviewer',classificationFile,items:[{id:row.id,status:'approved',domain:row.domain,contentHash:row.contentHash,classificationHash:hash(classified)}]});
  const selection={revision:'test',target:10,quotas:{active:8,food:1,materials:1},selected:[row],excluded:[]};
  await save(join(root,'release-selection.json'),selection);
  return {root,selection,classificationFile,classificationRecord,row};
}

test('allows a partial independently classified selection during work',async t=>{
  const {root}=await fixture(t);
  const result=await loadQuizReleaseSelection(root);
  assert.equal(result.byId.size,1);
  assert.equal(result.excludedById.size,0);
});

test('rejects changed classifications even when the question hash is unchanged',async t=>{
  const {root,classificationFile}=await fixture(t);
  await save(classificationFile,{items:[{id:'fixture-one',domain:'active',reason:'Changed after review'}]});
  await assert.rejects(loadQuizReleaseSelection(root),/classification changed after counter-review/);
});

test('rejects a scope decision for a different question version',async t=>{
  const {root,selection}=await fixture(t);
  selection.selected[0].contentHash=hash({question:'changed'});
  await save(join(root,'release-selection.json'),selection);
  await assert.rejects(loadQuizReleaseSelection(root),/stale domain question hash/);
});

test('requires a different reviewer and the actually approved domain',async t=>{
  const {root,selection}=await fixture(t);
  selection.selected[0].reviewedBy='writer';
  await save(join(root,'release-selection.json'),selection);
  await assert.rejects(loadQuizReleaseSelection(root),/independent domain review required/);
  selection.selected[0].reviewedBy='reviewer';
  selection.selected[0].domain='food';
  await save(join(root,'release-selection.json'),selection);
  await assert.rejects(loadQuizReleaseSelection(root),/domain differs from independent review/);
});

test('keeps reviewed exclusions separate and prevents overlapping decisions',async t=>{
  const {root,selection,classificationFile,classificationRecord,row}=await fixture(t);
  const original={id:row.id,domain:'offscope',reason:'Generic fact'};
  await save(classificationFile,{items:[original]});
  const proof=JSON.parse(await readFile(classificationRecord,'utf8'));
  Object.assign(proof.items[0],{domain:'offscope',classificationHash:hash(original)});
  await save(classificationRecord,proof);
  selection.selected=[];
  selection.excluded=[{...row,domain:'offscope'}];
  await save(join(root,'release-selection.json'),selection);
  const result=await loadQuizReleaseSelection(root);
  assert.equal(result.byId.size,0);
  assert.equal(result.excludedById.size,1);
  selection.excluded.push(selection.excluded[0]);
  await save(join(root,'release-selection.json'),selection);
  await assert.rejects(loadQuizReleaseSelection(root),/duplicate scope decision/);
});

test('rejects a bank that exceeds an individual domain quota',async t=>{
  const {root,selection}=await fixture(t);
  selection.quotas={active:0,food:5,materials:5};
  await save(join(root,'release-selection.json'),selection);
  await assert.rejects(loadQuizReleaseSelection(root),/active: selection exceeds its quota/);
});
