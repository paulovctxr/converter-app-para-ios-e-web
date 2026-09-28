import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const admin = '00000000-0000-0000-0000-000000000001'
const alice = '00000000-0000-0000-0000-000000000002'
const bob = '00000000-0000-0000-0000-000000000003'
const unconfirmed = '00000000-0000-0000-0000-000000000004'

test('real Postgres permissions, subscriptions, PIX review and data isolation', async t => {
  const db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
    create schema storage;
    create function storage.allow_any_operation(text[]) returns boolean language sql stable as $$ select true $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, deleted_at timestamptz, raw_user_meta_data jsonb default '{}', created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated, anon;
    insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
    ('${admin}','victorpaulognv@gmail.com',now(),'{}'),
    ('${alice}','alice@example.test',now(),'{"name":"Alice","role":"admin","plan":"plus","matricula":"1234"}'),
    ('${bob}','bob@example.test',now(),'{"name":"Bob"}'),
    ('${unconfirmed}','pending@example.test',null,'{}');`)

  const migrations = (await readdir(new URL('../supabase/migrations/', import.meta.url)))
    .filter(name => name.endsWith('.sql'))
    .sort()
  for (const migration of migrations)
    await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'))

  const publicFunctions = await db.query(`select p.proname,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'summer_%'`)
  assert.ok(publicFunctions.rows.length >= 12)
  assert.ok(publicFunctions.rows.every(fn => !fn.prosecdef), 'public RPCs must not run with elevated database privileges')

  const privateFunctions = await db.query(`select p.proname,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='summer_private' and p.proname in ('is_admin','admin_students','admin_set_subscription','request_subscription','admin_review_subscription_request','nutrition_access','begin_nutrition_generation')`)
  assert.ok(privateFunctions.rows.every(fn => fn.prosecdef), 'privileged helpers stay in the private schema')

  async function asUser(id, role = 'authenticated') {
    await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub', '${id}', false);`)
  }
  async function scalar(sql) {
    return Object.values((await db.query(sql)).rows[0])[0]
  }

  await t.test('anonymous users and students cannot grant PRO or inspect private config', async () => {
    await asUser('', 'anon')
    await assert.rejects(() => db.query('select public.summer_get_plan_config()'), /permission denied/)
    await asUser(alice)
    assert.equal(await scalar('select public.summer_is_admin()'), false)
    assert.equal((await scalar('select public.summer_get_access()')).subscription_status, 'free')
    await assert.rejects(() => db.query('select public.summer_admin_students()'), /restrito/)
    await assert.rejects(() => db.query(`select public.summer_admin_set_subscription('${alice}', 'monthly')`), /restrito/)
    await assert.rejects(() => db.query(`insert into public.summer_subscriptions(user_id,plan,expires_at,subscription_status,subscription_plan,subscription_started_at,subscription_expires_at) values ('${alice}','plus',now()+interval '1 year','pro','annual',now(),now()+interval '1 year')`), /permission denied/)
    await assert.rejects(() => db.query('select * from summer_private.plan_config'), /permission denied/)
  })

  await t.test('the server fixes PIX prices and only the verified owner can approve', async () => {
    await asUser(alice)
    const pricing = await scalar('select public.summer_get_plan_config()')
    assert.equal(pricing.pro_monthly_price_cents, 1490)
    assert.equal(pricing.pro_annual_price_cents, 11990)
    assert.equal(pricing.annual_savings_cents, 5890)
    const request = await scalar("select public.summer_request_subscription('monthly')")
    assert.equal(request.amount_cents, 1490)
    assert.equal(request.status, 'pending')
    assert.equal((await db.query('select * from public.summer_subscription_requests')).rows.length, 1)
    await assert.rejects(() => db.query(`select public.summer_admin_review_subscription_request(${request.request_id}, 'approved')`), /restrito/)

    await asUser(bob)
    assert.equal((await db.query('select * from public.summer_subscription_requests')).rows.length, 0)
    const annual = await scalar("select public.summer_request_subscription('annual')")
    assert.equal(annual.amount_cents, 11990)

    await asUser(admin)
    assert.equal(await scalar('select public.summer_is_admin()'), true)
    const overview = await scalar("select public.summer_admin_students('alice')")
    assert.equal(overview.students[0].pending_request.id, request.request_id)
    await scalar(`select public.summer_admin_review_subscription_request(${request.request_id}, 'approved')`)

    await asUser(alice)
    const access = await scalar('select public.summer_get_access()')
    assert.equal(access.subscription_status, 'pro')
    assert.equal(access.subscription_plan, 'monthly')
    assert.equal(access.plan, 'plus')
  })

  await t.test('nutrition AI data and the exercise library are enforced as PRO on the database', async () => {
    await asUser(alice)
    await db.query(`insert into public.summer_nutrition_profiles(goal,age,height_cm,weight_kg,activity_level,dietary_preference,meals_per_day,water_target_ml) values ('gain_muscle',25,175,75,'moderate','balanced',4,2600)`)
    assert.equal((await db.query('select * from public.summer_nutrition_profiles')).rows.length, 1)
    assert.ok((await db.query('select * from public.summer_exercise_library')).rows.length >= 30)
    const access = await scalar('select public.summer_get_nutrition_access()')
    assert.equal(access.is_pro, true)
    assert.equal(access.monthly_limit, 4)
    const reservation = await scalar('select public.summer_begin_nutrition_generation()')
    assert.ok(reservation.generation_id)
    assert.equal(reservation.remaining, 3)
    await assert.rejects(() => db.query('select * from public.summer_nutrition_generations'), /permission denied/)
    await assert.rejects(() => db.query(`insert into public.summer_meal_plans(user_id,profile_snapshot,targets,days,shopping_list) values ('${alice}','{}','{}','[]','[]')`), /permission denied/)

    await asUser(bob)
    assert.equal((await db.query('select * from public.summer_exercise_library')).rows.length, 0)
    await assert.rejects(() => db.query(`insert into public.summer_nutrition_profiles(goal,age,height_cm,weight_kg,activity_level,dietary_preference,meals_per_day,water_target_ml) values ('maintain',25,170,70,'moderate','balanced',4,2500)`), /row-level security/)
    await assert.rejects(() => db.query('select public.summer_begin_nutrition_generation()'), /Summer PRO/)
  })

  await t.test('PRO data is enforced by RLS, including expiration and cancellation', async () => {
    await asUser(alice)
    await db.query("insert into public.summer_calorie_entries(day,label,calories) values (current_date,'Almoço',500)")
    assert.equal((await db.query('select * from public.summer_calorie_entries')).rows.length, 1)

    await asUser(bob)
    assert.equal((await db.query('select * from public.summer_calorie_entries')).rows.length, 0)
    await assert.rejects(() => db.query("insert into public.summer_calorie_entries(day,label,calories) values (current_date,'Almoço',500)"), /row-level security/)

    await asUser(admin)
    await assert.rejects(() => db.query(`select public.summer_admin_set_subscription('${unconfirmed}', 'monthly')`), /confirmado/)
    const renewed = await scalar(`select public.summer_admin_set_subscription('${alice}', 'annual', 'renew')`)
    assert.equal(renewed.subscription_plan, 'annual')
    assert.ok(new Date(renewed.subscription_expires_at).getTime() > Date.now() + 300 * 86400000)
    await scalar(`select public.summer_admin_set_subscription('${alice}', 'annual', 'revoke')`)

    await asUser(alice)
    assert.equal(await scalar('select public.summer_has_pro_access()'), false)
    assert.equal((await scalar('select public.summer_get_access()')).subscription_status, 'cancelled')
    assert.equal((await db.query('select * from public.summer_calorie_entries')).rows.length, 0)
    await assert.rejects(() => db.query("insert into public.summer_calorie_entries(day,label,calories) values (current_date,'Jantar',400)"), /row-level security/)
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

  await t.test('photo import remains available on Summer Gratis with a monthly quota', async () => {
    await asUser(admin)
    await scalar('select public.summer_admin_workout_import_config(3, null)')
    await asUser(bob)
    let access = await scalar('select public.summer_get_workout_import_access()')
    assert.equal(access.available_on_free, true)
    assert.equal(access.allowed, true)
    assert.equal(access.remaining, 3)
    for (let index = 0; index < 3; index++)
      await scalar('select public.summer_begin_workout_import(1)')
    await assert.rejects(() => db.query('select public.summer_begin_workout_import(1)'), /Limite de digitalizações/)
    await asUser(alice)
    access = await scalar('select public.summer_get_workout_import_access()')
    assert.equal(access.available_on_free, true)
    assert.equal(access.remaining, 3)
    await assert.rejects(() => db.query('select public.summer_admin_workout_import_config(9, null)'), /restrito/)
  })

  await db.close()
})
