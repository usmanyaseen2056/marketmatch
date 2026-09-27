import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/format';
import { colors, fonts } from '@/lib/theme';
import { Button, H1, Loading, Muted, Screen, TopBar } from '@/components/ui';

export default function ScanShopQr() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const handling = useRef(false);

  if (!permission) return <Loading />;

  if (!permission.granted) {
    return (
      <Screen header={<TopBar title="Scan shop QR" />} footer={<Button title="Allow camera" onPress={requestPermission} />}>
        <H1>Camera needed</H1>
        <Muted>We use the camera only to scan the shop's QR code, so your visit counts and you can leave a review.</Muted>
      </Screen>
    );
  }

  async function onScan(code: string) {
    if (handling.current) return;
    handling.current = true;
    const { error: err } = await supabase.rpc('confirm_visit', { p_visit_id: id, p_code: code });
    if (err) {
      setError(errorMessage(err));
      setTimeout(() => (handling.current = false), 2000);
      return;
    }
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => onScan(data)}
      />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.95)' }}>
        <TopBar title="Scan the shop's QR" subtitle="Ask the shopkeeper to show it on their phone" />
      </View>
      <View style={{ position: 'absolute', top: '32%', alignSelf: 'center', width: 240, height: 240, borderRadius: 24, borderWidth: 4, borderColor: '#fff' }} />
      {error ? (
        <View style={{ position: 'absolute', bottom: 48, left: 20, right: 20, padding: 16, borderRadius: 14, backgroundColor: colors.redSoft }}>
          <Text style={{ fontFamily: fonts.bold, color: colors.red, fontSize: 15 }}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}
