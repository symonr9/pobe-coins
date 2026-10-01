import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from '@/i18n';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/bits';
import { Screen, Stack } from '@/ui/layout';
import { Text } from '@/ui/Text';
import { haptic } from '@/lib/feedback';

/** Scans a household join QR code. */
export default function Scan() {
  const { t } = useTranslation();
  const [permission, request] = useCameraPermissions();
  const [done, setDone] = useState(false);
  return (
    <Screen scroll={false}>
      <Header title={t('Scan join code')} />
      {!permission?.granted ? (
        <Stack>
          <Text color="soft">{t('Pobe Coins needs the camera to scan the join code your admin shows you.')}</Text>
          <Button title={t('Allow camera')} onPress={request} />
        </Stack>
      ) : (
        <View style={styles.frame}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (done) return;
              const token = data.split('/join/').pop()?.split(/[?#]/)[0];
              if (!data.includes('/join/') || !token) return;
              setDone(true);
              haptic.success();
              router.replace({ pathname: '/join/[token]', params: { token } });
            }}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 1, width: '100%', maxWidth: 420, alignSelf: 'center', borderRadius: 28, overflow: 'hidden' },
});
