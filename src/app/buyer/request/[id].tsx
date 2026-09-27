import { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase, photoUrl } from '@/lib/supabase';
import { must, useLoad, useRealtime } from '@/lib/data';
import { conditionLabel, errorMessage, ptaLabel, rs, rsShort, storageLabel } from '@/lib/format';
import { colors, fonts } from '@/lib/theme';
import type { Offer, PhoneRequest } from '@/lib/types';
import { Badge, Button, Card, ChipGroup, Countdown, Empty, Icon, Loading, Muted, PhotoBox, Rating, Row, Screen, Stack, TopBar } from '@/components/ui';

type Sort = 'price' | 'rating' | 'near';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'price', label: 'Lowest price' },
  { value: 'rating', label: 'Top rated' },
  { value: 'near', label: 'Nearest' },
];

/** Ground floor first, then 1st, basement, 2nd… A rough "closest to the entrance" order. */
function floorRank(label: string): number {
  const l = label.toLowerCase();
  if (l.startsWith('g')) return 0;
  if (l.startsWith('b') || l.startsWith('lower')) return 1.5;
  const n = parseInt(l, 10);
  return Number.isNaN(n) ? 5 : n;
}

export default function RequestOffers() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [sort, setSort] = useState<Sort>('price');
  const [cancelling, setCancelling] = useState(false);

  const { data, loading, reload } = useLoad(async () => {
    const [req, offers] = await Promise.all([
      supabase.from('requests').select('*, device_models(*)').eq('id', id).single(),
      supabase.from('offers').select('*, shops(*)').eq('request_id', id).neq('status', 'withdrawn'),
    ]);
    return { request: must(req) as PhoneRequest, offers: must(offers) as Offer[] };
  }, [id]);

  // New offers appear live.
  useRealtime(`offers-${id}`, 'offers', `request_id=eq.${id}`, reload);

  const sorted = useMemo(() => {
    const list = [...(data?.offers ?? [])];
    list.sort((a, b) => {
      if (sort === 'rating') return (b.shops?.rating_avg ?? 0) - (a.shops?.rating_avg ?? 0);
      if (sort === 'near') return floorRank(a.shops?.floor_label ?? '') - floorRank(b.shops?.floor_label ?? '');
      return a.price - b.price;
    });
    return list;
  }, [data?.offers, sort]);

  if (loading || !data) return <Loading />;
  const r = data.request;
  const isActive = r.status === 'active' && new Date(r.expires_at) > new Date();
  const bestLabel = sort === 'rating' ? 'Top rated' : sort === 'near' ? 'Closest' : 'Lowest';

  function cancel() {
    Alert.alert('Cancel this request?', 'Shops will stop seeing it.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          const { error } = await supabase.from('requests').update({ status: 'cancelled' }).eq('id', r.id);
          setCancelling(false);
          if (error) Alert.alert('Could not cancel', errorMessage(error));
          else router.replace('/buyer');
        },
      },
    ]);
  }

  return (
    <Screen
      background={colors.ground}
      padded={false}
      header={
        <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.lineSoft, paddingBottom: 14, gap: 12 }}>
          <TopBar
            title={`${r.device_models?.model} · ${storageLabel(r.storage_gb)}`}
            subtitle={`${r.color ?? 'Any colour'} · Rs ${rsShort(r.budget_min)}–${rsShort(r.budget_max)}`}
            right={isActive ? <View style={{ marginRight: 8 }}><Countdown until={r.expires_at} /></View> : <Badge label={r.status} />}
          />
          <Row gap={8} style={{ paddingHorizontal: 20 }}>
            <Icon name="dot" size={10} color={isActive ? colors.green : colors.faint} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14 }}>
              {data.offers.length} {data.offers.length === 1 ? 'shop' : 'shops'} replied{isActive ? ' · more coming in' : ''}
            </Text>
          </Row>
          <View style={{ paddingHorizontal: 20 }}>
            <ChipGroup options={SORTS} value={sort} onChange={setSort} />
          </View>
        </View>
      }
      footer={
        isActive ? (
          <Row gap={10}>
            <Button title="Cancel request" variant="danger" onPress={cancel} loading={cancelling} />
          </Row>
        ) : undefined
      }
    >
      <Stack gap={12} style={{ padding: 16 }}>
        {sorted.length === 0 ? (
          <Empty
            title={isActive ? 'Waiting for shops…' : 'No offers'}
            text={isActive ? 'Shops in the plaza have been alerted. Offers show up here the moment they reply.' : 'No shop replied before this request closed.'}
          />
        ) : null}
        {sorted.map((o, i) => (
          <Card key={o.id} onPress={() => router.push(`/buyer/offer/${o.id}`)} style={{ flexDirection: 'row', gap: 14, padding: 14 }} strong={o.status === 'accepted'}>
            <PhotoBox uri={photoUrl(o.photo_path)} size={96} height={112} label="Live photo" />
            <View style={{ flex: 1, gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20 }}>{rs(o.price)}</Text>
                {o.status === 'accepted' ? <Badge label="Your pick" tone="dark" /> : i === 0 && sorted.length > 1 ? <Badge label={bestLabel} tone="green" /> : null}
              </Row>
              <Row wrap gap={6}>
                <Badge label={conditionLabel[o.condition]} />
                {o.battery_health ? <Badge label={`Battery ${o.battery_health}%`} /> : null}
                <Badge label={ptaLabel[o.pta_status]} />
              </Row>
              <Row gap={6}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14 }} numberOfLines={1}>{o.shops?.name}</Text>
                {o.shops?.is_verified ? <Icon name="shield" size={16} color={colors.blue} /> : null}
              </Row>
              <Row gap={10}>
                <Rating value={Number(o.shops?.rating_avg ?? 0)} count={o.shops?.rating_count} />
                <Muted style={{ fontSize: 13 }} numberOfLines={1}>{o.shops?.floor_label} · Shop {o.shops?.stall_number}</Muted>
              </Row>
            </View>
          </Card>
        ))}
      </Stack>
    </Screen>
  );
}
