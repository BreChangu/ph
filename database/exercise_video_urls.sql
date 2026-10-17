-- Ejecuta este script una vez en el SQL Editor de Supabase.
-- Permite al coach asociar un video de referencia a cada ejercicio.
alter table public.ejercicios
  add column if not exists video_url text;
