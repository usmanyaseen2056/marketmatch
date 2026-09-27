import { useState } from 'react';
import { Alert, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { must, useLoad, useRealtime } from '@/lib/data';
import { errorMessage, rs } from '@/lib/format';
import { colors, fonts, radius } from '@/lib/theme';
import type { Visit } from '@/lib/types';
import { Button, Countdown, ErrorText, Icon, Loading, Muted, Row, Screen, Stack, TopBar } from '@/components/ui';

function checklist(minBattery: number | null | undefined) {
  return [
    { key: 'imei', label: 'IMEI matches the box', hint: 'Dial *#06# and compare with the box' },
    { key: 'pta', label: 'PTA status is as listed', hint: 'Check the IMEI on the PTA DIRBS website' },
    { key: 'battery', label: `Battery health ${minBattery ? minBattery + '% or more' : 'as listed'}`, hint: 'Settings › Battery › Battery Health' },
    { key: 'faceid', label: 'Face ID / fingerprint works', hint: 'Set it up once in the shop' },
    { key: 'camera', label: 'All cameras and flash work', hint: 'Front, back and zoom' },
    { key: 'account', label: 'iCloud / Google account removed', hint: 'The phone must not be locked to anyone' },
  ];
}

export default function BuyerVisit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [accurate, setAccurate] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const { data: visit, loading, reload } = useLoad(
    async () => must(await supabase.from('visits').select('*, offers(*, requests(*)), shops(*)').eq('id', id).single()) as Visit & { offers: { requests: { min_battery: number } } },
    [id],
  );
  useRealtime(`visit-${id}`, 'visits', `id=eq.${id}`, reload);

  if (loading || !visit) return <Loading />;
  const shop = visit.shops!;
  const offer = visit.offers!;
  const items = checklist(offer.requests?.min_battery);
  const count = items.filter((i) => done[i.key]).length;
  const closed = !!visit.buyer_outcome || !!visit.shop_outcome;
  const phone = shop.phone?.replace(/[^0-9+]/g, '');

  async function outcome(o: 'bought' | 'not_bought') {
    setBusy(o);
    const { error } = await supabase.rpc('set_buyer_outcome', { p_visit_id: visit!.id, p_outcome: o });
    setBusy(null);
    if (error) return Alert.alert('Could not save', errorMessage(error));
    if (o === 'not_bought') router.replace(`/buyer/request/${visit!.request_id}`);
    else reload();
  }

  async function submitReview() {
    if (!rating) return setReviewError('Tap the stars to rate');
    if (accurate === null) return setReviewError('Did the phone match the offer?');
    setBusy('review');
    const { error } = await supabase.from('reviews').insert({
      visit_id: visit!.id,
      buyer_id: session!.user.id,
      shop_id: visit!.shop_id,
      rating,
      accurate,
      comment: comment.trim() || null,
    });
    setBusy(null);
    if (error) return setReviewError(errorMessage(error));
    setReviewed(true);
  }

  return (
    <Screen
      padded={false}
      footer={
        !closed ? (
          <Row gap={10}>
            <Button title="Didn't buy" variant="secondary" onPress={() => outcome('not_bought')} loading={busy === 'not_bought'} style={{ flexGrow: 1 }} />
            <Button title="I bought it" variant="green" onPress={() => outcome('bought')} loading={busy === 'bought'} style={{ flexGrow: 2 }} />
          </Row>
        ) : (
          <Button title="Back to home" onPress={() => router.replace('/buyer')} />
        )
      }
    >
      <View style={{ backgroundColor: colors.ink, paddingBottom: 24, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 20 }}>
          <View style={{ flex: 1 }}>
            <TopBarDark />
          </View>
          {!closed ? <Countdown until={offer.hold_until} prefix="Held for " tone="dark" /> : null}
        </View>
        <View style={{ paddingHorizontal: 20, gap: 16 }}>
          <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 26, lineHeight: 31 }}>
            {closed
              ? visit.buyer_outcome === 'bought' || visit.shop_outcome === 'sold'
                ? 'Enjoy your new phone'
                : 'Visit closed'
              : `${shop.name} is holding your phone`}
          </Text>
          <Row gap={8}>
            <View style={{ flex: 1, padding: 12, borderRadius: radius.md, backgroundColor: '#1F1F1E' }}>
              <Text style={{ color: '#fff', opacity: 0.75, fontSize: 12, fontFamily: fonts.regular }}>Go to</Text>
              <Text style={{ color: '#fff', fontSize: 16, fontFamily: fonts.bold }}>
                {shop.floor_label} · Shop {shop.stall_number}
              </Text>
            </View>
            <View style={{ flex: 1, padding: 12, borderRadius: radius.md, backgroundColor: '#1F1F1E' }}>
              <Text style={{ color: '#fff', opacity: 0.75, fontSize: 12, fontFamily: fonts.regular }}>Offer price</Text>
              <Text style={{ color: '#fff', fontSize: 16, fontFamily: fonts.bold }}>{rs(offer.price)}</Text>
            </View>
          </Row>
          {shop.landmark ? <Text style={{ color: '#fff', opacity: 0.85, fontFamily: fonts.regular, fontSize: 14 }}>{shop.landmark}</Text> : null}
        </View>
      </View>

      <Stack gap={20} style={{ padding: 20 }}>
        {!visit.confirmed_at && !closed ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/buyer/scan/${visit.id}`)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: radius.xl, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.ink }}
          >
            <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="qr" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17 }}>Reached the shop? Scan its QR</Text>
              <Muted style={{ fontSize: 13 }}>Confirms your visit and unlocks your review</Muted>
            </View>
          </Pressable>
        ) : visit.confirmed_at ? (
          <Row gap={12} style={{ padding: 16, borderRadius: radius.xl, backgroundColor: colors.greenSoft }}>
            <Icon name="check" size={24} color={colors.greenDark} strokeWidth={2.6} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.greenDark }}>Visit confirmed at Shop {shop.stall_number}</Text>
          </Row>
        ) : null}

        {!closed ? (
          <Stack gap={10}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18 }}>Check before you pay</Text>
              <Muted style={{ fontFamily: fonts.semibold }}>
                {count} of {items.length}
              </Muted>
            </Row>
            {items.map((it) => {
              const on = !!done[it.key];
              return (
                <Pressable
                  key={it.key}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => setDone((d) => ({ ...d, [it.key]: !d[it.key] }))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, minHeight: 60, borderRadius: radius.lg, borderWidth: 1.5, borderColor: on ? colors.soft : colors.line, backgroundColor: on ? colors.soft : '#fff' }}
                >
                  <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: on ? colors.green : '#BDBDB7', backgroundColor: on ? colors.green : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <Icon name="check" size={16} color="#fff" strokeWidth={3} /> : null}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 15 }}>{it.label}</Text>
                    <Muted style={{ fontSize: 13 }}>{it.hint}</Muted>
                  </View>
                </Pressable>
              );
            })}
            {phone ? <Button title={`Call ${shop.name}`} icon="phone" variant="secondary" onPress={() => Linking.openURL(`tel:${phone}`)} /> : null}
          </Stack>
        ) : null}

        {closed && visit.confirmed_at && !reviewed ? (
          <Stack gap={14}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18 }}>Rate {shop.name}</Text>
            <Row gap={6}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} stars`} onPress={() => { setRating(n); setReviewError(null); }} style={{ padding: 4 }}>
                  <Icon name="star" size={34} color={n <= rating ? colors.ink : colors.line} />
                </Pressable>
              ))}
            </Row>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15 }}>Did the phone match the offer?</Text>
            <Row gap={8}>
              <Button title="Yes, exactly" variant={accurate === true ? 'primary' : 'secondary'} onPress={() => setAccurate(true)} />
              <Button title="No" variant={accurate === false ? 'primary' : 'secondary'} onPress={() => setAccurate(false)} />
            </Row>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Anything other buyers should know? (optional)"
              placeholderTextColor={colors.faint}
              multiline
              maxLength={500}
              accessibilityLabel="Review comment"
              style={{ minHeight: 90, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, padding: 14, fontFamily: fonts.regular, fontSize: 15, textAlignVertical: 'top' }}
            />
            <ErrorText>{reviewError}</ErrorText>
            <Button title="Post review" onPress={submitReview} loading={busy === 'review'} />
          </Stack>
        ) : null}
        {reviewed ? (
          <Row gap={10} style={{ padding: 16, borderRadius: radius.xl, backgroundColor: colors.greenSoft }}>
            <Icon name="check" color={colors.greenDark} />
            <Text style={{ fontFamily: fonts.bold, color: colors.greenDark }}>Thanks! Your review helps other buyers.</Text>
          </Row>
        ) : null}
        {closed && !visit.confirmed_at ? <Muted>Reviews are only open for visits confirmed with the shop's QR code.</Muted> : null}
      </Stack>
    </Screen>
  );
}

function TopBarDark() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/buyer'))}
      style={{ width: 44, height: 44, marginLeft: 10, marginTop: 4, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name="back" size={24} color="#fff" strokeWidth={2.2} />
    </Pressable>
  );
}
