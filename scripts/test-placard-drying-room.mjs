import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite(),player='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id UUID PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS $$ SELECT NULL::UUID $$;INSERT INTO auth.users VALUES('${player}'),('${other}');`);
 await db.exec(await readFile('supabase/migrations/20260830000100_kq_durable_equipment_shop.sql','utf8'));
 await db.exec('ALTER TABLE kq_equipment_wallets ADD COLUMN planned_equipment_code TEXT;');
 await db.exec(await readFile('supabase/migrations/20260911000200_kq_equipment_levels.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20260913001100_kq_flower_drying_room.sql','utf8'));
 await db.query('SELECT rpc_kq_ensure_equipment_profile($1)',[player]);
 await db.query('SELECT rpc_kq_ensure_equipment_profile($1)',[other]);
 await db.query('UPDATE kq_equipment_wallets SET cash_cents=1000000 WHERE user_id=$1',[player]);
 const cash=async()=>Number((await db.query('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[player])).rows[0].cash_cents);
 const key='00000000-0000-4000-8000-000000000010';
 await db.query('SELECT rpc_kq_purchase_equipment($1,$2,$3)',[player,key,['DRYING-ROOM']]);assert.equal(await cash(),940000);
 await db.query('SELECT rpc_kq_purchase_equipment($1,$2,$3)',[player,key,['DRYING-ROOM']]);assert.equal(await cash(),940000);
 await assert.rejects(db.query('SELECT rpc_kq_equip_durable($1,$2)',[other,'DRYING-ROOM']));
 await db.query('SELECT rpc_kq_equip_durable($1,$2)',[player,'DRYING-ROOM']);
 await db.query('SELECT rpc_kq_purchase_equipment($1,$2,$3)',[player,'00000000-0000-4000-8000-000000000011',['FREEZE-DRYER']]);
 await db.query('SELECT rpc_kq_equip_durable($1,$2)',[player,'FREEZE-DRYER']);
 assert.deepEqual((await db.query("SELECT slot FROM kq_equipment_loadouts WHERE user_id=$1 AND equipment_code IN ('DRYING-ROOM','FREEZE-DRYER') ORDER BY slot",[player])).rows.map(r=>r.slot),['drying','flower-drying']);
 const before=await cash();
 for(let level=1;level<10;level++){
  const requestKey=`00000000-0000-4000-8000-${String(100+level).padStart(12,'0')}`;
  await db.query('SELECT rpc_kq_upgrade_equipment($1,$2,$3,$4)',[player,requestKey,'DRYING-ROOM',level]);
  const balance=await cash();await db.query('SELECT rpc_kq_upgrade_equipment($1,$2,$3,$4)',[player,requestKey,'DRYING-ROOM',level]);assert.equal(await cash(),balance);
 }
 assert.equal(before-await cash(),270000);
 await assert.rejects(db.query('SELECT rpc_kq_upgrade_equipment($1,$2,$3,$4)',[player,'00000000-0000-4000-8000-000000000199','DRYING-ROOM',10]));
 console.log('PASS: drying-room purchase and install, independent slots, ownership, all ten levels and idempotent debits.');
}finally{await db.close();}
