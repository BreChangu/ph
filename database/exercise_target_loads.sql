-- Ejecuta este script una vez en el SQL Editor de Supabase.
-- Guarda la carga objetivo indicada por el coach para cada ejercicio.
alter table public.ejercicios
  add column if not exists carga_objetivo text;
