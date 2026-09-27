import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { must, useLoad, useRealtime } from '@/lib/data';
import { conditionPrefLabel, errorMessage, ptaPrefLabel, rsShort, storageLabel, timeAgo } from '@/lib/format';
import { colors, fonts, radius } from '@/lib/theme';
import type { PhoneRequest, StockItem, Visit } from '@/lib/types';
import { Badge, Button, Card, ChipGroup, Countdown, Empty, Icon, Loading, Muted, Row, Screen, Stack, useNow } from '@/components/ui';

type Filter = 'match' | 'all';

export default function ShopInbox() {
  const { shop, refresh, signOut } = useAuth();
  const [filter, setFilter] = useState<Filter>('match');
  const [togglingOnline, setTogglingOnline] = useState(false);
  const now = useNow(15000);

  const { data, loading, reload } = useLoad(async () => {
    if (!shop) return null;
    await supabase.rpc('expire_old_requests');
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [requests, stock, myOffers, visits] = await Promise.all([
      supabase
        .from('requests')
        .select('*, device_models(*)')
        .eq('market_id', shop.market_id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
      supabase.from('stock_items').select('*').eq('shop_id', shop.id).eq('is_available', true),
      supabase.from('offers').select('request_id, status, created_at').eq('shop_id', shop.id).gte('created_at', since),
      supabase
        .from('visits')
        .select('*, offers(*)')
        .eq('shop_id', shop.id)
        .is('shop_outcome', null)
        .gte('created_at', since)
        .order('created_at', { ascending: false }),
    ]);
    const visitRows = (must(visits) as Visit[]).filter((v) => v.offers?.status === 'accepted' && !v.buyer_outcome);
    return {
      requests: must(requests) as PhoneRequest[],
      stock: must(stock) as StockItem[],
      offered: new Set((must(myOffers) as { request_id: string }[]).map((o) => o.request_id)),
      repliesToday: (must(myOffers) as unknown[]).length,
      visits: visitRows,
    };
  }, [shop?.id]);

  // New buyer requests and new visits show up live.
  useRealtime(`shop-req-${shop?.market_id}`, 'requests', shop ? `market_id=eq.${shop.market_id}` : undefined, reload, !!shop);
  useRealtime(`shop-visits-${shop?.id}`, 'visits', shop ? `shop_id=eq.${shop.id}` : undefined, reload, !!shop);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.requests
      .filter((r) => new Date(r.expires_at).getTime() > now)
      .map((r) => {
        const match = data.stock.some(
          (s) =>
            s.device_model_id === r.device_model_id &&
            s.storage_gb === r.storage_gb &&
            (!r.color || !s.color || s.color === r.color) &&
            (r.pta_pref === 'any' || s.pta_status === r.pta_pref) &&
            (r.condition_pref === 'any' || (r.condition_pref === 'new') === (s.condition === 'new')) &&
            s.price <= r.budget_max,
        );
        return { r, match, offered: data.offered.has(r.id) };
      });
  }, [data, now]);

  if (!shop) {
    return (
      <Screen>
        <Empty title="Set up your shop first" action={<Button title="Set up shop" onPress={() => router.replace('/shop/setup')} />} />
      </Screen>
    );
  }
  if (loading || !data) return <Loading />;

  const matches = rows.filter((x) => x.match);
  const visible = filter === 'match' ? matches : rows;

  async function toggleOnline() {
    setTogglingOnline(true);
    const { error } = await supabase.from('shops').update({ is_online: !shop!.is_online }).eq('id', shop!.id);
    setTogglingOnline(false);
    if (error) Alert.alert('Could not update', errorMessage(error));
    else refresh();
  }

  return (
    <Screen
      background={colors.ground}
      padded={false}
      footer={
        <Row gap={8}>
          <Button title="My stock" icon="box" variant="secondary" onPress={() => router.push('/shop/stock')} style={{ height: 48 }} />
          <Button title="Shop details" icon="store" variant="secondary" onPress={() => router.push('/shop/setup')} style={{ height: 48 }} />
          <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={signOut} style={{ width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="logout" size={20} />
          </Pressable>
        </Row>
      }
      header={
        <View style={{ backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 16, borderBottomWidth: 1, borderBottomColor: colors.lineSoft }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 20 }} numberOfLines={1}>{shop.name}</Text>
              <Muted style={{ fontSize: 13 }}>
                {shop.floor_label} · Shop {shop.stall_number}
              </Muted>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: shop.is_online }}
              onPress={toggleOnline}
              disabled={togglingOnline}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: shop.is_online ? colors.greenSoft : colors.soft }}
            >
              <Icon name="dot" size={10} color={shop.is_online ? colors.green : colors.faint} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: shop.is_online ? colors.greenDark : colors.muted }}>{shop.is_online ? 'Online' : 'Offline'}</Text>
            </Pressable>
          </Row>
          <Row gap={8}>
            {[
              { n: rows.length, l: 'Open requests' },
              { n: data.repliesToday, l: 'Your replies (24h)' },
              { n: data.visits.length, l: 'Buyers coming', green: true },
            ].map((s) => (
              <View key={s.l} style={{ flex: 1, padding: 12, borderRadius: radius.md, backgroundColor: s.green ? colors.greenSoft : colors.soft }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: s.green ? colors.greenDark : colors.ink }}>{s.n}</Text>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: s.green ? colors.greenDark : colors.muted }}>{s.l}</Text>
              </View>
            ))}
          </Row>
          <ChipGroup
            options={[
              { value: 'match' as Filter, label: `Matches my stock (${matches.length})` },
              { value: 'all' as Filter, label: `All (${rows.length})` },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </View>
      }
    >
      <Stack gap={12} style={{ padding: 16 }}>
        {data.visits.map((v) => (
          <Card key={v.id} onPress={() => router.push(`/shop/visit/${v.id}`)} style={{ backgroundColor: colors.green, borderColor: colors.green }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 17 }}>A buyer is on the way</Text>
              <Countdown until={v.offers?.hold_until} tone="dark" />
            </Row>
            <Text style={{ color: '#fff', fontFamily: fonts.regular, fontSize: 14 }}>Keep the phone aside. Tap to show your QR code.</Text>
          </Card>
        ))}

        {!shop.is_online ? (
          <Card>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>You're offline</Text>
            <Muted>You won't get alerts for new requests until you go online.</Muted>
          </Card>
        ) : null}

        {visible.length === 0 ? (
          <Empty
            title={filter === 'match' ? 'No matching requests right now' : 'No open requests right now'}
            text={filter === 'match' ? 'Add phones to My stock so we can show you the requests you can fill.' : "We'll alert you when a buyer posts."}
            action={filter === 'match' ? <Button title="Add to my stock" variant="secondary" onPress={() => router.push('/shop/stock')} /> : undefined}
          />
        ) : null}

        {visible.map(({ r, match, offered }) => (
          <Card key={r.id} strong={match && !offered}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 4 }}>
                {offered ? <Badge label="Offer sent" tone="dark" /> : match ? <Badge label="In your stock" tone="green" /> : null}
                <Text style={{ fontFamily: fonts.bold, fontSize: 18 }}>
                  {r.device_models?.model} · {storageLabel(r.storage_gb)}
                </Text>
                <Muted>
                  {r.color ?? 'Any colour'} · {conditionPrefLabel[r.condition_pref]}
                  {r.min_battery ? ` · Battery ${r.min_battery}%+` : ''} · {ptaPrefLabel[r.pta_pref]}
                </Muted>
              </View>
              <Countdown until={r.expires_at} />
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>Budget</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>
                  Rs {rsShort(r.budget_min)}–{rsShort(r.budget_max)}
                </Text>
              </View>
              {!offered ? (
                <Button title="I have it" onPress={() => router.push(`/shop/reply/${r.id}`)} style={{ flexGrow: 0, height: 44, paddingHorizontal: 18 }} />
              ) : null}
            </Row>
            <Muted style={{ fontSize: 12 }}>Posted {timeAgo(r.created_at, now)}</Muted>
          </Card>
        ))}
      </Stack>
    </Screen>
  );
}
