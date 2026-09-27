import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { must, useLoad } from '@/lib/data';
import { errorMessage } from '@/lib/format';
import type { Market } from '@/lib/types';
import { Button, ChipGroup, ErrorText, Field, H1, Loading, Muted, Screen, Section, TopBar } from '@/components/ui';

const FLOORS = ['Basement', 'Ground', '1st floor', '2nd floor', '3rd floor', '4th floor', '5th floor'];

export default function ShopSetup() {
  const { session, shop, refresh } = useAuth();
  const editing = !!shop;
  const [marketId, setMarketId] = useState<string | null>(shop?.market_id ?? null);
  const [name, setName] = useState(shop?.name ?? '');
  const [floor, setFloor] = useState<string | null>(shop?.floor_label ?? null);
  const [wing, setWing] = useState(shop?.wing ?? '');
  const [stall, setStall] = useState(shop?.stall_number ?? '');
  const [landmark, setLandmark] = useState(shop?.landmark ?? '');
  const [steps, setSteps] = useState<string[]>(() => {
    const d = shop?.directions ?? [];
    return [d[0] ?? '', d[1] ?? '', d[2] ?? ''];
  });
  const [phone, setPhone] = useState(shop?.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: markets, loading } = useLoad(async () => must(await supabase.from('markets').select('*').order('name')) as Market[], []);
  useEffect(() => {
    if (!marketId && markets?.length) setMarketId(markets[0].id);
  }, [markets, marketId]);

  async function save() {
    setError(null);
    if (!marketId) return setError('Choose your market');
    if (name.trim().length < 2) return setError('Enter your shop name');
    if (!floor) return setError('Choose your floor');
    if (!stall.trim()) return setError('Enter your shop number');
    if (!session) return;
    const values = {
      name: name.trim(),
      floor_label: floor,
      wing: wing.trim() || null,
      stall_number: stall.trim(),
      landmark: landmark.trim() || null,
      directions: steps.map((s) => s.trim()).filter(Boolean),
      phone: phone.trim() || null,
    };
    setBusy(true);
    const { error: err } = editing
      ? await supabase.from('shops').update(values).eq('id', shop!.id)
      : await supabase.from('shops').insert({ ...values, owner_id: session.user.id, market_id: marketId });
    setBusy(false);
    if (err) return setError(errorMessage(err));
    await refresh();
    router.replace('/shop');
  }

  if (loading) return <Loading />;

  return (
    <Screen
      header={editing ? <TopBar title="Shop details" /> : undefined}
      footer={
        <>
          <ErrorText>{error}</ErrorText>
          <Button title={editing ? 'Save' : 'Open my shop'} onPress={save} loading={busy} />
        </>
      }
    >
      {!editing ? (
        <View style={{ marginTop: 24, gap: 8 }}>
          <H1>Set up your shop</H1>
          <Muted>Buyers use this to walk straight to your counter. Be as exact as you can.</Muted>
        </View>
      ) : null}

      {!editing && (markets?.length ?? 0) > 1 ? (
        <Section title="Market">
          <ChipGroup options={(markets ?? []).map((m) => ({ value: m.id, label: m.name }))} value={marketId} onChange={setMarketId} />
        </Section>
      ) : null}

      <Field label="Shop name" value={name} onChangeText={setName} placeholder="e.g. Al-Madina Mobiles" autoCapitalize="words" />

      <Section title="Floor">
        <ChipGroup options={FLOORS.map((f) => ({ value: f, label: f }))} value={floor} onChange={setFloor} />
      </Section>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Field label="Shop number" value={stall} onChangeText={setStall} placeholder="214" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Wing / block" value={wing} onChangeText={setWing} placeholder="East (optional)" />
        </View>
      </View>

      <Field label="Landmark" value={landmark} onChangeText={setLandmark} placeholder="Right of the escalator near Gate 2" hint="Something a first-time visitor can spot" />

      <Section title="Walking directions from the entrance">
        {steps.map((s, i) => (
          <Field
            key={i}
            label={`Step ${i + 1}`}
            value={s}
            onChangeText={(t) => setSteps((all) => all.map((x, j) => (j === i ? t : x)))}
            placeholder={['Take the escalator by Gate 2 to the 2nd floor', 'Turn right into the east corridor', 'Third shop on the left, green signboard'][i]}
          />
        ))}
      </Section>

      <Field label="Shop phone / WhatsApp" value={phone} onChangeText={setPhone} placeholder="0300 1234567" keyboardType="phone-pad" hint="Buyers can call if they can't find you" />
    </Screen>
  );
}
