-- Ejecuta este script una vez en el SQL Editor de Supabase.
-- Activa la seguridad por filas (RLS) en perfiles y expedientes_clinicos.
--
-- Resultado:
--   - Cada paciente solo ve y edita su propio perfil y su expediente.
--   - El coach (is_admin) ve y edita todos.
--   - Sin sesión (llave pública) no se puede leer nada de estas tablas.
--   - Nadie que no sea admin puede cambiar rol ni estado_aprobacion.
--
-- Todo corre en una transacción: si una verificación falla, no se cambia nada.
-- REVERSA (si algo deja de funcionar):
--   alter table public.perfiles disable row level security;
--   alter table public.expedientes_clinicos disable row level security;

begin;

-- ---------------------------------------------------------------------
-- 0. Verificaciones previas (abortan el script si algo no cuadra)
-- ---------------------------------------------------------------------

-- 0a. El trigger que crea el perfil al registrarse debe ser SECURITY DEFINER;
--     si no, con RLS activo los registros nuevos fallarían.
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'crear_perfil_automatico' and p.prosecdef
  ) then
    raise exception 'crear_perfil_automatico no es SECURITY DEFINER: los registros nuevos fallarían con RLS. No se cambió nada.';
  end if;
end $$;

-- 0b. Todo perfil con rol admin debe estar en coaches (is_admin lo exige);
--     si no, ese admin perdería el acceso al activar RLS.
do $$
declare
  sin_coach text;
begin
  select string_agg(coalesce(p.nombre_completo, p.id::text), ', ')
    into sin_coach
  from public.perfiles p
  left join public.coaches c on c.user_id = p.id
  where p.rol = 'admin' and c.user_id is null;

  if sin_coach is not null then
    raise exception 'Estos admins no están en coaches y perderían el acceso: %. No se cambió nada.', sin_coach;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Nadie que no sea admin cambia rol, estado_aprobacion ni id
--    (RLS controla filas, no columnas; esto lo cubre un trigger).
--    Desde el SQL Editor / service role (sin auth.uid()) sí se permite.
-- ---------------------------------------------------------------------
create or replace function public.proteger_campos_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.rol is distinct from old.rol
      or new.estado_aprobacion is distinct from old.estado_aprobacion
      or new.id is distinct from old.id)
     and (select auth.uid()) is not null
     and not public.is_admin() then
    raise exception 'No tienes permiso para cambiar el rol o el estado de aprobación.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_proteger_campos on public.perfiles;
create trigger perfiles_proteger_campos
  before update on public.perfiles
  for each row execute function public.proteger_campos_perfil();

-- ---------------------------------------------------------------------
-- 2. Políticas de perfiles
--    Sin políticas de INSERT ni DELETE: los perfiles los crea el trigger
--    crear_perfil_automatico al registrarse, y no se borran desde la app.
-- ---------------------------------------------------------------------
drop policy if exists "Pacientes actualizan su perfil" on public.perfiles;
drop policy if exists "Pacientes pueden actualizar su propio perfil" on public.perfiles;

drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

drop policy if exists perfiles_update on public.perfiles;
create policy perfiles_update on public.perfiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- ---------------------------------------------------------------------
-- 3. Políticas de expedientes_clinicos
--    El paciente crea y actualiza el suyo (onboarding y fotos usan upsert);
--    solo el coach puede borrar.
-- ---------------------------------------------------------------------
drop policy if exists "Coach tiene acceso total" on public.expedientes_clinicos;
drop policy if exists "Paciente inserta su formulario" on public.expedientes_clinicos;

drop policy if exists expedientes_select on public.expedientes_clinicos;
create policy expedientes_select on public.expedientes_clinicos
  for select to authenticated
  using (id_perfil = (select auth.uid()) or public.is_admin());

drop policy if exists expedientes_insert on public.expedientes_clinicos;
create policy expedientes_insert on public.expedientes_clinicos
  for insert to authenticated
  with check (id_perfil = (select auth.uid()) or public.is_admin());

drop policy if exists expedientes_update on public.expedientes_clinicos;
create policy expedientes_update on public.expedientes_clinicos
  for update to authenticated
  using (id_perfil = (select auth.uid()) or public.is_admin())
  with check (id_perfil = (select auth.uid()) or public.is_admin());

drop policy if exists expedientes_delete on public.expedientes_clinicos;
create policy expedientes_delete on public.expedientes_clinicos
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- 4. Activar RLS
-- ---------------------------------------------------------------------
alter table public.perfiles enable row level security;
alter table public.expedientes_clinicos enable row level security;

commit;
