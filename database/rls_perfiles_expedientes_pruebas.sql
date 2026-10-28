-- Pruebas de rls_perfiles_expedientes.sql.
-- Copia TODO este archivo en el SQL Editor y ejecútalo de una vez.
-- No hay que reemplazar nada: toma un paciente y un coach reales de la tabla.
-- No modifica nada: cada prueba se deshace al terminar.
-- Resultado: una tabla con cada prueba y OK / FALLA.

create or replace function pg_temp.probar_rls()
returns table (prueba text, esperado text, obtenido text, resultado text)
language plpgsql
as $$
declare
  v_paciente uuid;
  v_admin uuid;
  v_total int;
  v_perfiles int;
  v_expedientes int;
  v_es_admin boolean;
  v_filas int;
  v_error text;
begin
  select p.id into v_paciente
  from public.perfiles p where p.rol = 'paciente' order by p.created_at limit 1;

  select p.id into v_admin
  from public.perfiles p join public.coaches c on c.user_id = p.id
  where p.rol = 'admin' limit 1;

  select count(*) into v_total from public.perfiles;

  -- 0. RLS activo -----------------------------------------------------
  select bool_and(c.relrowsecurity) into v_es_admin
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('perfiles', 'expedientes_clinicos');

  prueba := '0. RLS activo en perfiles y expedientes';
  esperado := 'true';
  obtenido := coalesce(v_es_admin::text, '?');
  resultado := case when v_es_admin then 'OK' else 'FALLA' end;
  return next;

  -- A. Sin sesión -----------------------------------------------------
  v_perfiles := null; v_expedientes := null; v_error := null;
  begin
    set local role anon;
    select count(*) into v_perfiles from public.perfiles;
    select count(*) into v_expedientes from public.expedientes_clinicos;
    raise exception '__fin__';
  exception when others then
    if sqlerrm <> '__fin__' then v_error := sqlerrm; end if;
  end;
  reset role;

  prueba := 'A. Sin sesión no ve perfiles ni expedientes';
  esperado := '0 y 0 (o permiso denegado)';
  obtenido := coalesce(v_error, v_perfiles || ' y ' || v_expedientes);
  resultado := case
    when v_error ilike '%permission denied%' then 'OK'
    when v_perfiles = 0 and v_expedientes = 0 then 'OK'
    else 'FALLA' end;
  return next;

  -- B. Paciente: solo lo suyo -----------------------------------------
  v_perfiles := null; v_expedientes := null; v_es_admin := null; v_error := null;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_paciente, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_paciente::text, true);
    set local role authenticated;
    select count(*) into v_perfiles from public.perfiles;
    select count(*) into v_expedientes from public.expedientes_clinicos;
    v_es_admin := public.is_admin();
    raise exception '__fin__';
  exception when others then
    if sqlerrm <> '__fin__' then v_error := sqlerrm; end if;
  end;
  reset role;

  prueba := 'B. Paciente ve solo su perfil y su expediente';
  esperado := 'perfiles 1, expedientes 0 o 1, admin false';
  obtenido := coalesce(v_error, 'perfiles ' || v_perfiles || ', expedientes ' || v_expedientes || ', admin ' || v_es_admin);
  resultado := case when v_perfiles = 1 and v_expedientes <= 1 and not v_es_admin then 'OK' else 'FALLA' end;
  return next;

  -- C. Paciente edita su nombre (onboarding) ---------------------------
  v_filas := null; v_error := null;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_paciente, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_paciente::text, true);
    set local role authenticated;
    update public.perfiles set nombre_completo = nombre_completo where id = v_paciente;
    get diagnostics v_filas = row_count;
    raise exception '__fin__';
  exception when others then
    if sqlerrm <> '__fin__' then v_error := sqlerrm; end if;
  end;
  reset role;

  prueba := 'C. Paciente puede editar su propio perfil';
  esperado := '1 fila actualizada';
  obtenido := coalesce(v_error, v_filas || ' fila(s)');
  resultado := case when v_filas = 1 then 'OK' else 'FALLA' end;
  return next;

  -- D. Paciente intenta hacerse admin ---------------------------------
  v_filas := null; v_error := null;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_paciente, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_paciente::text, true);
    set local role authenticated;
    update public.perfiles set rol = 'admin' where id = v_paciente;
    get diagnostics v_filas = row_count;
    raise exception '__fin__';
  exception when others then
    if sqlerrm <> '__fin__' then v_error := sqlerrm; end if;
  end;
  reset role;

  prueba := 'D. Paciente NO puede hacerse admin';
  esperado := 'error de permiso';
  obtenido := coalesce(v_error, v_filas || ' fila(s) actualizada(s)');
  resultado := case when v_error ilike '%No tienes permiso%' then 'OK' else 'FALLA' end;
  return next;

  -- E. Paciente intenta editar el perfil de otra persona ---------------
  v_filas := null; v_error := null;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_paciente, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_paciente::text, true);
    set local role authenticated;
    update public.perfiles set nombre_completo = nombre_completo where id = v_admin;
    get diagnostics v_filas = row_count;
    raise exception '__fin__';
  exception when others then
    if sqlerrm <> '__fin__' then v_error := sqlerrm; end if;
  end;
  reset role;

  prueba := 'E. Paciente NO puede editar perfiles ajenos';
  esperado := '0 filas';
  obtenido := coalesce(v_error, v_filas || ' fila(s)');
  resultado := case when v_filas = 0 then 'OK' else 'FALLA' end;
  return next;

  -- F. Coach ve todo y puede aprobar -----------------------------------
  v_perfiles := null; v_es_admin := null; v_filas := null; v_error := null;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_admin::text, true);
    set local role authenticated;
    select count(*) into v_perfiles from public.perfiles;
    v_es_admin := public.is_admin();
    update public.perfiles set estado_aprobacion = 'aprobado' where id = v_paciente;
    get diagnostics v_filas = row_count;
    raise exception '__fin__';
  exception when others then
    if sqlerrm <> '__fin__' then v_error := sqlerrm; end if;
  end;
  reset role;

  prueba := 'F. Coach ve todos los perfiles y puede aprobar';
  esperado := 'perfiles ' || v_total || ', admin true, 1 fila aprobada';
  obtenido := coalesce(v_error, 'perfiles ' || v_perfiles || ', admin ' || v_es_admin || ', ' || v_filas || ' fila(s)');
  resultado := case when v_perfiles = v_total and v_es_admin and v_filas = 1 then 'OK' else 'FALLA' end;
  return next;
end;
$$;

select * from pg_temp.probar_rls();
