-- ============================================================
-- Mascotlan POS · esquema de Supabase
-- Ejecutar en: panel de Supabase → SQL Editor → New query
-- ============================================================

-- Perfil de cada usuario (rol y nombre que muestra la app).
create table if not exists public.perfiles (
  id     uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol    text not null check (rol in ('dueno', 'cajero'))
);

alter table public.perfiles enable row level security;

create policy "leer perfil propio"
  on public.perfiles for select
  to authenticated
  using (auth.uid() = id);

-- Catálogo de productos sincronizado con la app.
create table if not exists public.productos (
  id            text primary key,
  nombre        text not null,
  categoria     text not null,
  precio        numeric not null check (precio >= 0),
  unidad        text not null check (unidad in ('pza', 'kg')),
  stock         numeric not null default 0,
  codigo_barras text,
  imagen        text,
  actualizado   timestamptz default now()
);

-- Si la tabla ya existía sin la columna de imagen, esto la agrega:
alter table public.productos add column if not exists imagen text;

alter table public.productos enable row level security;

create policy "usuarios leen productos"
  on public.productos for select
  to authenticated
  using (true);

create policy "usuarios escriben productos"
  on public.productos for insert
  to authenticated
  with check (true);

create policy "usuarios actualizan productos"
  on public.productos for update
  to authenticated
  using (true);

create policy "usuarios borran productos"
  on public.productos for delete
  to authenticated
  using (true);

-- ============================================================
-- Página pública de catálogo (catalogo.html)
-- Esta sección es idempotente: se puede ejecutar sola si las
-- tablas de arriba ya existían.
-- ============================================================

-- Datos de contacto del negocio (los edita el dueño en el Panel).
create table if not exists public.negocio (
  id          int primary key default 1 check (id = 1),
  facebook    text not null default '',
  instagram   text not null default '',
  whatsapp    text not null default '',
  telefono    text not null default '',
  actualizado timestamptz default now()
);

alter table public.negocio enable row level security;

drop policy if exists "cualquiera lee el contacto" on public.negocio;
create policy "cualquiera lee el contacto"
  on public.negocio for select
  to anon, authenticated
  using (true);

drop policy if exists "usuarios crean el contacto" on public.negocio;
create policy "usuarios crean el contacto"
  on public.negocio for insert
  to authenticated
  with check (true);

drop policy if exists "usuarios actualizan el contacto" on public.negocio;
create policy "usuarios actualizan el contacto"
  on public.negocio for update
  to authenticated
  using (true);

-- Vista pública del catálogo: solo lo que puede ver un cliente
-- (sin stock exacto ni código de barras).
create or replace view public.catalogo as
  select id, nombre, categoria, precio, unidad, imagen,
         stock > 0 as disponible
  from public.productos;

grant select on public.catalogo to anon, authenticated;

-- ============================================================
-- Después de ejecutar esto:
--
-- 1. Crea los usuarios en Authentication → Users → Add user
--    (por ejemplo: aaron@mascotlan.mx y mostrador@mascotlan.mx).
--    Marca "Auto Confirm User".
--
-- 2. Copia el UUID de cada usuario y registra su perfil:
--
--    insert into public.perfiles (id, nombre, rol) values
--      ('UUID-DEL-DUENO',   'Aarón',       'dueno'),
--      ('UUID-DEL-CAJERO',  'Mostrador 1', 'cajero');
--
-- 3. Pon la URL y la llave anon en supabase-config.js (navegador)
--    o en supabase.json dentro de la carpeta de datos (escritorio).
--
-- La primera vez que el dueño inicie sesión, la app sube su
-- catálogo local a la tabla "productos" automáticamente.
-- ============================================================
