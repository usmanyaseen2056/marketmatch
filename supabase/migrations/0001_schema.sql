-- =====================================================================
-- MarketMatch — database schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run
-- (or `supabase db push` if you use the Supabase CLI)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Types ----------------------------------------------------

create type public.user_role      as enum ('buyer', 'shopkeeper', 'admin');
create type public.pta_status     as enum ('pta_approved', 'non_pta');
create type public.pta_pref       as enum ('pta_approved', 'non_pta', 'any');
create type public.device_cond    as enum ('new', 'a_plus', 'a', 'b', 'c');
create type public.cond_pref      as enum ('new', 'used', 'any');
create type public.request_status as enum ('active', 'fulfilled', 'expired', 'cancelled');
create type public.offer_status   as enum ('sent', 'accepted', 'declined', 'withdrawn');

-- ---------- Tables ---------------------------------------------------

create table public.markets (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  city       text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  phone      text,
  role       public.user_role,
  created_at timestamptz not null default now()
);

create table public.shops (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null unique references public.profiles (id) on delete cascade,
  market_id    uuid not null references public.markets (id),
  name         text not null check (char_length(name) between 2 and 80),
  floor_label  text not null,                 -- "Ground", "1st floor", "Basement"
  wing         text,                          -- "East", "Block B"
  stall_number text not null,
  landmark     text,                          -- "Right of escalator near Gate 2"
  directions   text[] not null default '{}',  -- step-by-step walking directions
  phone        text,
  is_verified  boolean not null default false, -- set by admin only
  is_online    boolean not null default true,
  rating_avg   numeric(3, 2) not null default 0,
  rating_count int not null default 0,
  created_at   timestamptz not null default now()
);

-- The QR code secret lives in its own table so buyers can never read it.
create table public.shop_secrets (
  shop_id   uuid primary key references public.shops (id) on delete cascade,
  qr_secret text not null default encode(gen_random_bytes(12), 'hex')
);

create table public.device_models (
  id              uuid primary key default gen_random_uuid(),
  brand           text not null,
  model           text not null,
  storage_options int[] not null default '{}',   -- in GB, 1024 = 1TB
  colors          text[] not null default '{}',
  sort_order      int not null default 100,
  unique (brand, model)
);

create table public.stock_items (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops (id) on delete cascade,
  device_model_id uuid not null references public.device_models (id),
  storage_gb      int not null check (storage_gb > 0),
  color           text,
  condition       public.device_cond not null,
  battery_health  int check (battery_health between 1 and 100),
  pta_status      public.pta_status not null,
  price           int not null check (price > 0),
  in_box          text,
  notes           text,
  is_available    boolean not null default true,
  created_at      timestamptz not null default now()
);

create table public.requests (
  id              uuid primary key default gen_random_uuid(),
  buyer_id        uuid not null references public.profiles (id) on delete cascade,
  market_id       uuid not null references public.markets (id),
  device_model_id uuid not null references public.device_models (id),
  storage_gb      int not null check (storage_gb > 0),
  color           text,                        -- null = any colour
  pta_pref        public.pta_pref not null default 'any',
  condition_pref  public.cond_pref not null default 'any',
  min_battery     int not null default 0 check (min_battery between 0 and 100),
  budget_min      int not null check (budget_min >= 0),
  budget_max      int not null,
  status          public.request_status not null default 'active',
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now(),
  check (budget_max >= budget_min),
  check (expires_at <= created_at + interval '60 minutes')
);

create table public.offers (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.requests (id) on delete cascade,
  shop_id        uuid not null references public.shops (id) on delete cascade,
  stock_item_id  uuid references public.stock_items (id) on delete set null,
  price          int not null check (price > 0),
  condition      public.device_cond not null,
  battery_health int check (battery_health between 1 and 100),
  pta_status     public.pta_status not null,
  in_box         text,
  notes          text,
  photo_path     text not null,                -- a live photo is required
  status         public.offer_status not null default 'sent',
  hold_until     timestamptz,
  created_at     timestamptz not null default now(),
  unique (request_id, shop_id)                 -- one offer per shop per request
);

create table public.visits (
  id            uuid primary key default gen_random_uuid(),
  offer_id      uuid not null unique references public.offers (id) on delete cascade,
  request_id    uuid not null references public.requests (id) on delete cascade,
  buyer_id      uuid not null references public.profiles (id) on delete cascade,
  shop_id       uuid not null references public.shops (id) on delete cascade,
  confirmed_at  timestamptz,                    -- set when buyer scans the shop QR
  shop_outcome  text check (shop_outcome in ('sold', 'no_sale')),
  buyer_outcome text check (buyer_outcome in ('bought', 'not_bought')),
  final_price   int,
  created_at    timestamptz not null default now()
);

create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  visit_id   uuid not null unique references public.visits (id) on delete cascade,
  buyer_id   uuid not null references public.profiles (id) on delete cascade,
  shop_id    uuid not null references public.shops (id) on delete cascade,
  rating     int not null check (rating between 1 and 5),
  accurate   boolean not null default true,    -- "phone matched the offer"
  comment    text check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);

create table public.push_tokens (
  token      text primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  updated_at timestamptz not null default now()
);

-- ---------- Indexes --------------------------------------------------

create index on public.shops (market_id);
create index on public.stock_items (shop_id);
create index on public.stock_items (device_model_id, storage_gb) where is_available;
create index on public.requests (market_id, status, expires_at);
create index on public.requests (buyer_id, created_at desc);
create index on public.offers (request_id);
create index on public.offers (shop_id, created_at desc);
create index on public.visits (shop_id, created_at desc);
create index on public.visits (buyer_id, created_at desc);
create index on public.push_tokens (user_id);

-- ---------- Helper functions ----------------------------------------

-- The shop owned by the signed-in user (or null).
create or replace function public.my_shop_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from shops where owner_id = auth.uid()
$$;

-- New sign-ups get a profile row automatically.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, phone) values (new.id, new.phone)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Every shop gets a QR secret.
create or replace function public.handle_new_shop()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into shop_secrets (shop_id) values (new.id) on conflict do nothing;
  update profiles set role = 'shopkeeper' where id = new.owner_id;
  return new;
end $$;

create trigger on_shop_created
  after insert on public.shops
  for each row execute function public.handle_new_shop();

-- Mark requests past their time as expired (called by cron and by the app).
create or replace function public.expire_old_requests()
returns void language sql security definer set search_path = public as $$
  update requests set status = 'expired'
  where status = 'active' and expires_at < now();
$$;

-- ---------- Actions (RPCs the app calls) ----------------------------

-- Buyer picks an offer: the shop holds the phone for 20 minutes.
create or replace function public.accept_offer(p_offer_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_offer offers;
  v_req   requests;
  v_visit uuid;
begin
  select * into v_offer from offers where id = p_offer_id;
  if not found then raise exception 'Offer not found'; end if;

  select * into v_req from requests where id = v_offer.request_id;
  if v_req.buyer_id <> auth.uid() then raise exception 'Not your request'; end if;
  if v_req.status <> 'active' then raise exception 'This request is no longer active'; end if;
  if v_offer.status <> 'sent' then raise exception 'This offer is no longer available'; end if;

  -- Only one accepted offer at a time: release any earlier pick.
  update offers set status = 'sent', hold_until = null
   where request_id = v_req.id and status = 'accepted';
  delete from visits where request_id = v_req.id and confirmed_at is null;

  update offers
     set status = 'accepted', hold_until = now() + interval '20 minutes'
   where id = p_offer_id;

  insert into visits (offer_id, request_id, buyer_id, shop_id)
  values (p_offer_id, v_req.id, v_req.buyer_id, v_offer.shop_id)
  returning id into v_visit;

  return v_visit;
end $$;

-- Buyer scans the QR at the counter. Proves the visit really happened.
create or replace function public.confirm_visit(p_visit_id uuid, p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_visit visits;
  v_secret text;
begin
  select * into v_visit from visits where id = p_visit_id;
  if not found or v_visit.buyer_id <> auth.uid() then raise exception 'Visit not found'; end if;

  select qr_secret into v_secret from shop_secrets where shop_id = v_visit.shop_id;
  -- QR content is "marketmatch:<shop_id>:<secret>"
  if p_code <> ('marketmatch:' || v_visit.shop_id::text || ':' || v_secret) then
    raise exception 'This QR code belongs to a different shop';
  end if;

  update visits set confirmed_at = coalesce(confirmed_at, now()) where id = p_visit_id;
  return true;
end $$;

-- Shopkeeper reads their own QR content to show on screen.
create or replace function public.my_shop_qr()
returns text language sql stable security definer set search_path = public as $$
  select 'marketmatch:' || s.id::text || ':' || ss.qr_secret
    from shops s join shop_secrets ss on ss.shop_id = s.id
   where s.owner_id = auth.uid()
$$;

-- Shopkeeper closes the visit: sold or not.
create or replace function public.set_shop_outcome(p_visit_id uuid, p_outcome text, p_final_price int default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_visit visits;
begin
  select * into v_visit from visits where id = p_visit_id;
  if not found or v_visit.shop_id <> my_shop_id() then raise exception 'Visit not found'; end if;
  if p_outcome not in ('sold', 'no_sale') then raise exception 'Invalid outcome'; end if;

  update visits set shop_outcome = p_outcome, final_price = coalesce(p_final_price, final_price)
   where id = p_visit_id;

  if p_outcome = 'sold' then
    update requests set status = 'fulfilled' where id = v_visit.request_id;
    update stock_items set is_available = false
     where id = (select stock_item_id from offers where id = v_visit.offer_id);
  else
    update offers set status = 'declined', hold_until = null where id = v_visit.offer_id;
  end if;
end $$;

-- Buyer closes the visit from their side.
create or replace function public.set_buyer_outcome(p_visit_id uuid, p_outcome text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_visit visits;
begin
  select * into v_visit from visits where id = p_visit_id;
  if not found or v_visit.buyer_id <> auth.uid() then raise exception 'Visit not found'; end if;
  if p_outcome not in ('bought', 'not_bought') then raise exception 'Invalid outcome'; end if;

  update visits set buyer_outcome = p_outcome where id = p_visit_id;
  if p_outcome = 'bought' then
    update requests set status = 'fulfilled' where id = v_visit.request_id;
  else
    update offers set status = 'declined', hold_until = null where id = v_visit.offer_id;
  end if;
end $$;

-- Keep shop ratings up to date.
create or replace function public.refresh_shop_rating()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update shops s set
    rating_avg   = coalesce((select round(avg(rating)::numeric, 2) from reviews where shop_id = s.id), 0),
    rating_count = (select count(*) from reviews where shop_id = s.id)
  where s.id = new.shop_id;
  return new;
end $$;

create trigger on_review_added
  after insert on public.reviews
  for each row execute function public.refresh_shop_rating();

-- ---------- Row Level Security -------------------------------------

alter table public.markets       enable row level security;
alter table public.profiles      enable row level security;
alter table public.shops         enable row level security;
alter table public.shop_secrets  enable row level security;
alter table public.device_models enable row level security;
alter table public.stock_items   enable row level security;
alter table public.requests      enable row level security;
alter table public.offers        enable row level security;
alter table public.visits        enable row level security;
alter table public.reviews       enable row level security;
alter table public.push_tokens   enable row level security;

-- Reference data: anyone signed in can read.
create policy "read markets" on public.markets for select to authenticated using (true);
create policy "read models"  on public.device_models for select to authenticated using (true);

-- Profiles: you see yourself, and a shop sees buyers who are visiting it.
create policy "own profile" on public.profiles for select to authenticated
  using (id = auth.uid()
         or exists (select 1 from visits v where v.buyer_id = profiles.id and v.shop_id = my_shop_id()));
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Users may change their name and pick buyer/shopkeeper, never admin.
revoke update on public.profiles from authenticated;
grant update (full_name, role) on public.profiles to authenticated;
create or replace function public.block_admin_role()
returns trigger language plpgsql as $$
begin
  if new.role = 'admin' and old.role is distinct from 'admin' and current_user = 'authenticated' then
    raise exception 'Not allowed';
  end if;
  return new;
end $$;
create trigger no_self_admin before update on public.profiles
  for each row execute function public.block_admin_role();

-- Shops: public listing; owner edits their own details only.
create policy "read shops" on public.shops for select to authenticated using (true);
create policy "create own shop" on public.shops for insert to authenticated with check (owner_id = auth.uid());
create policy "update own shop" on public.shops for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
revoke update on public.shops from authenticated;
grant update (name, floor_label, wing, stall_number, landmark, directions, phone, is_online) on public.shops to authenticated;
revoke insert on public.shops from authenticated;
grant insert (owner_id, market_id, name, floor_label, wing, stall_number, landmark, directions, phone) on public.shops to authenticated;

-- shop_secrets: no policies = nobody reads it directly (only the functions above).

-- Stock: private to the shop.
create policy "own stock" on public.stock_items for all to authenticated
  using (shop_id = my_shop_id()) with check (shop_id = my_shop_id());

-- Requests: the buyer sees their own; shops see requests in their market.
create policy "buyer reads own requests" on public.requests for select to authenticated
  using (buyer_id = auth.uid()
         or market_id = (select market_id from shops where id = my_shop_id()));
create policy "buyer creates request" on public.requests for insert to authenticated
  with check (buyer_id = auth.uid() and status = 'active' and expires_at > now());
create policy "buyer cancels request" on public.requests for update to authenticated
  using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());
revoke update on public.requests from authenticated;
grant update (status) on public.requests to authenticated;

-- Offers: the buyer of the request and the shop that sent it.
create policy "read offers" on public.offers for select to authenticated
  using (shop_id = my_shop_id()
         or exists (select 1 from requests r where r.id = offers.request_id and r.buyer_id = auth.uid()));
create policy "shop sends offer" on public.offers for insert to authenticated
  with check (
    shop_id = my_shop_id()
    and status = 'sent'
    and exists (
      select 1 from requests r join shops s on s.id = my_shop_id()
       where r.id = offers.request_id and r.status = 'active' and r.expires_at > now()
         and r.market_id = s.market_id
    )
  );
create policy "shop edits own offer" on public.offers for update to authenticated
  using (shop_id = my_shop_id()) with check (shop_id = my_shop_id());
revoke update on public.offers from authenticated;
grant update (price, notes, status) on public.offers to authenticated;
create or replace function public.guard_offer_status()
returns trigger language plpgsql as $$
begin
  -- From the app a shop may only withdraw; accept/decline go through the RPCs above
  -- (those run as the function owner, so current_user is not 'authenticated' there).
  if current_user = 'authenticated' and new.status is distinct from old.status and new.status <> 'withdrawn' then
    raise exception 'Not allowed';
  end if;
  return new;
end $$;
create trigger guard_offer_status before update on public.offers
  for each row execute function public.guard_offer_status();

-- Visits: buyer and shop can read; changes go through RPCs only.
create policy "read visits" on public.visits for select to authenticated
  using (buyer_id = auth.uid() or shop_id = my_shop_id());

-- Reviews: public; only after a QR-confirmed visit, once per visit.
create policy "read reviews" on public.reviews for select to authenticated using (true);
create policy "review confirmed visit" on public.reviews for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and exists (select 1 from visits v
                 where v.id = reviews.visit_id and v.buyer_id = auth.uid()
                   and v.shop_id = reviews.shop_id and v.confirmed_at is not null)
  );

-- Push tokens: your own only.
create policy "own tokens" on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Realtime -------------------------------------------------

alter publication supabase_realtime add table public.requests, public.offers, public.visits;

-- ---------- Storage: live offer photos ------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('offer-photos', 'offer-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Shops upload into a folder named after their shop id.
create policy "shop uploads photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'offer-photos' and (storage.foldername(name))[1] = my_shop_id()::text);

-- ---------- Expire requests every minute (pg_cron) ------------------

create extension if not exists pg_cron;
select cron.schedule('expire-requests', '* * * * *', $$select public.expire_old_requests()$$);
