import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { must, useLoad } from '@/lib/data';
import { rs, rsShort, storageLabel } from '@/lib/format';
import { colors, fonts, radius } from '@/lib/theme';
import type { Market, PhoneRequest, Visit } from '@/lib/types';
import { Badge, Card, Countdown, H1, Icon, Muted, Overline, Row, Screen, Stack } from '@/components/ui';

const BRANDS = ['Apple', 'Samsung', 'Infinix', 'Xiaomi', 'Tecno', 'Vivo'];

type RequestRow = PhoneRequest & { offers: { count: number }[]; min_price: { price: number }[] };

export default function BuyerHome() {
  const { session, profile, signOut } = useAuth();
  const [marketIndex, setMarketIndex] = useState(0);

  const { data } = useLoad(async () => {
    await supabase.rpc('expire_old_requests');
    const uid = session!.user.id;
    const [markets, requests, visits] = await Promise.all([
      supabase.from('markets').select('*').order('name'),
      supabase
        .from('requests')
        .select('*, device_models(*), offers(count), min_price:offers(price)')
        .eq('buyer_id', uid)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('visits')
        .select('*, offers(*), shops(*)')
        .eq('buyer_id', uid)
        .is('buyer_outcome', null)
        .is('shop_outcome', null)
        .order('created_at', { ascending: false })
        .limit(3),
    ]);
    return {
      markets: must(markets) as Market[],
      requests: must(requests) as RequestRow[],
      visits: must(visits) as Visit[],
    };
  }, [session?.user.id]);

  const markets = data?.markets ?? [];
  const market = markets[marketIndex % Math.max(1, markets.length)];
  const active = (data?.requests ?? []).filter((r) => r.status === 'active' && new Date(r.expires_at) > new Date());
  const past = (data?.requests ?? []).filter((r) => !active.includes(r)).slice(0, 5);
  const liveVisits = (data?.visits ?? []).filter((v) => v.offers?.status === 'accepted');

  function newRequest(brand?: string) {
    if (!market) return;
    router.push({ pathname: '/buyer/new-request', params: { marketId: market.id, marketName: market.name, ...(brand ? { brand } : {}) } });
  }

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change market"
          onPress={() => markets.length > 1 && setMarketIndex((i) => i + 1)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, minHeight: 44, borderRadius: radius.pill, backgroundColor: colors.soft }}
        >
          <Icon name="pin" size={18} color={colors.green} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14 }}>{market ? `${market.name}, ${market.city}` : 'Loading…'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={signOut}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 16 }}>{(profile?.full_name ?? 'U').charAt(0).toUpperCase()}</Text>
        </Pressable>
      </Row>

      <H1>What phone are you looking for?</H1>

      <Pressable
        accessibilityRole="search"
        onPress={() => newRequest()}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 56, paddingHorizontal: 18, borderRadius: radius.lg, backgroundColor: colors.soft }}
      >
        <Icon name="search" size={22} strokeWidth={2.2} />
        <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: colors.muted }}>Search model, e.g. iPhone 14 Pro</Text>
      </Pressable>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {BRANDS.map((b) => (
          <Pressable
            key={b}
            accessibilityRole="button"
            onPress={() => newRequest(b)}
            style={{ width: '31%', flexGrow: 1, height: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15 }}>{b}</Text>
          </Pressable>
        ))}
      </View>

      {liveVisits.map((v) => (
        <Card key={v.id} strong onPress={() => router.push(`/buyer/visit/${v.id}`)} style={{ backgroundColor: colors.ink, borderColor: colors.ink }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: '#7FE0A8', fontFamily: fonts.semibold, fontSize: 14 }}>Phone on hold for you</Text>
            <Countdown until={v.offers?.hold_until} tone="dark" />
          </Row>
          <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 18 }}>
            {v.shops?.name} · {v.shops?.floor_label} · Shop {v.shops?.stall_number}
          </Text>
          <Text style={{ color: '#fff', opacity: 0.8, fontFamily: fonts.regular, fontSize: 14 }}>Tap for directions and your checklist</Text>
        </Card>
      ))}

      {active.length > 0 ? (
        <Stack gap={10}>
          <Overline>Your active requests</Overline>
          {active.map((r) => {
            const count = r.offers?.[0]?.count ?? 0;
            const lowest = r.min_price?.length ? Math.min(...r.min_price.map((o) => o.price)) : null;
            return (
              <Card key={r.id} strong onPress={() => router.push(`/buyer/request/${r.id}`)}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 18 }}>
                      {r.device_models?.model} · {storageLabel(r.storage_gb)}
                    </Text>
                    <Muted>
                      {r.color ?? 'Any colour'} · Rs {rsShort(r.budget_min)}–{rsShort(r.budget_max)}
                    </Muted>
                  </View>
                  <Countdown until={r.expires_at} prefix="" />
                </Row>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row gap={10}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 28 }}>{count}</Text>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 15 }}>
                      {count === 1 ? 'offer' : 'offers'}
                      {lowest ? ' · lowest ' : ''}
                      {lowest ? <Text style={{ color: colors.green, fontFamily: fonts.bold }}>{rs(lowest)}</Text> : null}
                    </Text>
                  </Row>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="forward" size={20} color="#fff" />
                  </View>
                </Row>
              </Card>
            );
          })}
        </Stack>
      ) : (
        <View style={{ padding: 18, borderRadius: radius.xl, backgroundColor: colors.ink, gap: 12 }}>
          <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 }}>
            Post once. Shops reply with price and a live photo. Walk straight to the right counter.
          </Text>
          <Row gap={8}>
            {['1 · Post', '2 · Compare', '3 · Walk in'].map((t) => (
              <View key={t} style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: '#1F1F1E' }}>
                <Text style={{ color: '#fff', fontFamily: fonts.semibold, fontSize: 13 }}>{t}</Text>
              </View>
            ))}
          </Row>
        </View>
      )}

      {past.length > 0 ? (
        <Stack gap={10}>
          <Overline>Earlier</Overline>
          {past.map((r) => (
            <Card key={r.id} onPress={() => router.push(`/buyer/request/${r.id}`)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, flex: 1 }} numberOfLines={1}>
                  {r.device_models?.model} · {storageLabel(r.storage_gb)}
                </Text>
                <Badge label={r.status === 'active' ? 'expired' : r.status} tone={r.status === 'fulfilled' ? 'green' : 'neutral'} />
              </Row>
            </Card>
          ))}
        </Stack>
      ) : null}
    </Screen>
  );
}
