import { useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { must, useLoad, useRealtime } from '@/lib/data';
import { conditionLabel, errorMessage, ptaLabel, rs } from '@/lib/format';
import { photoUrl } from '@/lib/supabase';
import { colors, fonts, radius } from '@/lib/theme';
import type { Offer, Visit } from '@/lib/types';
import { Button, Countdown, Icon, Loading, Muted, PhotoBox, Row, Screen, Stack, TopBar } from '@/components/ui';

type VisitRow = Visit & { offers: Offer & { requests: { device_models: { model: string } | null; storage_gb: number } } };

export default function ShopVisit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [busy, setBusy] = useState<string | null>(null);

  const { data, loading, reload } = useLoad(async () => {
    const [visit, qr] = await Promise.all([
      supabase.from('visits').select('*, offers(*, requests(storage_gb, device_models(model)))').eq('id', id).single(),
      supabase.rpc('my_shop_qr'),
    ]);
    const v = must(visit) as VisitRow;
    const { data: buyer } = await supabase.from('profiles').select('full_name, phone').eq('id', v.buyer_id).maybeSingle();
    return { visit: v, qr: must(qr) as string, buyer };
  }, [id]);
  useRealtime(`shop-visit-${id}`, 'visits', `id=eq.${id}`, reload);

  if (loading || !data) return <Loading />;
  const { visit, qr, buyer } = data;
  const offer = visit.offers;
  const closed = !!visit.shop_outcome || !!visit.buyer_outcome;
  const buyerName = buyer?.full_name?.split(' ')[0] ?? 'The buyer';

  async function outcome(o: 'sold' | 'no_sale') {
    setBusy(o);
    const { error } = await supabase.rpc('set_shop_outcome', { p_visit_id: visit.id, p_outcome: o, p_final_price: o === 'sold' ? offer.price : null });
    setBusy(null);
    if (error) return Alert.alert('Could not save', errorMessage(error));
    router.replace('/shop');
  }

  return (
    <Screen
      padded={false}
      header={
        <View style={{ backgroundColor: colors.green }}>
          <TopBar title="" right={!closed ? <View style={{ marginRight: 12 }}><Countdown until={offer.hold_until} prefix="Hold " tone="dark" /></View> : undefined} />
        </View>
      }
      footer={
        !closed ? (
          <Row gap={10}>
            <Button title="No sale" variant="secondary" onPress={() => outcome('no_sale')} loading={busy === 'no_sale'} style={{ flexGrow: 1 }} />
            <Button title="Mark as sold" onPress={() => outcome('sold')} loading={busy === 'sold'} style={{ flexGrow: 2 }} />
          </Row>
        ) : (
          <Button title="Back to requests" onPress={() => router.replace('/shop')} />
        )
      }
    >
      <View style={{ backgroundColor: colors.green, paddingHorizontal: 20, paddingBottom: 26, gap: 12 }}>
        <Text style={{ color: '#fff', opacity: 0.9, fontFamily: fonts.semibold, fontSize: 14 }}>
          {visit.confirmed_at ? 'Buyer has arrived' : 'Buyer accepted your offer'}
        </Text>
        <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 28, lineHeight: 32 }}>
          {closed ? 'Visit closed' : visit.confirmed_at ? `${buyerName} is at your counter` : `${buyerName} is walking to your shop`}
        </Text>
        <View style={{ padding: 12, borderRadius: radius.md, backgroundColor: '#075C2E', alignSelf: 'flex-start' }}>
          <Text style={{ color: '#fff', opacity: 0.85, fontSize: 12, fontFamily: fonts.regular }}>Your offer</Text>
          <Text style={{ color: '#fff', fontSize: 18, fontFamily: fonts.bold }}>{rs(offer.price)}</Text>
        </View>
      </View>

      <Stack gap={18} style={{ padding: 20 }}>
        <Row gap={14} style={{ padding: 14, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineSoft }}>
          <PhotoBox uri={photoUrl(offer.photo_path)} size={64} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>{offer.requests?.device_models?.model}</Text>
            <Muted style={{ fontSize: 13 }}>
              {conditionLabel[offer.condition]}
              {offer.battery_health ? ` · ${offer.battery_health}%` : ''} · {ptaLabel[offer.pta_status]}
            </Muted>
            {!closed ? <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.amberText }}>Keep this phone aside</Text> : null}
          </View>
        </Row>

        {!closed && !visit.confirmed_at ? (
          <View style={{ alignItems: 'center', gap: 12, padding: 20, borderRadius: radius.xl, backgroundColor: colors.soft }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15 }}>Show this QR when the buyer arrives</Text>
            <View style={{ padding: 14, borderRadius: radius.md, backgroundColor: '#fff' }}>
              <QRCode value={qr} size={180} />
            </View>
            <Muted style={{ textAlign: 'center', fontSize: 13 }}>Scanning confirms the visit. Only confirmed visits can leave a review.</Muted>
          </View>
        ) : null}

        {visit.confirmed_at && !closed ? (
          <Row gap={12} style={{ padding: 16, borderRadius: radius.xl, backgroundColor: colors.greenSoft }}>
            <Icon name="check" size={24} color={colors.greenDark} strokeWidth={2.6} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.greenDark }}>Visit confirmed</Text>
          </Row>
        ) : null}

        {buyer?.phone && !closed ? (
          <Button title={`Call ${buyerName}`} icon="phone" variant="secondary" onPress={() => Linking.openURL(`tel:${buyer.phone}`)} />
        ) : null}
      </Stack>
    </Screen>
  );
}
