// Runs the MarketMatch schema on an in-memory Postgres with Supabase-like stubs,
// then walks through the whole buyer ↔ shop flow as different users.
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const fs = require('fs');

const ROOT = require('path').join(__dirname, '..');
const B = '11111111-1111-1111-1111-111111111111';
const S1 = '22222222-2222-2222-2222-222222222222';
const S2 = '33333333-3333-3333-3333-333333333333';

const stubs = `
create role authenticated nologin; create role anon nologin;
grant usage on schema public to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant all on sequences to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;
create schema auth;
grant usage on schema auth to authenticated;
create table auth.users (id uuid primary key, phone text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select 'authenticated' $$;
grant execute on function auth.uid(), auth.role() to authenticated;
create schema storage;
grant usage on schema storage to authenticated;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant execute on function storage.foldername(text) to authenticated;
create publication supabase_realtime;
`;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } }

(async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(stubs);
  let schema = fs.readFileSync(`${ROOT}/migrations/0001_schema.sql`, 'utf8');
  schema = schema.replace(/create extension if not exists pg_cron;[\s\S]*$/, ''); // pg_cron isn't in PGlite
  await db.exec(schema);
  await db.exec(fs.readFileSync(`${ROOT}/seed.sql`, 'utf8'));
  await db.exec(fs.readFileSync(`${ROOT}/seed.sql`, 'utf8')); // seed is re-runnable
  console.log('Schema + seed applied');

  const as = async (uid, sql, params = []) => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`);
    try { return await db.query(sql, params); } finally { await db.exec('reset role;'); }
  };
  const fails = async (uid, sql, params = []) => { try { await as(uid, sql, params); return false; } catch (e) { return e.message; } };

  await db.exec(`insert into auth.users (id, phone) values ('${B}', '+923001111111'), ('${S1}', '+923002222222'), ('${S2}', '+923003333333');`);
  ok((await db.query('select count(*)::int n from profiles')).rows[0].n === 3, 'profiles auto-created on sign-up');

  const market = (await as(B, 'select id from markets')).rows[0].id;
  const model = (await as(B, `select id from device_models where model = 'iPhone 14 Pro'`)).rows[0].id;
  ok(!!market && !!model, 'signed-in users can read markets and the phone catalogue');

  await as(B, `update profiles set full_name = 'Usman', role = 'buyer' where id = $1`, [B]);
  ok(!!(await fails(B, `update profiles set role = 'admin' where id = $1`, [B])), 'buyer cannot make themselves admin');

  await as(S1, `update profiles set full_name = 'Ali', role = 'shopkeeper' where id = $1`, [S1]);
  const shop = (await as(S1, `insert into shops (owner_id, market_id, name, floor_label, stall_number, directions) values ($1, $2, 'Al-Madina Mobiles', '2nd floor', '214', '{"Escalator to 2nd floor","Turn right"}') returning id`, [S1, market])).rows[0].id;
  ok(!!shop, 'shopkeeper creates their shop');
  ok(!!(await fails(S1, `update shops set is_verified = true where id = $1`, [shop])), 'shop cannot verify itself');
  ok(!!(await fails(S1, `insert into shops (owner_id, market_id, name, floor_label, stall_number) values ($1, $2, 'Fake', 'G', '1')`, [S2, market])), 'cannot create a shop for someone else');
  const qr = (await as(S1, 'select my_shop_qr() q')).rows[0].q;
  ok(qr.startsWith('marketmatch:' + shop), 'shop can read its own QR code');
  ok((await as(B, 'select * from shop_secrets')).rows.length === 0, 'buyer cannot read QR secrets');

  const stockId = (await as(S1, `insert into stock_items (shop_id, device_model_id, storage_gb, condition, battery_health, pta_status, price) values ($1, $2, 256, 'a', 89, 'non_pta', 198000) returning id`, [shop, model])).rows[0].id;
  ok((await as(B, 'select * from stock_items')).rows.length === 0, "buyer cannot see a shop's stock");

  const reqId = (await as(B, `insert into requests (buyer_id, market_id, device_model_id, storage_gb, color, budget_min, budget_max, expires_at) values ($1, $2, $3, 256, 'Deep Purple', 180000, 220000, now() + interval '30 minutes') returning id`, [B, market, model])).rows[0].id;
  ok(!!reqId, 'buyer posts a request');
  ok(!!(await fails(B, `insert into requests (buyer_id, market_id, device_model_id, storage_gb, budget_min, budget_max, expires_at) values ($1, $2, $3, 256, 1, 2, now() + interval '5 hours')`, [B, market, model])), 'request cannot stay open more than 60 minutes');
  ok((await as(S1, 'select id from requests')).rows.length === 1, 'shop in the same market sees the request');
  ok((await as(S2, 'select id from requests')).rows.length === 0, 'user without a shop does not see requests');

  ok(!!(await fails(S2, `insert into offers (request_id, shop_id, price, condition, pta_status, photo_path) values ($1, $2, 1, 'a', 'non_pta', 'x')`, [reqId, shop])), "cannot send an offer as another shop");
  const offerId = (await as(S1, `insert into offers (request_id, shop_id, stock_item_id, price, condition, battery_health, pta_status, photo_path) values ($1, $2, $4, 198000, 'a', 89, 'non_pta', $3) returning id`, [reqId, shop, shop + '/p.jpg', stockId])).rows[0].id;
  ok(!!offerId, 'shop sends an offer');
  ok(!!(await fails(S1, `insert into offers (request_id, shop_id, price, condition, pta_status, photo_path) values ($1, $2, 1, 'a', 'non_pta', 'x')`, [reqId, shop])), 'one offer per shop per request');
  ok(!!(await fails(S1, `update offers set status = 'accepted' where id = $1`, [offerId])), 'shop cannot mark its own offer accepted');
  ok((await as(B, 'select id from offers')).rows.length === 1, 'buyer sees the offer');
  ok((await fails(S1, `update offers set price = 197000 where id = $1`, [offerId])) === false, 'shop can change its price');
  ok((await as(S2, 'select id from offers')).rows.length === 0, 'others do not see the offer');

  const up = await fails(S1, `insert into storage.objects (bucket_id, name) values ('offer-photos', $1)`, [shop + '/a.jpg']);
  ok(up === false, 'shop uploads a photo into its own folder');
  ok(!!(await fails(S1, `insert into storage.objects (bucket_id, name) values ('offer-photos', 'someone-else/a.jpg')`)), 'shop cannot upload into another folder');

  ok(!!(await fails(S2, 'select accept_offer($1)', [offerId])), 'only the buyer can accept');
  const visitId = (await as(B, 'select accept_offer($1) v', [offerId])).rows[0].v;
  ok(!!visitId, 'buyer accepts → visit created');
  const off = (await db.query('select status, hold_until > now() held from offers where id = $1', [offerId])).rows[0];
  ok(off.status === 'accepted' && off.held, 'offer is held for the buyer');
  ok((await as(S1, 'select full_name from profiles where id = $1', [B])).rows[0]?.full_name === 'Usman', 'shop can see the visiting buyer');
  ok((await as(S2, 'select full_name from profiles where id = $1', [B])).rows.length === 0, 'strangers cannot see the buyer');

  ok(!!(await fails(B, 'insert into reviews (visit_id, buyer_id, shop_id, rating) values ($1, $2, $3, 5)', [visitId, B, shop])), 'no review before QR confirmation');
  ok(!!(await fails(B, 'select confirm_visit($1, $2)', [visitId, 'marketmatch:wrong'])), 'wrong QR is rejected');
  await as(B, 'select confirm_visit($1, $2)', [visitId, qr]);
  ok(!!(await db.query('select confirmed_at from visits where id = $1', [visitId])).rows[0].confirmed_at, 'right QR confirms the visit');

  await as(S1, `select set_shop_outcome($1, 'sold', 198000)`, [visitId]);
  ok((await db.query('select status from requests where id = $1', [reqId])).rows[0].status === 'fulfilled', 'marking sold fulfils the request');
  ok((await db.query('select is_available from stock_items where shop_id = $1', [shop])).rows[0].is_available === false, 'sold phone leaves stock');

  await as(B, 'insert into reviews (visit_id, buyer_id, shop_id, rating, accurate) values ($1, $2, $3, 5, true)', [visitId, B, shop]);
  const sh = (await db.query('select rating_avg::float r, rating_count n from shops where id = $1', [shop])).rows[0];
  ok(sh.r === 5 && sh.n === 1, 'review updates the shop rating');
  ok(!!(await fails(B, 'insert into reviews (visit_id, buyer_id, shop_id, rating) values ($1, $2, $3, 1)', [visitId, B, shop])), 'only one review per visit');

  await db.exec(`update requests set expires_at = now() - interval '1 minute', status = 'active' where id = '${reqId}'`);
  await as(B, 'select expire_old_requests()');
  ok((await db.query('select status from requests where id = $1', [reqId])).rows[0].status === 'expired', 'old requests expire');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
