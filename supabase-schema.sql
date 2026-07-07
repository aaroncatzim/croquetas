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
