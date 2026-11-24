-- Esquema de la nube (Supabase) para la app Voluntarios.
-- Se puede ejecutar varias veces sin problema (SQL Editor → Run).
--
-- Una sola tabla guarda todos los registros de la app como JSON: cada fila es un registro de
-- una tabla local (voluntarios, congregaciones, …). La app trabaja sin internet sobre su copia
-- local y sincroniza con esta tabla cuando hay conexión.

create table if not exists public.registros (
  tabla          text        not null check (tabla in (
                   'proyecto', 'congregaciones', 'voluntarios', 'tareas', 'dias',
                   'programaciones', 'asistencias', 'plantillas')),
  id             text        not null,
  datos          jsonb,
  borrado        boolean     not null default false,
  actualizado_en timestamptz not null default clock_timestamp(),
  primary key (tabla, id)
);

create index if not exists registros_actualizado_en_idx on public.registros (actualizado_en);

-- La hora de cada cambio la pone el servidor (no el reloj de cada celular).
create or replace function public.registros_marcar_actualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := clock_timestamp();
  return new;
end
$$;

drop trigger if exists registros_marcar_actualizado on public.registros;
create trigger registros_marcar_actualizado
  before insert or update on public.registros
  for each row execute function public.registros_marcar_actualizado();

-- Historial: guarda la versión anterior de cada registro que cambia o se borra.
-- La app no puede leerlo ni modificarlo (sin políticas RLS); sirve para recuperar datos
-- desde el panel de Supabase si alguien borra algo por error.
create table if not exists public.registros_historial (
  n              bigint generated always as identity primary key,
  tabla          text        not null,
  id             text        not null,
  datos          jsonb,
  borrado        boolean     not null,
  actualizado_en timestamptz not null,
  reemplazado_en timestamptz not null default now()
);

create index if not exists registros_historial_registro_idx on public.registros_historial (tabla, id);

alter table public.registros_historial enable row level security;

create or replace function public.registros_guardar_historial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.datos is distinct from new.datos or old.borrado is distinct from new.borrado then
    insert into public.registros_historial (tabla, id, datos, borrado, actualizado_en)
    values (old.tabla, old.id, old.datos, old.borrado, old.actualizado_en);
  end if;
  return new;
end
$$;

drop trigger if exists registros_guardar_historial on public.registros;
create trigger registros_guardar_historial
  after update on public.registros
  for each row execute function public.registros_guardar_historial();

-- Acceso de la app (sin inicio de sesión): leer, crear y actualizar. No puede borrar filas:
-- los borrados se marcan con borrado = true para que los demás dispositivos se enteren.
alter table public.registros enable row level security;

drop policy if exists "app lee" on public.registros;
create policy "app lee" on public.registros
  for select to anon, authenticated using (true);

drop policy if exists "app crea" on public.registros;
create policy "app crea" on public.registros
  for insert to anon, authenticated with check (true);

drop policy if exists "app actualiza" on public.registros;
create policy "app actualiza" on public.registros
  for update to anon, authenticated using (true) with check (true);

revoke all on public.registros from anon, authenticated;
grant select, insert, update on public.registros to anon, authenticated;
revoke all on public.registros_historial from anon, authenticated;

-- Avisos en tiempo real: cuando un dispositivo guarda, los demás se enteran al instante.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'registros'
  ) then
    alter publication supabase_realtime add table public.registros;
  end if;
end
$$;
