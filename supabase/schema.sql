create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  data jsonb not null,
  status text not null check (status in ('active', 'hidden')),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id text primary key,
  data jsonb not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id text primary key,
  data jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  id integer primary key check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.reviews enable row level security;
alter table public.store_settings enable row level security;

drop policy if exists "admins can read their own admin record" on public.admin_users;
drop policy if exists "public can read active products and admins can read all" on public.products;
drop policy if exists "admins can insert products" on public.products;
drop policy if exists "admins can update products" on public.products;
drop policy if exists "admins can delete products" on public.products;
drop policy if exists "public can submit orders" on public.orders;
drop policy if exists "admins can read orders" on public.orders;
drop policy if exists "admins can update orders" on public.orders;
drop policy if exists "public can read approved reviews and admins can read all" on public.reviews;
drop policy if exists "public can submit pending reviews" on public.reviews;
drop policy if exists "admins can update reviews" on public.reviews;
drop policy if exists "public can read store settings" on public.store_settings;
drop policy if exists "admins can insert store settings" on public.store_settings;
drop policy if exists "admins can update store settings" on public.store_settings;
drop policy if exists "public can view store images" on storage.objects;
drop policy if exists "admins can upload store images" on storage.objects;
drop policy if exists "admins can update store images" on storage.objects;
drop policy if exists "admins can delete store images" on storage.objects;

create policy "admins can read their own admin record"
  on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()));

create policy "public can read active products and admins can read all"
  on public.products for select to anon, authenticated
  using (status = 'active' or (select public.is_store_admin()));
create policy "admins can insert products"
  on public.products for insert to authenticated
  with check ((select public.is_store_admin()));
create policy "admins can update products"
  on public.products for update to authenticated
  using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));
create policy "admins can delete products"
  on public.products for delete to authenticated
  using ((select public.is_store_admin()));

create policy "public can submit orders"
  on public.orders for insert to anon, authenticated
  with check (
    jsonb_typeof(data) = 'object'
    and data->>'id' = id
    and data->>'status' = 'new'
    and length(trim(coalesce(data->>'customerName', ''))) > 1
    and length(trim(coalesce(data->>'phone', ''))) >= 7
    and jsonb_typeof(data->'items') = 'array'
  );
create policy "admins can read orders"
  on public.orders for select to authenticated
  using ((select public.is_store_admin()));
create policy "admins can update orders"
  on public.orders for update to authenticated
  using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));

create policy "public can read approved reviews and admins can read all"
  on public.reviews for select to anon, authenticated
  using (status = 'approved' or (select public.is_store_admin()));
create policy "public can submit pending reviews"
  on public.reviews for insert to anon, authenticated
  with check (
    status = 'pending'
    and data->>'status' = 'pending'
    and length(trim(coalesce(data->>'name', ''))) > 1
    and length(trim(coalesce(data->>'comment', ''))) > 2
    and data->>'rating' ~ '^[1-5]$'
  );
create policy "admins can update reviews"
  on public.reviews for update to authenticated
  using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));

create policy "public can read store settings"
  on public.store_settings for select to anon, authenticated
  using (id = 1);
create policy "admins can insert store settings"
  on public.store_settings for insert to authenticated
  with check (id = 1 and (select public.is_store_admin()));
create policy "admins can update store settings"
  on public.store_settings for update to authenticated
  using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));

insert into storage.buckets (id, name, public)
values ('store-images', 'store-images', true)
on conflict (id) do update set public = excluded.public;

create policy "public can view store images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'store-images');
create policy "admins can upload store images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'store-images' and (select public.is_store_admin()));
create policy "admins can update store images"
  on storage.objects for update to authenticated
  using (bucket_id = 'store-images' and (select public.is_store_admin()))
  with check (bucket_id = 'store-images' and (select public.is_store_admin()));
create policy "admins can delete store images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'store-images' and (select public.is_store_admin()));

grant usage on schema public to anon, authenticated;
grant select on public.products, public.reviews, public.store_settings to anon, authenticated;
grant insert on public.orders, public.reviews to anon, authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, update on public.orders to authenticated;
grant select, update on public.reviews to authenticated;
grant select, insert, update on public.store_settings to authenticated;
grant select on public.admin_users to authenticated;
grant execute on function public.is_store_admin() to anon, authenticated;
