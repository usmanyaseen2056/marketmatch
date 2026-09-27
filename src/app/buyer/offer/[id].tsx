import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, photoUrl } from '@/lib/supabase';
import { must, useLoad } from '@/lib/data';
import { conditionLabel, errorMessage, ptaLabel, rs, storageLabel } from '@/lib/format';
import { colors, fonts, radius } from '@/lib/theme';
import type { Offer } from '@/lib/types';
import { Badge, Body, Button, Divider, Icon, Loading, Muted, PhotoBox, Rating, Row, Stack } from '@/components/ui';

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, minWidth: '45%', padding: 14, borderRadius: radius.lg, backgroundColor: colors.soft, gap: 4 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>{label}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>{value}</Text>
    </View>
  );
}

export default function OfferDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [busy, setBusy] = useState(false);

  const { data: offer, loading } = useLoad(
    async () => must(await supabase.from('offers').select('*, shops(*), requests(*, device_models(*))').eq('id', id).single()) as Offer,
    [id],
  );

  if (loading || !offer) return <Loading />;
  const shop = offer.shops!;
  const req = offer.requests!;
  const inBudget = offer.price >= req.budget_min && offer.price <= req.budget_max;
  const requestActive = req.status === 'active' && new Date(req.expires_at) > new Date();
  const phone = shop.phone?.replace(/[^0-9+]/g, '');

  async function goToShop() {
    setBusy(true);
    const { data: visitId, error } = await supabase.rpc('accept_offer', { p_offer_id: offer!.id });
    setBusy(false);
    if (error) return Alert.alert('Could not reserve', errorMessage(error));
    router.replace(`/buyer/visit/${visitId}`);
  }

  async function openVisit() {
    const { data } = await supabase.from('visits').select('id').eq('offer_id', offer!.id).maybeSingle();
    if (data) router.replace(`/buyer/visit/${data.id}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View>
          <PhotoBox uri={photoUrl(offer.photo_path)} size="100%" height={320} />
          <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 16 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.back()}
              style={{ marginTop: 8, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="back" size={22} />
            </Pressable>
          </SafeAreaView>
          <View style={{ position: 'absolute', left: 16, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.ink, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Icon name="camera" size={14} color="#fff" />
            <Text style={{ color: '#fff', fontFamily: fonts.semibold, fontSize: 12 }}>Live photo from the shop</Text>
          </View>
        </View>

        <Stack gap={22} style={{ padding: 20 }}>
          <Stack gap={8}>
            <Muted>
              {req.device_models?.model} · {storageLabel(req.storage_gb)}
              {req.color ? ` · ${req.color}` : ''}
            </Muted>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 32, letterSpacing: -0.5 }}>{rs(offer.price)}</Text>
              <Badge label={inBudget ? 'In your budget' : 'Over budget'} tone={inBudget ? 'green' : 'amber'} />
            </Row>
          </Stack>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Spec label="Condition" value={conditionLabel[offer.condition]} />
            <Spec label="Battery health" value={offer.battery_health ? `${offer.battery_health}%` : '—'} />
            <Spec label="PTA status" value={ptaLabel[offer.pta_status]} />
            <Spec label="In the box" value={offer.in_box || 'Phone only'} />
          </View>

          {offer.notes ? (
            <Row gap={10} style={{ alignItems: 'flex-start', padding: 14, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.line }}>
              <Icon name="message" size={20} color={colors.muted} />
              <Body style={{ flex: 1, fontSize: 14 }}>
                <Text style={{ fontFamily: fonts.bold }}>Shop note: </Text>
                {offer.notes}
              </Body>
            </Row>
          ) : null}

          <Divider />

          <Row gap={14}>
            <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 18 }}>
                {shop.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Row gap={6}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 17 }}>{shop.name}</Text>
                {shop.is_verified ? <Icon name="shield" size={16} color={colors.blue} /> : null}
              </Row>
              <Rating value={Number(shop.rating_avg)} count={shop.rating_count} />
            </View>
          </Row>

          <Stack gap={14}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18 }}>How to get there</Text>
            <Row gap={8}>
              <View style={{ flex: 1, padding: 12, borderRadius: radius.md, backgroundColor: colors.ink }}>
                <Text style={{ color: '#fff', opacity: 0.75, fontFamily: fonts.regular, fontSize: 12 }}>Floor</Text>
                <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 17 }}>{shop.floor_label}</Text>
              </View>
              {shop.wing ? (
                <View style={{ flex: 1, padding: 12, borderRadius: radius.md, backgroundColor: colors.soft }}>
                  <Muted style={{ fontSize: 12 }}>Wing</Muted>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 17 }}>{shop.wing}</Text>
                </View>
              ) : null}
              <View style={{ flex: 1, padding: 12, borderRadius: radius.md, backgroundColor: colors.soft }}>
                <Muted style={{ fontSize: 12 }}>Shop</Muted>
                <Text style={{ fontFamily: fonts.bold, fontSize: 17 }}>{shop.stall_number}</Text>
              </View>
            </Row>
            {shop.landmark ? (
              <Row gap={8}>
                <Icon name="pin" size={18} color={colors.green} />
                <Body style={{ flex: 1 }}>{shop.landmark}</Body>
              </Row>
            ) : null}
            {shop.directions.map((step, i) => (
              <Row key={i} gap={14} style={{ alignItems: 'flex-start' }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: i === shop.directions.length - 1 ? colors.green : colors.ink, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 13 }}>{i + 1}</Text>
                </View>
                <Body style={{ flex: 1, paddingTop: 3 }}>{step}</Body>
              </Row>
            ))}
          </Stack>
        </Stack>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.lineSoft, gap: 10 }}>
        {phone ? (
          <Row gap={10}>
            <Button title="Call" icon="phone" variant="secondary" onPress={() => Linking.openURL(`tel:${phone}`)} />
            <Button title="WhatsApp" icon="message" variant="secondary" onPress={() => Linking.openURL(`https://wa.me/${phone.replace('+', '')}`)} />
          </Row>
        ) : null}
        {offer.status === 'accepted' ? (
          <Button title="Open my visit" onPress={openVisit} />
        ) : requestActive && offer.status === 'sent' ? (
          <Button title="I'm going — hold it for me" subtitle="The shop keeps it for 20 minutes" onPress={goToShop} loading={busy} />
        ) : (
          <Button title="This offer is closed" disabled />
        )}
      </SafeAreaView>
    </View>
  );
}
