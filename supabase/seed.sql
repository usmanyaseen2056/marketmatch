-- =====================================================================
-- MarketMatch — starter data
-- Run after 0001_schema.sql. Safe to run again.
-- =====================================================================

insert into public.markets (name, city)
select 'Hafeez Centre', 'Lahore'
where not exists (select 1 from public.markets where name = 'Hafeez Centre');

-- A starter phone catalogue. Add or edit models in Table Editor → device_models.
-- storage_options is in GB (1024 = 1TB).
insert into public.device_models (brand, model, storage_options, colors, sort_order) values
  ('Apple',   'iPhone 16 Pro Max', '{256,512,1024}',   '{Black Titanium,White Titanium,Natural Titanium,Desert Titanium}', 1),
  ('Apple',   'iPhone 16 Pro',     '{128,256,512,1024}','{Black Titanium,White Titanium,Natural Titanium,Desert Titanium}', 2),
  ('Apple',   'iPhone 16',         '{128,256,512}',    '{Black,White,Pink,Teal,Ultramarine}', 3),
  ('Apple',   'iPhone 15 Pro Max', '{256,512,1024}',   '{Black Titanium,White Titanium,Blue Titanium,Natural Titanium}', 4),
  ('Apple',   'iPhone 15 Pro',     '{128,256,512,1024}','{Black Titanium,White Titanium,Blue Titanium,Natural Titanium}', 5),
  ('Apple',   'iPhone 15',         '{128,256,512}',    '{Black,Blue,Green,Yellow,Pink}', 6),
  ('Apple',   'iPhone 14 Pro Max', '{128,256,512,1024}','{Deep Purple,Space Black,Silver,Gold}', 7),
  ('Apple',   'iPhone 14 Pro',     '{128,256,512,1024}','{Deep Purple,Space Black,Silver,Gold}', 8),
  ('Apple',   'iPhone 14',         '{128,256,512}',    '{Midnight,Starlight,Purple,Blue,Red,Yellow}', 9),
  ('Apple',   'iPhone 13 Pro Max', '{128,256,512,1024}','{Graphite,Gold,Silver,Sierra Blue,Alpine Green}', 10),
  ('Apple',   'iPhone 13',         '{128,256,512}',    '{Midnight,Starlight,Blue,Pink,Green,Red}', 11),
  ('Apple',   'iPhone 12',         '{64,128,256}',     '{Black,White,Blue,Green,Purple,Red}', 12),
  ('Apple',   'iPhone 11',         '{64,128,256}',     '{Black,White,Green,Yellow,Purple,Red}', 13),
  ('Samsung', 'Galaxy S24 Ultra',  '{256,512,1024}',   '{Titanium Black,Titanium Gray,Titanium Violet,Titanium Yellow}', 20),
  ('Samsung', 'Galaxy S24',        '{128,256,512}',    '{Onyx Black,Marble Gray,Cobalt Violet,Amber Yellow}', 21),
  ('Samsung', 'Galaxy S23 Ultra',  '{256,512,1024}',   '{Phantom Black,Cream,Green,Lavender}', 22),
  ('Samsung', 'Galaxy S23',        '{128,256,512}',    '{Phantom Black,Cream,Green,Lavender}', 23),
  ('Samsung', 'Galaxy A55',        '{128,256}',        '{Awesome Navy,Awesome Iceblue,Awesome Lilac}', 24),
  ('Samsung', 'Galaxy A35',        '{128,256}',        '{Awesome Navy,Awesome Iceblue,Awesome Lilac}', 25),
  ('Infinix', 'Note 40 Pro',       '{256}',            '{Obsidian Black,Titan Gold,Vintage Green}', 30),
  ('Infinix', 'Note 40',           '{256}',            '{Obsidian Black,Titan Gold,Racing Green}', 31),
  ('Infinix', 'Hot 40i',           '{128,256}',        '{Starlit Black,Palm Blue,Horizon Gold}', 32),
  ('Xiaomi',  'Redmi Note 13 Pro', '{256,512}',        '{Midnight Black,Aurora Purple,Forest Green}', 40),
  ('Xiaomi',  'Redmi Note 13',     '{128,256}',        '{Midnight Black,Ice Blue,Mint Green}', 41),
  ('Tecno',   'Camon 30',          '{256}',            '{Basaltic Dark,Iceland Basaltic}', 50),
  ('Tecno',   'Spark 20 Pro',      '{256}',            '{Moonlit Black,Sunset Blush}', 51),
  ('Vivo',    'V30',               '{256}',            '{Noble Black,Peacock Green}', 60),
  ('Vivo',    'Y100',              '{128,256}',        '{Metal Black,Pacific Blue}', 61),
  ('Oppo',    'Reno 11',           '{256}',            '{Rock Grey,Wave Green}', 70),
  ('Google',  'Pixel 8 Pro',       '{128,256,512}',    '{Obsidian,Porcelain,Bay}', 80),
  ('Google',  'Pixel 7',           '{128,256}',        '{Obsidian,Snow,Lemongrass}', 81)
on conflict (brand, model) do nothing;
