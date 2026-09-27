import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/format';
import { colors, fonts, radius } from '@/lib/theme';
import { Button, ErrorText, H1, Muted, Screen, TopBar } from '@/components/ui';

export default function Verify() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  async function verify(value = code) {
    if (value.length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ phone: String(phone), token: value, type: 'sms' });
    setBusy(false);
    if (err) {
      setError(errorMessage(err));
      return;
    }
    router.replace('/');
  }

  async function resend() {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({ phone: String(phone) });
    if (err) setError(errorMessage(err));
    else setResent(true);
  }

  return (
    <Screen header={<TopBar />} footer={<Button title="Verify" onPress={() => verify()} loading={busy} />}>
      <View style={{ gap: 10 }}>
        <H1>Enter the code</H1>
        <Muted>We sent a 6-digit code to {phone}.</Muted>
      </View>
      <View style={{ gap: 8 }}>
        <TextInput
          value={code}
          onChangeText={(t) => {
            const digits = t.replace(/[^0-9]/g, '').slice(0, 6);
            setCode(digits);
            setError(null);
            if (digits.length === 6) verify(digits);
          }}
          keyboardType="number-pad"
          autoFocus
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          accessibilityLabel="Verification code"
          placeholder="000000"
          placeholderTextColor={colors.faint}
          style={{ height: 64, borderRadius: radius.md, borderWidth: 2, borderColor: error ? colors.red : colors.ink, paddingHorizontal: 16, fontFamily: fonts.bold, fontSize: 28, letterSpacing: 10, color: colors.ink }}
        />
        <ErrorText>{error}</ErrorText>
      </View>
      <Button title={resent ? 'Code sent again' : 'Send the code again'} variant="ghost" onPress={resend} disabled={resent} />
    </Screen>
  );
}
