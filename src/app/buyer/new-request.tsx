import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { must, useLoad } from '@/lib/data';
import { conditionPrefLabel, errorMessage, formatAmountInput, parseAmount, ptaPrefLabel, storageLabel } from '@/lib/format';
import { colors, fonts, radius } from '@/lib/theme';
import type { ConditionPref, DeviceModel, PtaPref } from '@/lib/types';
import { Body, Button, ChipGroup, ErrorText, Field, Icon, Loading, Muted, Row, Screen, Section, TopBar } from '@/components/ui';

const PTA: PtaPref[] = ['pta_approved', 'non_pta', 'any'];
const CONDITIONS: ConditionPref[] = ['new', 'used', 'any'];
const BATTERY = [80, 85, 90, 0];
const TTL = [15, 30];

export default function NewRequest() {
  const { session } = useAuth();
  const params = useLocalSearchParams<{ marketId: string; marketName?: string; brand?: string }>();
  const [brand, setBrand] = useState<string | null>(params.brand ?? null);
  const [query, setQuery] = useState('');
  const [model, setModel] = useState<DeviceModel | null>(null);
  const [storage, setStorage] = useState<number | null>(null);
  const [color, setColor] = useState<string>('any');
  const [pta, setPta] = useState<PtaPref>('any');
  const [cond, setCond] = useState<ConditionPref>('any');
  const [battery, setBattery] = useState<number>(0);
  const [minB, setMinB] = useState('');
  const [maxB, setMaxB] = useState('');
  const [ttl, setTtl] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: models, loading } = useLoad(
    async () => must(await supabase.from('device_models').select('*').order('sort_order')) as DeviceModel[],
    [],
  );

  const brands = useMemo(() => Array.from(new Set((models ?? []).map((m) => m.brand))), [models]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (models ?? []).filter(
      (m) => (!brand || m.brand === brand) && (!q || `${m.brand} ${m.model}`.toLowerCase().includes(q)),
    );
  }, [models, brand, query]);

  function pick(m: DeviceModel) {
    setModel(m);
    setStorage(m.storage_options.length === 1 ? m.storage_options[0] : null);
    setColor('any');
    setError(null);
  }

  const min = parseAmount(minB);
  const max = parseAmount(maxB);
  const budgetError =
    minB && maxB && !Number.isNaN(min) && !Number.isNaN(max) && max < min ? '"To" must be more than "From"' : null;

  const summary = model
    ? `We'll alert shops in ${params.marketName ?? 'this market'} that have ${model.model}${storage ? ' ' + storageLabel(storage) : ''}${
        color !== 'any' ? ' in ' + color : ''
      }, ${conditionPrefLabel[cond].toLowerCase()}${!Number.isNaN(min) && !Number.isNaN(max) ? `, within Rs ${minB}–${maxB}` : ''}.`
    : '';

  async function submit() {
    setError(null);
    if (!model) return setError('Choose a phone model');
    if (!storage) return setError('Choose storage');
    if (Number.isNaN(min) || Number.isNaN(max)) return setError('Enter your budget');
    if (max < min) return setError('"To" must be more than "From"');
    if (!params.marketId || !session) return setError('Choose a market first');
    setBusy(true);
    const { data, error: err } = await supabase
      .from('requests')
      .insert({
        buyer_id: session.user.id,
        market_id: params.marketId,
        device_model_id: model.id,
        storage_gb: storage,
        color: color === 'any' ? null : color,
        pta_pref: pta,
        condition_pref: cond,
        min_battery: battery,
        budget_min: min,
        budget_max: max,
        expires_at: new Date(Date.now() + ttl * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();
    setBusy(false);
    if (err) return setError(errorMessage(err));
    router.replace(`/buyer/request/${data.id}`);
  }

  if (loading) return <Loading />;

  // Step 1: pick the model
  if (!model) {
    return (
      <Screen header={<TopBar title="Which phone?" />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 56, paddingHorizontal: 16, borderRadius: radius.lg, backgroundColor: colors.soft }}>
          <Icon name="search" size={20} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search model"
            placeholderTextColor={colors.muted}
            autoFocus={!brand}
            accessibilityLabel="Search model"
            style={{ flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.ink }}
          />
        </View>
        <ChipGroup
          options={[{ value: '__all', label: 'All brands' }, ...brands.map((b) => ({ value: b, label: b }))]}
          value={brand ?? '__all'}
          onChange={(v) => setBrand(v === '__all' ? null : v)}
        />
        <View style={{ gap: 8 }}>
          {filtered.map((m) => (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              onPress={() => pick(m)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.lineSoft, opacity: pressed ? 0.8 : 1 })}
            >
              <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="smartphone" size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Muted style={{ fontSize: 12 }}>{m.brand}</Muted>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>{m.model}</Text>
              </View>
              <Icon name="forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
          {filtered.length === 0 ? <Muted>No models match. Try another name.</Muted> : null}
        </View>
      </Screen>
    );
  }

  // Step 2: details
  return (
    <Screen
      header={<TopBar title="New request" />}
      footer={
        <>
          {summary ? <Body style={{ fontSize: 14, color: colors.inkSoft }}>{summary}</Body> : null}
          <ErrorText>{error}</ErrorText>
          <Button title="Send to shops" icon="forward" onPress={submit} loading={busy} />
        </>
      }
    >
      <Row gap={14} style={{ padding: 16, borderRadius: radius.xl, backgroundColor: colors.soft }}>
        <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="smartphone" size={26} />
        </View>
        <View style={{ flex: 1 }}>
          <Muted style={{ fontSize: 13 }}>{model.brand}</Muted>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18 }}>{model.model}</Text>
        </View>
        <Button title="Change" variant="secondary" onPress={() => setModel(null)} style={{ flexGrow: 0, height: 44 }} />
      </Row>

      <Section title="Storage">
        <ChipGroup options={model.storage_options.map((g) => ({ value: g, label: storageLabel(g) }))} value={storage} onChange={setStorage} />
      </Section>

      {model.colors.length ? (
        <Section title="Color">
          <ChipGroup options={[{ value: 'any', label: 'Any color' }, ...model.colors.map((c) => ({ value: c, label: c }))]} value={color} onChange={setColor} />
        </Section>
      ) : null}

      <Section title="PTA status">
        <ChipGroup options={PTA.map((p) => ({ value: p, label: p === 'any' ? 'Any' : ptaPrefLabel[p] }))} value={pta} onChange={setPta} />
      </Section>

      <Section title="Condition">
        <ChipGroup options={CONDITIONS.map((c) => ({ value: c, label: c === 'any' ? 'Any' : conditionPrefLabel[c] }))} value={cond} onChange={setCond} />
      </Section>

      {cond !== 'new' ? (
        <Section title="Minimum battery health">
          <ChipGroup options={BATTERY.map((b) => ({ value: b, label: b ? `${b}%+` : 'Any' }))} value={battery} onChange={setBattery} />
        </Section>
      ) : null}

      <Section title="Budget (Rs)">
        <Row gap={10} style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Field label="From" value={minB} onChangeText={(t) => setMinB(formatAmountInput(t))} keyboardType="number-pad" placeholder="180,000" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="To" value={maxB} onChangeText={(t) => setMaxB(formatAmountInput(t))} keyboardType="number-pad" placeholder="220,000" error={budgetError} />
          </View>
        </Row>
      </Section>

      <Section title="Keep request open for">
        <ChipGroup options={TTL.map((t) => ({ value: t, label: `${t} min` }))} value={ttl} onChange={setTtl} />
      </Section>
    </Screen>
  );
}
