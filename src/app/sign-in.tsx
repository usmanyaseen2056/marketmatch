import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { errorMessage, toPkPhone } from '@/lib/format';
import { colors, fonts, radius } from '@/lib/theme';
import { Button, ErrorText, H1, Muted, Screen } from '@/components/ui';

export default function SignIn() {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    const full = toPkPhone(phone);
    if (!full) {
      setError('Enter a Pakistani mobile number, e.g. 0300 1234567');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({ phone: full });
    setBusy(false);
    if (err) {
      setError(errorMessage(err));
      return;
    }
    router.push({ pathname: '/verify', params: { phone: full } });
  }

  return (
    <Screen footer={<Button title="Send code" onPress={send} loading={busy} />}>
      <View style={{ marginTop: 48, gap: 12 }}>
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 22 }}>M</Text>
        </View>
        <H1>Find your phone without walking 50 shops</H1>
        <Muted>Enter your mobile number. We'll send you a code by SMS.</Muted>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15 }}>Mobile number</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ height: 56, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.soft, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 17 }}>+92</Text>
          </View>
          <TextInput
            value={phone}
            onChangeText={(t) => {
              setPhone(t);
              setError(null);
            }}
            placeholder="300 1234567"
            placeholderTextColor={colors.faint}
            keyboardType="phone-pad"
            autoFocus
            accessibilityLabel="Mobile number"
            onSubmitEditing={send}
            style={{ flex: 1, height: 56, borderRadius: radius.md, borderWidth: 1.5, borderColor: error ? colors.red : colors.line, paddingHorizontal: 14, fontFamily: fonts.semibold, fontSize: 18, color: colors.ink }}
          />
        </View>
        <ErrorText>{error}</ErrorText>
      </View>
    </Screen>
  );
}
