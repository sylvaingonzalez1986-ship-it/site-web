import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Exercise the database operations issued by the two server backends on separate sessions.
export async function checkConcurrentNicknames(db, arena, contest, appearance) {
  const user = randomUUID();
  const profile = { gender: "male", clothing: "teal", skin: "peach", strength: "green-thumb" };
  const saveArena = async (nickname, hair, strength = profile.strength) => {
    const payload = { ...profile, nickname, strength, appearance: { ...appearance, hair } };
    const { rows: [row] } = await arena.query(
      "SELECT public.rpc_arena_save_chanvrier($1, $2::text::jsonb) AS saved", [user, JSON.stringify(payload)],
    );
    return row.saved;
  };
  const saveContest = async pseudo => {
    const { rows: [row] } = await contest.query(`
      INSERT INTO public.contest_profiles(customer_id, pseudo, updated_at) VALUES ($1, $2, now())
      ON CONFLICT (customer_id) DO UPDATE SET pseudo = EXCLUDED.pseudo, updated_at = EXCLUDED.updated_at
      RETURNING customer_id, pseudo`, [user, pseudo]);
    return row.pseudo;
  };
  const read = async () => {
    const { rows: [row] } = await db.query(`
      SELECT c.pseudo, p.nickname, p.appearance, p.strength, p.created_at::text, w.cash_cents
      FROM public.contest_profiles c
      JOIN public.arena_chanvrier_profiles p ON p.user_id = c.customer_id
      JOIN public.kq_equipment_wallets w ON w.user_id = c.customer_id
      WHERE c.customer_id = $1`, [user]);
    assert.equal(row.pseudo, row.nickname, "Contest and character must display the same name");
    return row;
  };

  await db.query("INSERT INTO auth.users VALUES ($1)", [user]);
  await db.exec("GRANT SELECT, INSERT, UPDATE ON public.contest_profiles TO service_role");
  await Promise.all([arena.exec("SET ROLE service_role"), contest.exec("SET ROLE service_role")]);
  const sessions = await Promise.all([arena, contest].map(connection =>
    connection.query("SELECT pg_backend_pid() AS pid, current_setting('server_version') AS version")));
  assert.notEqual(sessions[0].rows[0].pid, sessions[1].rows[0].pid);

  assert.equal(await saveContest("Carnet29"), "Carnet29");
  const created = await saveArena("Depart29", "crop");
  assert.equal(created.created, true);
  const before = await read();
  assert.equal(await saveContest("Concours29"), "Concours29");
  assert.equal((await read()).nickname, "Concours29");
  assert.equal((await saveArena("Quartier29", "braids")).profile.nickname, "Quartier29");
  assert.equal((await read()).pseudo, "Quartier29");

  const outcomes = await Promise.allSettled([saveArena("Atelier29", "pixie"), saveContest("Gouter29")]);
  const final = await read();
  const errors = outcomes.map(result => result.status === "rejected" ? result.reason.code ?? result.reason.message : null);
  console.log(JSON.stringify({
    postgres: sessions[0].rows[0].version, sessions: 2, sequentialEdits: 2,
    concurrentEdits: outcomes.map(result => result.status), errors,
    contestName: final.pseudo, characterName: final.nickname, hair: final.appearance.hair,
    sameBalance: final.cash_cents === before.cash_cents, sameCreation: final.created_at === before.created_at,
  }));
  assert.deepEqual(errors, [null, null], "Both ordinary edits should complete");
  const [saved, renamed] = outcomes.map(result => result.value);
  assert.equal(saved.profile.nickname, "Atelier29");
  assert.equal(saved.created, false);
  assert.equal(saved.startingBonusCents, 0);
  assert.equal(renamed, "Gouter29");
  assert.ok([saved.profile.nickname, renamed].includes(final.nickname));
  assert.deepEqual(final.appearance, { ...appearance, hair: "pixie" });
  assert.equal(final.strength, before.strength);
  assert.equal(final.created_at, before.created_at);
  assert.equal(final.cash_cents, before.cash_cents);
  await assert.rejects(saveArena("ChangementRefuse", "crop", "merchant"), /chanvrier_strength_locked/);
  assert.deepEqual(await read(), final, "Refusing a specialty change rolls back both profiles");
  console.log("PASS: both nickname saves, appearance, balance, creation date and rollback.");
}
