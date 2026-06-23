create table if not exists public.blog_posts (
  id text primary key,
  title text not null,
  excerpt text not null,
  content text not null,
  cover_image text,
  published_at timestamptz default now(),
  category text default 'Nutricion',
  read_time text default '4 min',
  author text default 'Pablo Herrera',
  published boolean default false,
  featured boolean default false,
  updated_at timestamptz default now()
);

alter table public.blog_posts enable row level security;

drop policy if exists "Public can read published blog posts" on public.blog_posts;
create policy "Public can read published blog posts"
on public.blog_posts
for select
using (published = true);

drop policy if exists "Admins can manage blog posts" on public.blog_posts;
create policy "Admins can manage blog posts"
on public.blog_posts
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
