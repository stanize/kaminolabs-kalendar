-- ============================================================================
-- Kalendar — esquema de base de datos (solo alcance de onboarding)
-- ============================================================================
-- Cómo usarlo:
--   1. Crea un proyecto nuevo en Supabase (dedicado a Kalendar).
--   2. Ve a SQL Editor → New query, pega este archivo completo y ejecútalo.
--   3. Sigue además las instrucciones de SETUP.md (Auth, Google OAuth, env vars).
-- ============================================================================

-- Necesario para gen_random_uuid()
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- profiles — extiende auth.users con los datos propios de Kalendar
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null default '',
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "El usuario puede ver su propio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "El usuario puede actualizar su propio perfil"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Crea automáticamente la fila de profiles cuando se registra un usuario nuevo
-- (cubre tanto el alta por email/contraseña como por Google OAuth).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nombre, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'nombre',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- businesses — el negocio creado durante el onboarding
-- ----------------------------------------------------------------------------
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  nombre text not null,
  tipo text not null check (
    tipo in ('psico', 'nutri', 'fisio', 'belleza', 'fitness', 'coaching', 'tutorias', 'otro')
  ),
  ciudad text,
  slug text not null unique,
  brand_color text not null default '#0d9488',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists businesses_owner_id_idx on public.businesses (owner_id);

alter table public.businesses enable row level security;

-- Las páginas de reserva públicas (kalendar.app/<slug>) necesitan leer esto sin sesión.
create policy "Lectura pública de negocios"
  on public.businesses for select
  using (true);

create policy "El propietario gestiona su negocio"
  on public.businesses for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ----------------------------------------------------------------------------
-- services — servicios reservables de cada negocio
-- ----------------------------------------------------------------------------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  nombre text not null,
  duracion_min integer not null check (duracion_min > 0),
  precio numeric(10, 2) not null default 0 check (precio >= 0),
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists services_business_id_idx on public.services (business_id);

alter table public.services enable row level security;

create policy "Lectura pública de servicios"
  on public.services for select
  using (true);

create policy "El propietario gestiona sus servicios"
  on public.services for all
  using (exists (
    select 1 from public.businesses b
    where b.id = services.business_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = services.business_id and b.owner_id = auth.uid()
  ));

-- ----------------------------------------------------------------------------
-- business_hours — disponibilidad semanal (una fila por día)
-- ----------------------------------------------------------------------------
create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  dia text not null check (dia in ('lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom')),
  activo boolean not null default false,
  hora_inicio time,
  hora_fin time,
  unique (business_id, dia)
);

create index if not exists business_hours_business_id_idx on public.business_hours (business_id);

alter table public.business_hours enable row level security;

create policy "Lectura pública de horarios"
  on public.business_hours for select
  using (true);

create policy "El propietario gestiona su horario"
  on public.business_hours for all
  using (exists (
    select 1 from public.businesses b
    where b.id = business_hours.business_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = business_hours.business_id and b.owner_id = auth.uid()
  ));

-- ----------------------------------------------------------------------------
-- team_members — personas que prestan el servicio (el propietario es una de ellas)
-- ----------------------------------------------------------------------------
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  nombre text not null,
  rol text,
  es_propietario boolean not null default false,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists team_members_business_id_idx on public.team_members (business_id);

alter table public.team_members enable row level security;

create policy "Lectura pública de equipo"
  on public.team_members for select
  using (true);

create policy "El propietario gestiona su equipo"
  on public.team_members for all
  using (exists (
    select 1 from public.businesses b
    where b.id = team_members.business_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = team_members.business_id and b.owner_id = auth.uid()
  ));

-- ============================================================================
-- Fin del esquema de onboarding.
-- Próximas tablas (fuera de este alcance): disponibilidad por excepciones,
-- reservas (bookings), notificaciones, pagos.
-- ============================================================================
