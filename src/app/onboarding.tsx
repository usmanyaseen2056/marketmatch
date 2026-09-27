import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/format';
import { colors, fonts, radius } from '@/lib/theme';
import type { Role } from '@/lib/types';
import { Button, ErrorText, Field, H1, Icon, Muted, Screen } from '@/components/ui';

const ROLES: { value: Role; title: string; text: string; icon: string }[] = [
  { value: 'buyer', title: "I'm buying a phone", text: 'Post what you want, compare offers, walk to the right shop.', icon: 'smartphone' },
  { value: 'shopkeeper', title: 'I own a phone shop', text: 'Get buyer requests in your plaza and reply with your price.', icon: 'store' },
];

export default function Onboarding() {
  const { session, profile, refresh } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [role, setRole] = useState<Role | null>(profile?.role ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (name.trim().length < 2) return setError('Please enter your name');
    if (!role) return setError('Choose how you will use MarketMatch');
    if (!session) return;
    setBusy(true);
    const { error: err } = await supabase.from('profiles').update({ full_name: name.trim(), role }).eq('id', session.user.id);
    setBusy(false);
    if (err) return setError(errorMessage(err));
    await refresh();
    router.replace('/');
  }

  return (
    <Screen footer={<Button title="Continue" onPress={save} loading={busy} />}>
      <View style={{ marginTop: 24, gap: 8 }}>
        <H1>Welcome to MarketMatch</H1>
        <Muted>Tell us a little about you.</Muted>
      </View>
      <Field label="Your name" value={name} onChangeText={(t) => { setName(t); setError(null); }} placeholder="e.g. Usman" autoCapitalize="words" />
      <View style={{ gap: 10 }}>
        {ROLES.map((r) => {
          const on = role === r.value;
          return (
            <Pressable
              key={r.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => { setRole(r.value); setError(null); }}
              style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 16, borderRadius: radius.xl, borderWidth: on ? 2 : 1.5, borderColor: on ? colors.ink : colors.line }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: on ? colors.ink : colors.soft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={r.icon} color={on ? '#fff' : colors.ink} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>{r.title}</Text>
                <Muted style={{ fontSize: 13 }}>{r.text}</Muted>
              </View>
            </Pressable>
          );
        })}
      </View>
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
