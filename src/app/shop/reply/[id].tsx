import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { must, useLoad } from '@/lib/data';
import { conditionLabel, conditionPrefLabel, errorMessage, formatAmountInput, parseAmount, ptaLabel, ptaPrefLabel, rs, storageLabel } from '@/lib/format';
import { PickedPhoto, takeLivePhoto, uploadOfferPhoto } from '@/lib/photos';
import { colors, fonts, radius } from '@/lib/theme';
import type { Condition, PhoneRequest, PtaStatus, StockItem } from '@/lib/types';
import { Button, ChipGroup, Countdown, ErrorText, Field, Icon, Loading, Muted, Overline, Row, Screen, Section, Stack, TopBar } from '@/components/ui';

const CONDITIONS: Condition[] = ['new', 'a_plus', 'a', 'b', 'c'];
const PTA: PtaStatus[] = ['pta_approved', 'non_pta'];

export default function ShopReply() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { shop } = useAuth();
  const [stockId, setStockId] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState<Condition | null>(null);
  const [battery, setBattery] = useState('');
  const [pta, setPta] = useState<PtaStatus | null>(null);
  const [inBox, setInBox] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading } = useLoad(async () => {
    const req = must(await supabase.from('requests').select('*, device_models(*)').eq('id', id).single()) as PhoneRequest;
    const stock = must(
      await supabase
        .from('stock_items')
        .select('*')
        .eq('shop_id', shop!.id)
        .eq('is_available', true)
        .eq('device_model_id', req.device_model_id)
        .eq('storage_gb', req.storage_gb),
    ) as StockItem[];
    return { req, stock };
  }, [id, shop?.id]);

  useEffect(() => {
    if (data?.req && condition === null && data.req.condition_pref === 'new') setCondition('new');
  }, [data?.req, condition]);

  function applyStock(s: StockItem) {
    setStockId(s.id);
    setPrice(s.price.toLocaleString('en-US'));
    setCondition(s.condition);
    setBattery(s.battery_health ? String(s.battery_health) : '');
    setPta(s.pta_status);
    setInBox(s.in_box ?? '');
    setNotes(s.notes ?? '');
    setError(null);
  }

  async function snap() {
    try {
      const p = await takeLivePhoto();
      if (p) setPhoto(p);
    } catch (e) {
      Alert.alert('Camera', errorMessage(e));
    }
  }

  if (!shop || loading || !data) return <Loading />;
  const r = data.req;
  const amount = parseAmount(price);
  const inBudget = !Number.isNaN(amount) && amount >= r.budget_min && amount <= r.budget_max;
  const batteryNum = parseAmount(battery);

  async function send() {
    setError(null);
    if (Number.isNaN(amount) || amount <= 0) return setError('Enter your price');
    if (!condition) return setError('Choose the condition');
    if (condition !== 'new' && (Number.isNaN(batteryNum) || batteryNum < 1 || batteryNum > 100)) return setError('Enter battery health (1–100)');
    if (!pta) return setError('Choose PTA status');
    if (!photo) return setError('Take a live photo of this phone');
    setBusy(true);
    try {
      const path = await uploadOfferPhoto(shop!.id, photo);
      const { error: err } = await supabase.from('offers').insert({
        request_id: r.id,
        shop_id: shop!.id,
        stock_item_id: stockId,
        price: amount,
        condition,
        battery_health: condition === 'new' ? null : batteryNum,
        pta_status: pta,
        in_box: inBox.trim() || null,
        notes: notes.trim() || null,
        photo_path: path,
      });
      if (err) throw err;
      router.replace('/shop');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header={<TopBar title="Reply to buyer" right={<View style={{ marginRight: 8 }}><Countdown until={r.expires_at} /></View>} />}
      footer={
        <>
          <ErrorText>{error}</ErrorText>
          <Button title="Send offer" icon="forward" onPress={send} loading={busy} />
          <Muted style={{ textAlign: 'center', fontSize: 12 }}>The buyer sees your price, photo and shop location.</Muted>
        </>
      }
    >
      <Stack gap={6} style={{ padding: 16, borderRadius: radius.xl, backgroundColor: colors.soft }}>
        <Overline>Buyer wants</Overline>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18 }}>
          {r.device_models?.model} · {storageLabel(r.storage_gb)}
          {r.color ? ` · ${r.color}` : ''}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>
          {conditionPrefLabel[r.condition_pref]}
          {r.min_battery ? ` · Battery ${r.min_battery}%+` : ''} · {ptaPrefLabel[r.pta_pref]} · {rs(r.budget_min)}–{rs(r.budget_max)}
        </Text>
      </Stack>

      {data.stock.length > 0 ? (
        <Section title="Pick from your stock">
          {data.stock.map((s) => {
            const on = stockId === s.id;
            return (
              <Pressable
                key={s.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => applyStock(s)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: on ? 2 : 1.5, borderColor: on ? colors.ink : colors.line }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15 }}>
                    {s.color ?? 'Any colour'} · {conditionLabel[s.condition]}
                  </Text>
                  <Muted style={{ fontSize: 13 }}>
                    {s.battery_health ? `${s.battery_health}% · ` : ''}
                    {ptaLabel[s.pta_status]} · {rs(s.price)}
                  </Muted>
                </View>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: on ? 7 : 2, borderColor: on ? colors.ink : '#BDBDB7' }} />
              </Pressable>
            );
          })}
        </Section>
      ) : null}

      <Field
        label="Your price (Rs)"
        big
        value={price}
        onChangeText={(t) => setPrice(formatAmountInput(t))}
        keyboardType="number-pad"
        placeholder="198,000"
        hint={Number.isNaN(amount) ? undefined : inBudget ? "Inside the buyer's budget" : "Outside the buyer's budget — they may skip it"}
      />

      <Section title="Condition">
        <ChipGroup options={CONDITIONS.map((c) => ({ value: c, label: c === 'new' ? 'New' : conditionLabel[c].replace('Used · ', '') }))} value={condition} onChange={setCondition} />
      </Section>

      <Row gap={10} style={{ alignItems: 'flex-start' }}>
        {condition !== 'new' ? (
          <View style={{ flex: 1 }}>
            <Field label="Battery %" value={battery} onChangeText={(t) => setBattery(t.replace(/[^0-9]/g, '').slice(0, 3))} keyboardType="number-pad" placeholder="89" />
          </View>
        ) : null}
        <View style={{ flex: 1.4, gap: 6 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15 }}>PTA</Text>
          <ChipGroup options={PTA.map((p) => ({ value: p, label: p === 'pta_approved' ? 'PTA' : 'Non-PTA' }))} value={pta} onChange={setPta} />
        </View>
      </Row>

      <Field label="In the box" value={inBox} onChangeText={setInBox} placeholder="Box and charger (optional)" />
      <Field label="Note for the buyer" value={notes} onChangeText={setNotes} placeholder="e.g. Light scratches on the frame, screen clean" multiline style={{ height: 80, paddingTop: 12, textAlignVertical: 'top', fontSize: 15 }} />

      <Section title="Live photo (required)">
        {photo ? (
          <Row gap={12}>
            <Image source={{ uri: photo.uri }} style={{ width: 92, height: 92, borderRadius: radius.md }} />
            <Stack gap={4}>
              <Row gap={6}>
                <Icon name="check" size={18} color={colors.greenDark} strokeWidth={2.6} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.greenDark }}>Photo added</Text>
              </Row>
              <Pressable accessibilityRole="button" onPress={snap} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, textDecorationLine: 'underline' }}>Retake</Text>
              </Pressable>
            </Stack>
          </Row>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={snap}
            style={{ height: 92, borderRadius: radius.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: '#BDBDB7', backgroundColor: '#FAFAF8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          >
            <Icon name="camera" size={24} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 15 }}>Take photo of this phone</Text>
          </Pressable>
        )}
      </Section>
    </Screen>
  );
}
