import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { brazilDay } from '../lib/community.ts';
test('check-in uses the Brazilian date at UTC boundaries',()=>{
  assert.equal(brazilDay(new Date('2026-09-28T01:00:00Z')),'2026-09-27');
});
test('community approval, private photos, challenges and moderation enforce permissions in Postgres',async()=>{
  const db=new PGlite();
  const admin='00000000-0000-0000-0000-000000000001',alice='00000000-0000-0000-0000-000000000002',bob='00000000-0000-0000-0000-000000000003';
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
      create function storage.allow_any_operation(ops text[]) returns boolean language sql stable as $$ select coalesce(nullif(current_setting('test.storage_operation',true),''),'object.get_authenticated')=any(ops) $$;
      alter table storage.objects enable row level security;
      grant usage on schema auth,public,storage to authenticated,anon;
      grant select,insert,update,delete on storage.objects to authenticated;
      insert into auth.users(id,email,email_confirmed_at)values('${admin}','victorpaulognv@gmail.com',now()),('${alice}','alice@example.test',now()),('${bob}','bob@example.test',now());
      alter default privileges in schema public grant all on tables to authenticated,anon;
    `);
    for(const migration of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort())
      await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`,import.meta.url),'utf8'));
    async function as(id,role='authenticated'){await db.exec(`reset role;set role ${role};select set_config('request.jwt.claim.sub','${id}',false);`);}
    async function scalar(sql){return Object.values((await db.query(sql)).rows[0])[0];}
    await as('','anon');await assert.rejects(()=>db.query('select * from public.summer_community_stories'),/permission denied/);
    await as(alice);
    assert.equal(await scalar('select public.summer_community_allowed()'),false);
    await db.query("insert into public.summer_community_members(display_name)values('Alice')");
    await assert.rejects(()=>db.query("insert into public.summer_community_members(user_id,display_name,status)values('"+bob+"','Bob','approved')"),/permission denied/);
    const promoted=await db.query("update public.summer_community_members set status='approved' returning *");assert.equal(promoted.rows.length,0);
    await assert.rejects(()=>db.query("select public.summer_story_action('create')"),/restrita/);
    await assert.rejects(()=>db.query('select public.summer_community_members_admin()'),/restrito/);
    await as(admin);await db.query(`update public.summer_community_members set status='approved' where user_id='${alice}'`);
    await as(alice);assert.equal(await scalar('select public.summer_community_allowed()'),true);
    const story=await scalar("select public.summer_story_action('create',null,'Treino concluído')");
    await assert.rejects(()=>db.query(`select public.summer_story_action('publish','${story.id}')`),/não enviada/);
    await assert.rejects(()=>db.query(`insert into storage.objects(bucket_id,name)values('summer-stories','${bob}/photo.jpg')`),/row-level security/);
    await db.query(`insert into storage.objects(bucket_id,name)values('summer-stories','${story.image_path}')`);
    assert.equal((await db.query('select * from storage.objects')).rows.length,0,'draft images cannot be read');
    await scalar(`select public.summer_story_action('publish','${story.id}')`);
    assert.equal((await db.query('select * from storage.objects')).rows.length,1);
    await db.exec("select set_config('test.storage_operation','object.sign',false)");
    assert.equal((await db.query('select * from storage.objects')).rows.length,0,'members cannot create bearer signed URLs');
    await db.exec("select set_config('test.storage_operation','object.get_authenticated',false)");
    await as(bob);assert.equal((await db.query('select * from storage.objects')).rows.length,0);assert.equal((await db.query('select * from public.summer_community_stories')).rows.length,0);
    await db.query("insert into public.summer_community_members(display_name)values('Bob')");
    await as(admin);await db.query(`update public.summer_community_members set status='approved' where user_id='${bob}'`);
    const challenge=(await db.query(`insert into public.summer_challenges(title,description,target,starts_on,ends_on)values('Constância','Movimente-se no seu ritmo',2,(now() at time zone 'America/Sao_Paulo')::date,(now() at time zone 'America/Sao_Paulo')::date+7) returning *`)).rows[0];
    await as(bob);assert.equal((await db.query('select * from storage.objects')).rows.length,1);
    await assert.rejects(()=>db.query(`select public.summer_story_action('hide','${story.id}')`),/não encontrado/);
    await db.query(`insert into public.summer_story_reports(story_id,reason)values('${story.id}','Revisar publicação')`);
    assert.equal((await db.query('update public.summer_story_reports set resolved=true returning *')).rows.length,0);
    await assert.rejects(()=>db.query(`insert into public.summer_challenges(title,description,target,starts_on,ends_on)values('Fake','',1,current_date,current_date)`),/row-level security/);
    await db.query(`insert into public.summer_challenge_members(challenge_id)values('${challenge.id}')`);
    await db.query(`insert into public.summer_challenge_checkins(challenge_id)values('${challenge.id}')`);
    await assert.rejects(()=>db.query(`insert into public.summer_challenge_checkins(challenge_id)values('${challenge.id}')`),/duplicate key/);
    await assert.rejects(()=>db.query(`insert into public.summer_challenge_checkins(challenge_id,day)values('${challenge.id}',current_date-1)`),/permission denied/);
    await as(alice);assert.equal((await db.query('select * from public.summer_challenge_checkins')).rows.length,0);
    for(let i=0;i<4;i++)await scalar("select public.summer_story_action('create')");
    await assert.rejects(()=>db.query("select public.summer_story_action('create')"),/Limite de 5/);
    await as(admin);await db.query(`update public.summer_community_members set status='suspended' where user_id='${bob}'`);
    await as(bob);assert.equal(await scalar('select public.summer_community_allowed()'),false);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
    await assert.rejects(()=>db.query(`insert into public.summer_challenge_members(challenge_id)values('${challenge.id}')`),/row-level security/);
    await as(admin);await scalar(`select public.summer_story_action('hide','${story.id}')`);
    await as(alice);assert.equal((await db.query('select * from storage.objects')).rows.length,0,'moderated image must be unreadable');
    await db.exec(`reset role; update public.summer_community_stories set status='published',expires_at=now()-interval '1 second' where id='${story.id}'`);
    await as(alice);assert.equal((await db.query('select * from storage.objects')).rows.length,0,'expired image must be unreadable');
  } finally { await db.close(); }
});
