create table if not exists public.service_packages (
  id text primary key,
  title text not null,
  subtitle text not null default '',
  description text not null default '',
  image_url text not null default '',
  badge text not null default 'Paquete',
  includes text[] not null default '{}',
  cta_label text not null default 'Cotizar paquete',
  featured boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.service_packages enable row level security;

drop policy if exists "Public can read published service packages" on public.service_packages;
create policy "Public can read published service packages"
on public.service_packages
for select
using (published = true);

drop policy if exists "Admins can manage service packages" on public.service_packages;
create policy "Admins can manage service packages"
on public.service_packages
for all
using (
  exists (
    select 1
    from public.perfiles
    where perfiles.id = auth.uid()
      and perfiles.rol = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.perfiles
    where perfiles.id = auth.uid()
      and perfiles.rol = 'admin'
  )
);
