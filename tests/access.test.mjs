import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const admin = '00000000-0000-0000-0000-000000000001'
const alice = '00000000-0000-0000-0000-000000000002'
const bob = '00000000-0000-0000-0000-000000000003'
const unconfirmed = '00000000-0000-0000-0000-000000000004'

test('real Postgres permissions, plan lifecycle and data isolation', async t => {
  const db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, deleted_at timestamptz, raw_user_meta_data jsonb default '{}', created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated, anon;
    insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
    ('${admin}','victorpaulognv@gmail.com',now(),'{}'),
    ('${alice}','alice@example.test',now(),'{"name":"Alice","role":"admin","plan":"plus","matricula":"1234"}'),
    ('${bob}','bob@example.test',now(),'{"name":"Bob"}'),
    ('${unconfirmed}','pending@example.test',null,'{}');`)
  const migrations = (await readdir(new URL('../supabase/migrations/', import.meta.url))).filter(x => x.endsWith('.sql')).sort()
  for (const migration of migrations) await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'))
  const functions = await db.query(`select p.proname,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'summer_%'`)
  assert.ok(functions.rows.length >= 6)
  assert.ok(functions.rows.every(f => !f.prosecdef), 'public RPCs must not run with elevated database privileges')
  const privateHelpers = await db.query(`select p.proname,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='summer_private' and p.proname in ('is_admin','admin_students','admin_set_plan')`)
  assert.equal(privateHelpers.rows.filter(f => f.prosecdef).length, 3, 'only the non-exposed private helpers use elevated privileges')
  async function asUser(id, role = 'authenticated') { await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub', '${id}', false);`) }
  async function scalar(sql) { return Object.values((await db.query(sql)).rows[0])[0] }
  await t.test('anonymous callers and students cannot read the student directory or alter plans', async () => {
    await asUser('', 'anon')
    await assert.rejects(() => db.query('select public.summer_admin_students()'), /permission denied/)
    await asUser(alice)
    assert.equal(await scalar('select public.summer_is_admin()'), false)
    await assert.rejects(() => db.query('select public.summer_admin_students()'), /restrito/)
    await assert.rejects(() => db.query(`select public.summer_admin_set_plan('${alice}', 'plus')`), /restrito/)
    await assert.rejects(() => db.query(`insert into public.summer_subscriptions(user_id,plan,expires_at) values ('${alice}','plus',now()+interval '1 year')`), /permission denied/)
    await assert.rejects(() => db.query('select * from summer_private.admin_emails'), /permission denied/)
  })
  await t.test('only verified owner can list, search and grant; metadata cannot confer admin or premium', async () => {
    await asUser(alice)
    assert.equal((await scalar('select public.summer_get_access()')).plan, 'basic')
    await asUser(admin)
    assert.equal(await scalar('select public.summer_is_admin()'), true)
    const result = await scalar('select public.summer_admin_students()')
    assert.equal(result.total, 3); assert.equal(result.summary.active, 0)
    assert.equal((await scalar("select public.summer_admin_students('1234')")).students[0].id, alice)
    await assert.rejects(() => db.query(`select public.summer_admin_set_plan('${unconfirmed}', 'premium')`), /confirmado/)
    await scalar(`select public.summer_admin_set_plan('${alice}', 'premium')`)
    const active = await scalar("select public.summer_admin_students('', 'active')")
    assert.equal(active.total, 1); assert.equal(active.students[0].plan, 'premium')
  })
  await t.test('paid data is isolated; expiration and revocation are enforced in the database', async () => {
    await asUser(alice)
    assert.equal((await scalar('select public.summer_get_access()')).plan, 'premium')
    await db.query("insert into public.summer_calorie_entries(day,label,calories) values (current_date,'Almoço',500)")
    assert.equal((await db.query('select * from public.summer_calorie_entries')).rows.length, 1)
    await asUser(bob)
    assert.equal((await db.query('select * from public.summer_calorie_entries')).rows.length, 0)
    await assert.rejects(() => db.query("insert into public.summer_calorie_entries(day,label,calories) values (current_date,'Almoço',500)"), /row-level security/)
    await asUser(admin)
    const before = (await scalar("select public.summer_admin_students('alice')")).students[0].expires_at
    const renewed = await scalar(`select public.summer_admin_set_plan('${alice}', 'premium','renew')`)
    assert.ok(new Date(renewed.expires_at) > new Date(before))
    await scalar(`select public.summer_admin_set_plan('${alice}', 'premium','revoke')`)
    await asUser(alice)
    assert.equal(await scalar('select public.summer_has_paid_access()'), false)
    assert.equal((await db.query('select * from public.summer_calorie_entries')).rows.length, 0)
    await assert.rejects(() => db.query("insert into public.summer_calorie_entries(day,label,calories) values (current_date,'Almoço',500)"), /row-level security/)
  })
  await t.test('workouts belong to one account and stale writes cannot overwrite newer changes', async () => {
    await asUser(alice)
    assert.equal(await scalar("select public.summer_save_fitness('{\"goal\":3}', 0)"), 1)
    assert.equal(await scalar("select public.summer_save_fitness('{\"goal\":4}', 1)"), 2)
    await assert.rejects(() => db.query("select public.summer_save_fitness('{\"goal\":2}', 1)"), /outro aparelho/)
    await asUser(bob)
    assert.equal((await db.query('select * from public.summer_fitness_state')).rows.length, 0)
    await assert.rejects(() => db.query(`insert into public.summer_fitness_state(user_id,data) values ('${alice}','{}')`), /row-level security/)
  })
  await db.close()
})
