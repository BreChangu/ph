-- Referencia: definición de registros_carga tal como existe en Supabase.
-- La tabla YA EXISTE en producción; este archivo documenta su estructura.
-- Guarda el peso que usa el paciente en cada ejercicio: uno por ejercicio y día, siempre en kg.
--
-- Importante para la app:
-- - ejercicio_clave es una columna generada: la app NO debe enviarla al insertar.
-- - claveEjercicio() en progreso.utils.ts debe dar lo mismo que lower(btrim(ejercicio)).
-- - No hay llave foránea a ejercicios: al editar la rutina se recrean los ejercicios
--   y el historial se perdería. Se agrupa por ejercicio_clave.
--
-- No incluido aquí (existe en Supabase): la función registros_carga_antes_de_actualizar()
-- y las 4 políticas RLS de la tabla.

create table public.registros_carga (
  id uuid not null default gen_random_uuid (),
  id_perfil uuid not null,
  ejercicio text not null,
  ejercicio_clave text generated always as (lower(btrim(ejercicio))) stored null,
  fecha date not null default ((now() at time zone 'America/Mexico_City'::text))::date,
  peso_kg numeric(7, 3) not null,
  unidad_captura text not null default 'kg'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint registros_carga_pkey primary key (id),
  constraint registros_carga_unico_por_dia unique (id_perfil, ejercicio_clave, fecha),
  constraint registros_carga_id_perfil_fkey foreign key (id_perfil) references perfiles (id) on delete restrict,
  constraint registros_carga_ejercicio check (
    (btrim(ejercicio) <> ''::text) and (char_length(ejercicio) <= 200)
  ),
  constraint registros_carga_peso check (
    (peso_kg > (0)::numeric) and (peso_kg < (1000)::numeric)
  ),
  constraint registros_carga_unidad check (
    unidad_captura = any (array['kg'::text, 'lb'::text])
  )
) tablespace pg_default;

create trigger registros_carga_antes_update before
update on registros_carga for each row
execute function registros_carga_antes_de_actualizar ();
