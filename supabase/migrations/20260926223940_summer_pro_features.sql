-- Summer Treinos: recursos funcionais do Summer PRO.
-- Nutrição, cardápio por IA, água, biblioteca e uso mensal são protegidos
-- no banco. Perder o PRO bloqueia o acesso, mas não apaga os dados.
begin;

alter table summer_private.plan_config
  add column if not exists nutrition_generation_limit integer not null default 4;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'plan_config_nutrition_generation_limit_check'
      and conrelid = 'summer_private.plan_config'::regclass
  ) then
    alter table summer_private.plan_config
      add constraint plan_config_nutrition_generation_limit_check
      check (nutrition_generation_limit between 1 and 20);
  end if;
end $$;

update summer_private.plan_config
set nutrition_generation_limit = coalesce(nutrition_generation_limit, 4)
where singleton;

create or replace function summer_private.plan_config()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Autenticacao necessaria' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'free_price_cents', c.free_price_cents,
    'pro_monthly_price_cents', c.pro_monthly_price_cents,
    'pro_annual_price_cents', c.pro_annual_price_cents,
    'promotional_monthly_price_cents', c.promotional_monthly_price_cents,
    'promotion_active', c.promotion_active,
    'pix_key', c.pix_key,
    'annual_savings_cents', greatest(
      0,
      c.pro_monthly_price_cents * 12 - c.pro_annual_price_cents
    ),
    'nutrition_generation_limit', c.nutrition_generation_limit,
    'updated_at', c.updated_at
  ) into result
  from summer_private.plan_config c where c.singleton;
  return result;
end;
$$;

-- Administradores também podem validar os recursos sem manter uma assinatura
-- separada. Para os demais usuários, apenas uma assinatura PRO vigente vale.
create or replace function public.summer_has_pro_access()
returns boolean language sql stable security invoker set search_path = '' as $$
  select public.summer_is_admin() or exists (
    select 1 from public.summer_subscriptions s
    where s.user_id = (select auth.uid())
      and s.subscription_status = 'pro'
      and s.subscription_expires_at > now()
  );
$$;

create or replace function public.summer_has_paid_access()
returns boolean language sql stable security invoker set search_path = '' as $$
  select public.summer_has_pro_access();
$$;

-- O registro anterior de calorias passa a guardar também a refeição e macros.
alter table public.summer_calorie_entries
  add column if not exists meal_type text not null default 'other',
  add column if not exists protein_g numeric(6,1) not null default 0,
  add column if not exists carbs_g numeric(6,1) not null default 0,
  add column if not exists fat_g numeric(6,1) not null default 0,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'summer_calorie_entries_meal_type_check'
      and conrelid = 'public.summer_calorie_entries'::regclass
  ) then
    alter table public.summer_calorie_entries
      add constraint summer_calorie_entries_meal_type_check
      check (meal_type in ('breakfast','lunch','snack','dinner','supper','other'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'summer_calorie_entries_macros_check'
      and conrelid = 'public.summer_calorie_entries'::regclass
  ) then
    alter table public.summer_calorie_entries
      add constraint summer_calorie_entries_macros_check
      check (
        protein_g between 0 and 1000
        and carbs_g between 0 and 1500
        and fat_g between 0 and 1000
      );
  end if;
end $$;

revoke all on public.summer_calorie_entries from public, anon, authenticated;
grant select, insert, update, delete on public.summer_calorie_entries to authenticated;

drop policy if exists summer_calories_update on public.summer_calorie_entries;
create policy summer_calories_update
  on public.summer_calorie_entries for update to authenticated
  using (
    user_id = (select auth.uid())
    and (select public.summer_has_pro_access())
  )
  with check (
    user_id = (select auth.uid())
    and (select public.summer_has_pro_access())
  );

create table if not exists public.summer_nutrition_profiles (
  user_id uuid primary key default auth.uid()
    references auth.users(id) on delete cascade,
  goal text not null
    check (goal in ('lose_fat','maintain','gain_muscle')),
  age smallint not null check (age between 18 and 90),
  height_cm numeric(5,1) not null check (height_cm between 120 and 230),
  weight_kg numeric(6,1) not null check (weight_kg between 35 and 300),
  activity_level text not null
    check (activity_level in ('low','moderate','high')),
  dietary_preference text not null default 'balanced'
    check (dietary_preference in (
      'balanced','vegetarian','vegan','low_lactose','gluten_free'
    )),
  allergies text not null default '' check (length(allergies) <= 500),
  disliked_foods text not null default '' check (length(disliked_foods) <= 500),
  meals_per_day smallint not null default 4 check (meals_per_day between 3 and 6),
  water_target_ml integer not null default 2500
    check (water_target_ml between 1000 and 6000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.summer_water_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  day date not null default current_date,
  amount_ml integer not null check (amount_ml between 50 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists summer_water_user_day
  on public.summer_water_entries(user_id, day, created_at desc);

create table if not exists public.summer_nutrition_generations (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'processing'
    check (status in ('processing','completed','failed')),
  error_code text check (error_code is null or length(error_code) <= 80),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists summer_nutrition_generations_user_created
  on public.summer_nutrition_generations(user_id, created_at desc);

create table if not exists public.summer_meal_plans (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_id bigint unique
    references public.summer_nutrition_generations(id) on delete set null,
  profile_snapshot jsonb not null
    check (
      jsonb_typeof(profile_snapshot) = 'object'
      and octet_length(profile_snapshot::text) <= 12000
    ),
  targets jsonb not null
    check (
      jsonb_typeof(targets) = 'object'
      and octet_length(targets::text) <= 5000
    ),
  days jsonb not null
    check (
      jsonb_typeof(days) = 'array'
      and jsonb_array_length(days) = 7
      and octet_length(days::text) <= 180000
    ),
  shopping_list jsonb not null
    check (
      jsonb_typeof(shopping_list) = 'array'
      and octet_length(shopping_list::text) <= 50000
    ),
  created_at timestamptz not null default now()
);
create index if not exists summer_meal_plans_user_created
  on public.summer_meal_plans(user_id, created_at desc);

create table if not exists public.summer_exercise_library (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  name text not null check (length(name) between 2 and 100),
  muscle_group text not null
    check (muscle_group in (
      'Peito','Costas','Pernas','Glúteos','Ombros','Bíceps','Tríceps','Core'
    )),
  equipment text not null check (length(equipment) between 2 and 80),
  difficulty text not null default 'Intermediário'
    check (difficulty in ('Iniciante','Intermediário','Avançado')),
  instructions text[] not null check (cardinality(instructions) between 2 and 8),
  tips text[] not null default '{}' check (cardinality(tips) <= 6),
  created_at timestamptz not null default now()
);

insert into public.summer_exercise_library(
  slug, name, muscle_group, equipment, difficulty, instructions, tips
) values
('supino-reto-barra','Supino reto com barra','Peito','Barra e banco','Intermediário',array['Apoie os pés e mantenha as escápulas firmes no banco.','Desça a barra com controle até a linha média do peito.','Empurre sem tirar o quadril do banco.'],array['Mantenha os punhos alinhados.','Use um parceiro ao trabalhar perto do limite.']),
('supino-inclinado-halteres','Supino inclinado com halteres','Peito','Halteres e banco inclinado','Intermediário',array['Ajuste o banco entre 25 e 40 graus.','Desça os halteres ao lado do peito com controle.','Una o movimento no alto sem bater os halteres.'],array['Evite inclinação excessiva para não transferir tudo aos ombros.']),
('crucifixo-maquina','Crucifixo na máquina','Peito','Máquina peck deck','Iniciante',array['Ajuste o assento para deixar os cotovelos na linha do peito.','Feche os braços sem projetar os ombros.','Retorne devagar até sentir alongamento confortável.'],array['Não use impulso.']),
('flexao-bracos','Flexão de braços','Peito','Peso corporal','Iniciante',array['Alinhe mãos, ombros, quadril e tornozelos.','Desça o peito mantendo o abdômen firme.','Empurre o chão até estender os braços.'],array['Apoie os joelhos para reduzir a dificuldade.']),
('puxada-alta','Puxada alta pela frente','Costas','Polia alta','Iniciante',array['Segure a barra um pouco além da largura dos ombros.','Puxe em direção à parte alta do peito.','Retorne até alongar as costas sem perder o controle.'],array['Não leve a barra atrás da cabeça.']),
('remada-baixa','Remada baixa sentada','Costas','Polia baixa','Iniciante',array['Mantenha a coluna neutra e o peito aberto.','Puxe o pegador em direção ao abdômen.','Estenda os braços sem arredondar as costas.'],array['Conduza o movimento com os cotovelos.']),
('remada-curvada','Remada curvada com barra','Costas','Barra','Avançado',array['Incline o tronco com quadril para trás e coluna neutra.','Puxe a barra em direção ao abdômen.','Desça mantendo o tronco estável.'],array['Reduza a carga se a lombar perder a posição.']),
('barra-fixa','Barra fixa','Costas','Barra fixa','Avançado',array['Comece pendurado com abdômen firme.','Puxe o peito em direção à barra.','Desça de forma controlada até estender os braços.'],array['Use elástico ou máquina assistida se necessário.']),
('pullover-polia','Pullover na polia','Costas','Polia alta','Intermediário',array['Incline levemente o tronco e mantenha os braços quase estendidos.','Leve a barra até as coxas usando as costas.','Retorne devagar sem elevar os ombros.'],array['Evite transformar o exercício em tríceps.']),
('agachamento-livre','Agachamento livre','Pernas','Barra ou peso corporal','Intermediário',array['Posicione os pés de forma confortável e firme o tronco.','Desça levando quadril e joelhos juntos.','Suba empurrando o chão e mantendo os joelhos alinhados.'],array['Use amplitude que preserve sua técnica.']),
('leg-press','Leg press','Pernas','Máquina leg press','Iniciante',array['Apoie toda a lombar e posicione os pés na plataforma.','Desça a plataforma sem levantar o quadril.','Empurre sem travar os joelhos com força.'],array['Ajuste a amplitude ao seu conforto de quadril.']),
('cadeira-extensora','Cadeira extensora','Pernas','Máquina extensora','Iniciante',array['Alinhe o eixo da máquina com os joelhos.','Estenda as pernas de forma controlada.','Retorne sem deixar as placas baterem.'],array['Não use impulso do tronco.']),
('mesa-flexora','Mesa flexora','Pernas','Máquina flexora','Iniciante',array['Alinhe os joelhos ao eixo da máquina.','Flexione levando os calcanhares em direção aos glúteos.','Retorne lentamente mantendo o quadril apoiado.'],array['Evite levantar o quadril.']),
('stiff','Stiff com barra ou halteres','Pernas','Barra ou halteres','Intermediário',array['Mantenha joelhos levemente flexionados.','Leve o quadril para trás com a coluna neutra.','Suba contraindo glúteos quando sentir alongamento posterior.'],array['A carga deve ficar próxima das pernas.']),
('levantamento-terra','Levantamento terra','Costas','Barra','Avançado',array['Posicione a barra sobre o meio dos pés.','Firme o tronco e empurre o chão mantendo a barra perto do corpo.','Finalize em pé sem inclinar para trás.'],array['Priorize técnica e progressão gradual.']),
('afundo','Afundo','Pernas','Peso corporal ou halteres','Intermediário',array['Dê um passo estável à frente ou para trás.','Desça os dois joelhos mantendo o tronco firme.','Empurre pelo pé da frente para retornar.'],array['Mantenha o joelho alinhado ao pé.']),
('panturrilha-em-pe','Elevação de panturrilha em pé','Pernas','Máquina ou peso corporal','Iniciante',array['Apoie a parte da frente dos pés.','Eleve os calcanhares ao máximo com controle.','Desça lentamente até alongar a panturrilha.'],array['Evite quicar no fim do movimento.']),
('elevacao-pelvica','Elevação pélvica','Glúteos','Banco e barra','Intermediário',array['Apoie a parte alta das costas no banco.','Eleve o quadril mantendo costelas e abdômen firmes.','Contraia os glúteos no alto e desça com controle.'],array['Evite hiperestender a lombar.']),
('abducao-maquina','Abdução de quadril na máquina','Glúteos','Máquina abdutora','Iniciante',array['Ajuste o assento e mantenha o tronco estável.','Abra os joelhos até uma amplitude confortável.','Retorne lentamente sem deixar as placas baterem.'],array['Controle principalmente a volta.']),
('desenvolvimento-halteres','Desenvolvimento com halteres','Ombros','Halteres','Intermediário',array['Sente com as costas apoiadas e halteres na altura dos ombros.','Empurre para cima mantendo o tronco firme.','Desça até uma amplitude confortável.'],array['Não arqueie excessivamente a lombar.']),
('elevacao-lateral','Elevação lateral','Ombros','Halteres','Iniciante',array['Mantenha cotovelos levemente flexionados.','Eleve os braços até próximo da linha dos ombros.','Desça devagar sem balançar o corpo.'],array['Use carga que permita controle.']),
('face-pull','Face pull','Ombros','Polia e corda','Intermediário',array['Ajuste a polia na altura do rosto.','Puxe a corda separando as mãos ao lado da cabeça.','Retorne mantendo ombros baixos.'],array['Conduza com os cotovelos altos.']),
('rosca-direta','Rosca direta','Bíceps','Barra','Iniciante',array['Mantenha cotovelos próximos ao corpo.','Flexione os braços sem mover os ombros.','Desça a barra lentamente até quase estender os cotovelos.'],array['Evite embalo do tronco.']),
('rosca-alternada','Rosca alternada','Bíceps','Halteres','Iniciante',array['Fique estável com um halter em cada mão.','Flexione um braço girando a palma para cima.','Desça e alterne os lados.'],array['Mantenha o punho neutro.']),
('rosca-martelo','Rosca martelo','Bíceps','Halteres','Iniciante',array['Segure os halteres com as palmas voltadas uma para a outra.','Flexione sem afastar os cotovelos.','Retorne de forma controlada.'],array['Não balance o tronco.']),
('triceps-corda','Tríceps na corda','Tríceps','Polia e corda','Iniciante',array['Mantenha os cotovelos junto ao corpo.','Estenda os braços e separe a corda no final.','Retorne sem deixar os ombros avançarem.'],array['Movimente apenas os antebraços.']),
('triceps-testa','Tríceps testa','Tríceps','Barra ou halteres','Intermediário',array['Deite no banco e mantenha braços apontados para cima.','Flexione os cotovelos levando a carga em direção à testa.','Estenda sem abrir os cotovelos.'],array['Use carga moderada e controle total.']),
('mergulho-banco','Mergulho no banco','Tríceps','Banco','Intermediário',array['Apoie as mãos no banco e mantenha o corpo próximo.','Flexione os cotovelos até uma amplitude confortável.','Empurre o banco para retornar.'],array['Se houver desconforto no ombro, escolha outra variação.']),
('prancha','Prancha abdominal','Core','Peso corporal','Iniciante',array['Apoie antebraços e pontas dos pés.','Alinhe cabeça, tronco e quadril.','Respire mantendo abdômen e glúteos firmes.'],array['Encerre quando perder o alinhamento.']),
('abdominal-supra','Abdominal supra','Core','Colchonete','Iniciante',array['Deite com joelhos flexionados e lombar apoiada.','Eleve as escápulas usando o abdômen.','Retorne lentamente sem puxar o pescoço.'],array['Olhe para cima e mantenha o queixo relaxado.']),
('dead-bug','Dead bug','Core','Colchonete','Iniciante',array['Deite com braços para cima e quadris e joelhos a 90 graus.','Estenda braço e perna opostos mantendo a lombar apoiada.','Retorne e alterne os lados.'],array['Reduza a amplitude se a lombar sair do chão.'])
on conflict (slug) do update set
  name = excluded.name,
  muscle_group = excluded.muscle_group,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  instructions = excluded.instructions,
  tips = excluded.tips;

alter table public.summer_nutrition_profiles enable row level security;
alter table public.summer_water_entries enable row level security;
alter table public.summer_nutrition_generations enable row level security;
alter table public.summer_meal_plans enable row level security;
alter table public.summer_exercise_library enable row level security;

revoke all on public.summer_nutrition_profiles,
  public.summer_water_entries,
  public.summer_nutrition_generations,
  public.summer_meal_plans,
  public.summer_exercise_library
  from public, anon, authenticated;

grant select, insert, update, delete on public.summer_nutrition_profiles
  to authenticated;
grant select, insert, delete on public.summer_water_entries to authenticated;
grant select, delete on public.summer_meal_plans to authenticated;
grant select on public.summer_exercise_library to authenticated;

drop policy if exists summer_nutrition_profiles_select on public.summer_nutrition_profiles;
drop policy if exists summer_nutrition_profiles_insert on public.summer_nutrition_profiles;
drop policy if exists summer_nutrition_profiles_update on public.summer_nutrition_profiles;
drop policy if exists summer_nutrition_profiles_delete on public.summer_nutrition_profiles;
create policy summer_nutrition_profiles_select
  on public.summer_nutrition_profiles for select to authenticated
  using (user_id = (select auth.uid()) and (select public.summer_has_pro_access()));
create policy summer_nutrition_profiles_insert
  on public.summer_nutrition_profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.summer_has_pro_access()));
create policy summer_nutrition_profiles_update
  on public.summer_nutrition_profiles for update to authenticated
  using (user_id = (select auth.uid()) and (select public.summer_has_pro_access()))
  with check (user_id = (select auth.uid()) and (select public.summer_has_pro_access()));
create policy summer_nutrition_profiles_delete
  on public.summer_nutrition_profiles for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.summer_has_pro_access()));

drop policy if exists summer_water_select on public.summer_water_entries;
drop policy if exists summer_water_insert on public.summer_water_entries;
drop policy if exists summer_water_delete on public.summer_water_entries;
create policy summer_water_select
  on public.summer_water_entries for select to authenticated
  using (user_id = (select auth.uid()) and (select public.summer_has_pro_access()));
create policy summer_water_insert
  on public.summer_water_entries for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.summer_has_pro_access()));
create policy summer_water_delete
  on public.summer_water_entries for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.summer_has_pro_access()));

drop policy if exists summer_meal_plans_select on public.summer_meal_plans;
drop policy if exists summer_meal_plans_delete on public.summer_meal_plans;
create policy summer_meal_plans_select
  on public.summer_meal_plans for select to authenticated
  using (user_id = (select auth.uid()) and (select public.summer_has_pro_access()));
create policy summer_meal_plans_delete
  on public.summer_meal_plans for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.summer_has_pro_access()));

drop policy if exists summer_exercise_library_pro on public.summer_exercise_library;
create policy summer_exercise_library_pro
  on public.summer_exercise_library for select to authenticated
  using ((select public.summer_has_pro_access()));

-- Chamado antes de gastar IA. Serializa por usuário para impedir duas reservas
-- simultâneas de ultrapassarem o limite mensal.
create or replace function summer_private.nutrition_access()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  pro_active boolean;
  limit_value integer;
  used_value integer;
begin
  if account_id is null then
    raise exception 'Autenticacao necessaria' using errcode = '42501';
  end if;
  pro_active := summer_private.is_admin() or exists (
    select 1 from public.summer_subscriptions s
    where s.user_id = account_id
      and s.subscription_status = 'pro'
      and s.subscription_expires_at > now()
  );
  select c.nutrition_generation_limit into limit_value
  from summer_private.plan_config c where c.singleton;
  limit_value := coalesce(limit_value, 4);
  select count(*)::integer into used_value
  from public.summer_nutrition_generations g
  where g.user_id = account_id
    and g.created_at >= date_trunc('month', now())
    and g.created_at < date_trunc('month', now()) + interval '1 month'
    and (
      g.status = 'completed'
      or (g.status = 'processing' and g.created_at > now() - interval '15 minutes')
    );
  return jsonb_build_object(
    'is_pro', pro_active,
    'allowed', pro_active and used_value < limit_value,
    'used', used_value,
    'remaining', greatest(0, limit_value - used_value),
    'monthly_limit', limit_value,
    'period_ends_at', date_trunc('month', now()) + interval '1 month',
    'server_time', now()
  );
end;
$$;

create or replace function summer_private.begin_nutrition_generation()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  access_result jsonb;
  generation_id bigint;
begin
  if account_id is null then
    raise exception 'Autenticacao necessaria' using errcode = '42501';
  end if;
  perform 1 from auth.users
    where id = account_id and deleted_at is null and email_confirmed_at is not null
    for update;
  if not found then
    raise exception 'Conta nao encontrada ou e-mail ainda nao confirmado';
  end if;
  access_result := summer_private.nutrition_access();
  if not coalesce((access_result ->> 'is_pro')::boolean, false) then
    raise exception 'Recurso exclusivo do Summer PRO' using errcode = '42501';
  end if;
  if not coalesce((access_result ->> 'allowed')::boolean, false) then
    raise exception 'Limite mensal de cardapios atingido';
  end if;
  insert into public.summer_nutrition_generations(user_id)
  values (account_id)
  returning id into generation_id;
  return access_result || jsonb_build_object(
    'generation_id', generation_id,
    'remaining', greatest(0, (access_result ->> 'remaining')::integer - 1)
  );
end;
$$;

revoke all on function summer_private.nutrition_access(),
  summer_private.begin_nutrition_generation()
  from public, anon, authenticated;
grant execute on function summer_private.nutrition_access(),
  summer_private.begin_nutrition_generation()
  to authenticated;

create or replace function public.summer_get_nutrition_access()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select summer_private.nutrition_access();
$$;
create or replace function public.summer_begin_nutrition_generation()
returns jsonb language sql security invoker set search_path = '' as $$
  select summer_private.begin_nutrition_generation();
$$;

revoke all on function public.summer_get_nutrition_access(),
  public.summer_begin_nutrition_generation()
  from public, anon;
grant execute on function public.summer_get_nutrition_access(),
  public.summer_begin_nutrition_generation()
  to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update on public.summer_nutrition_generations to service_role';
    execute 'grant usage, select on sequence public.summer_nutrition_generations_id_seq to service_role';
    execute 'grant select, insert on public.summer_meal_plans to service_role';
    execute 'grant usage, select on sequence public.summer_meal_plans_id_seq to service_role';
  end if;
end $$;

revoke all on function public.summer_has_pro_access(),
  public.summer_has_paid_access()
  from public, anon;
grant execute on function public.summer_has_pro_access(),
  public.summer_has_paid_access()
  to authenticated;

commit;
