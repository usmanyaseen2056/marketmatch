// MarketMatch push notifications (Supabase Edge Function, Deno).
//
// Called by three Database Webhooks (see README):
//   requests INSERT  → alert online shops in that market (matching stock first)
//   offers   INSERT  → tell the buyer a new offer arrived
//   offers   UPDATE  → tell the shop when a buyer picks their offer
//
// Deploy:  supabase functions deploy notify --no-verify-jwt
// Secret:  supabase secrets set WEBHOOK_SECRET=<long random string>

import { createClient } from 'npm:@supabase/supabase-js@2';

type Row = Record<string, any>;
type Payload = { type: 'INSERT' | 'UPDATE' | 'DELETE'; table: string; record: Row; old_record: Row | null };
type Push = { to: string; title: string; body: string; data?: Record<string, unknown>; sound?: 'default'; priority?: 'high'; channelId?: string };

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const rs = (n: number) => 'Rs ' + Math.round(n).toLocaleString('en-US');
const storage = (gb: number) => (gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`);

async function tokensFor(userIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!userIds.length) return map;
  const { data } = await supabase.from('push_tokens').select('token, user_id').in('user_id', userIds);
  for (const t of data ?? []) map.set(t.user_id, [...(map.get(t.user_id) ?? []), t.token]);
  return map;
}

async function send(messages: Push[]) {
  const valid = messages.filter((m) => m.to.startsWith('ExponentPushToken') || m.to.startsWith('ExpoPushToken'));
  for (let i = 0; i < valid.length; i += 100) {
    const chunk = valid.slice(i, i + 100).map((m) => ({ sound: 'default', priority: 'high', channelId: 'default', ...m }));
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(chunk),
    });
    const json = await res.json().catch(() => null);
    // Remove tokens for phones that uninstalled the app.
    const tickets: any[] = json?.data ?? [];
    const dead = tickets
      .map((t, j) => (t?.details?.error === 'DeviceNotRegistered' ? chunk[j].to : null))
      .filter(Boolean) as string[];
    if (dead.length) await supabase.from('push_tokens').delete().in('token', dead);
  }
  return valid.length;
}

async function onNewRequest(r: Row) {
  const [{ data: model }, { data: shops }] = await Promise.all([
    supabase.from('device_models').select('model').eq('id', r.device_model_id).single(),
    supabase.from('shops').select('id, owner_id').eq('market_id', r.market_id).eq('is_online', true),
  ]);
  if (!shops?.length) return 0;

  // Which shops have a matching phone in stock?
  const { data: stock } = await supabase
    .from('stock_items')
    .select('shop_id')
    .in('shop_id', shops.map((s) => s.id))
    .eq('device_model_id', r.device_model_id)
    .eq('storage_gb', r.storage_gb)
    .eq('is_available', true)
    .lte('price', r.budget_max);
  const matching = new Set((stock ?? []).map((s) => s.shop_id));

  const tokens = await tokensFor(shops.map((s) => s.owner_id));
  const what = `${model?.model ?? 'A phone'} · ${storage(r.storage_gb)}${r.color ? ' · ' + r.color : ''}`;
  const budget = `${rs(r.budget_min)}–${rs(r.budget_max)}`;
  const messages: Push[] = [];
  for (const s of shops) {
    const has = matching.has(s.id);
    for (const to of tokens.get(s.owner_id) ?? []) {
      messages.push({
        to,
        title: has ? 'Buyer wants a phone you have' : 'New buyer request',
        body: `${what} · ${budget}`,
        data: { url: `/shop/reply/${r.id}` },
      });
    }
  }
  return send(messages);
}

async function onNewOffer(o: Row) {
  const [{ data: req }, { data: shop }] = await Promise.all([
    supabase.from('requests').select('buyer_id').eq('id', o.request_id).single(),
    supabase.from('shops').select('name, floor_label, stall_number').eq('id', o.shop_id).single(),
  ]);
  if (!req) return 0;
  const tokens = await tokensFor([req.buyer_id]);
  return send(
    (tokens.get(req.buyer_id) ?? []).map((to) => ({
      to,
      title: `New offer: ${rs(o.price)}`,
      body: `${shop?.name ?? 'A shop'} · ${shop?.floor_label ?? ''} · Shop ${shop?.stall_number ?? ''}`,
      data: { url: `/buyer/request/${o.request_id}` },
    })),
  );
}

async function onOfferAccepted(o: Row) {
  const [{ data: shop }, { data: visit }] = await Promise.all([
    supabase.from('shops').select('owner_id').eq('id', o.shop_id).single(),
    supabase.from('visits').select('id').eq('offer_id', o.id).maybeSingle(),
  ]);
  if (!shop) return 0;
  const tokens = await tokensFor([shop.owner_id]);
  return send(
    (tokens.get(shop.owner_id) ?? []).map((to) => ({
      to,
      title: 'A buyer is on the way',
      body: `They picked your ${rs(o.price)} offer. Keep the phone aside for 20 minutes.`,
      data: { url: visit ? `/shop/visit/${visit.id}` : '/shop' },
    })),
  );
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  let sent = 0;
  try {
    const { type, table, record, old_record } = payload;
    if (table === 'requests' && type === 'INSERT') sent = await onNewRequest(record);
    else if (table === 'offers' && type === 'INSERT') sent = await onNewOffer(record);
    else if (table === 'offers' && type === 'UPDATE' && record.status === 'accepted' && old_record?.status !== 'accepted') sent = await onOfferAccepted(record);
  } catch (e) {
    console.error('notify failed', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }

  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } });
});
