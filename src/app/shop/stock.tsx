import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { must, useLoad } from '@/lib/data';
import { conditionLabel, errorMessage, formatAmountInput, parseAmount, ptaLabel, rs, storageLabel } from '@/lib/format';
import { colors, fonts, radius } from '@/lib/theme';
import type { Condition, DeviceModel, PtaStatus, StockItem } from '@/lib/types';
import { Badge, Button, Card, ChipGroup, Empty, ErrorText, Field, Icon, Loading, Muted, Row, Screen, Section, Stack, TopBar } from '@/components/ui';

const CONDITIONS: Condition[] = ['new', 'a_plus', 'a', 'b', 'c'];
const PTA: PtaStatus[] = ['pta_approved', 'non_pta'];

/** "My stock": saved phones. Each one becomes a 1-tap reply template. */
export default function ShopStock() {
  const { shop } = useAuth();
  const [adding, setAdding] = useState(false);

  const { data, loading, reload } = useLoad(async () => {
    const [items, models] = await Promise.all([
      supabase.from('stock_items').select('*, device_models(*)').eq('shop_id', shop!.id).order('created_at', { ascending: false }),
      supabase.from('device_models').select('*').order('sort_order'),
    ]);
    return { items: must(items) as StockItem[], models: must(models) as DeviceModel[] };
  }, [shop?.id]);

  if (!shop || loading || !data) return <Loading />;

  if (adding) {
    return (
      <AddStock
        shopId={shop.id}
        models={data.models}
        onDone={() => {
          setAdding(false);
          reload();
        }}
      />
    );
  }

  async function toggle(item: StockItem) {
    const { error } = await supabase.from('stock_items').update({ is_available: !item.is_available }).eq('id', item.id);
    if (error) Alert.alert('Could not update', errorMessage(error));
    reload();
  }

  async function remove(item: StockItem) {
    Alert.alert('Remove this phone?', undefined, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('stock_items').delete().eq('id', item.id);
          if (error) Alert.alert('Could not remove', errorMessage(error));
          reload();
        },
      },
    ]);
  }

  return (
    <Screen header={<TopBar title="My stock" subtitle="Saved phones become 1-tap replies" />} footer={<Button title="Add a phone" icon="plus" onPress={() => setAdding(true)} />}>
      {data.items.length === 0 ? (
        <Empty title="No phones yet" text="Add the phones you have. We'll show you which buyer requests you can fill, and fill in your reply for you." />
      ) : null}
      <Stack gap={10}>
        {data.items.map((s) => (
          <Card key={s.id} style={{ opacity: s.is_available ? 1 : 0.6 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>
                  {s.device_models?.model} · {storageLabel(s.storage_gb)}
                </Text>
                <Muted style={{ fontSize: 13 }}>
                  {s.color ?? 'Any colour'} · {conditionLabel[s.condition]}
                  {s.battery_health ? ` · ${s.battery_health}%` : ''} · {ptaLabel[s.pta_status]}
                </Muted>
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>{rs(s.price)}</Text>
            </Row>
            <Row gap={8}>
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: s.is_available }} onPress={() => toggle(s)} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Badge label={s.is_available ? 'Available · tap to mark sold' : 'Sold · tap to restock'} tone={s.is_available ? 'green' : 'neutral'} />
              </Pressable>
              <View style={{ flex: 1 }} />
              <Pressable accessibilityRole="button" accessibilityLabel="Remove" onPress={() => remove(s)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="x" size={20} color={colors.muted} />
              </Pressable>
            </Row>
          </Card>
        ))}
      </Stack>
    </Screen>
  );
}

function AddStock({ shopId, models, onDone }: { shopId: string; models: DeviceModel[]; onDone: () => void }) {
  const [query, setQuery] = useState('');
  const [model, setModel] = useState<DeviceModel | null>(null);
  const [storage, setStorage] = useState<number | null>(null);
  const [color, setColor] = useState<string>('any');
  const [condition, setCondition] = useState<Condition | null>(null);
  const [battery, setBattery] = useState('');
  const [pta, setPta] = useState<PtaStatus | null>(null);
  const [price, setPrice] = useState('');
  const [inBox, setInBox] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return models.filter((m) => !q || `${m.brand} ${m.model}`.toLowerCase().includes(q)).slice(0, 30);
  }, [models, query]);

  async function save() {
    setError(null);
    const amount = parseAmount(price);
    const b = parseAmount(battery);
    if (!model) return setError('Choose a model');
    if (!storage) return setError('Choose storage');
    if (!condition) return setError('Choose condition');
    if (condition !== 'new' && (Number.isNaN(b) || b < 1 || b > 100)) return setError('Enter battery health (1–100)');
    if (!pta) return setError('Choose PTA status');
    if (Number.isNaN(amount)) return setError('Enter your price');
    setBusy(true);
    const { error: err } = await supabase.from('stock_items').insert({
      shop_id: shopId,
      device_model_id: model.id,
      storage_gb: storage,
      color: color === 'any' ? null : color,
      condition,
      battery_health: condition === 'new' ? null : b,
      pta_status: pta,
      price: amount,
      in_box: inBox.trim() || null,
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (err) return setError(errorMessage(err));
    onDone();
  }

  if (!model) {
    return (
      <Screen header={<TopBar title="Which phone?" onBack={onDone} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 56, paddingHorizontal: 16, borderRadius: radius.lg, backgroundColor: colors.soft }}>
          <Icon name="search" size={20} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search model" placeholderTextColor={colors.muted} autoFocus accessibilityLabel="Search model" style={{ flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.ink }} />
        </View>
        <Stack gap={8}>
          {filtered.map((m) => (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              onPress={() => {
                setModel(m);
                setStorage(m.storage_options.length === 1 ? m.storage_options[0] : null);
              }}
              style={{ padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.lineSoft }}
            >
              <Muted style={{ fontSize: 12 }}>{m.brand}</Muted>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>{m.model}</Text>
            </Pressable>
          ))}
        </Stack>
      </Screen>
    );
  }

  return (
    <Screen
      header={<TopBar title={`Add ${model.model}`} onBack={() => setModel(null)} />}
      footer={
        <>
          <ErrorText>{error}</ErrorText>
          <Button title="Save to my stock" onPress={save} loading={busy} />
        </>
      }
    >
      <Section title="Storage">
        <ChipGroup options={model.storage_options.map((g) => ({ value: g, label: storageLabel(g) }))} value={storage} onChange={setStorage} />
      </Section>
      {model.colors.length ? (
        <Section title="Color">
          <ChipGroup options={[{ value: 'any', label: 'Not specified' }, ...model.colors.map((c) => ({ value: c, label: c }))]} value={color} onChange={setColor} />
        </Section>
      ) : null}
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
      <Field label="Your usual price (Rs)" value={price} onChangeText={(t) => setPrice(formatAmountInput(t))} keyboardType="number-pad" placeholder="198,000" />
      <Field label="In the box" value={inBox} onChangeText={setInBox} placeholder="Box and charger (optional)" />
      <Field label="Note" value={notes} onChangeText={setNotes} placeholder="Anything buyers should know (optional)" />
    </Screen>
  );
}
