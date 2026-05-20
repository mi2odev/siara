// SIARA pairing screen — scan a QR rendered by the web Settings page (or
// receive the deep link siara://pair-device?code=...), then complete the
// pairing against /api/push/mobile/pairing-sessions/complete.
//
// Expected props/integrations the host Expo app provides:
//   - apiClient: axios instance with the user's JWT
//   - isLoggedIn(): boolean
//   - navigate(routeName): goes to the in-app login screen
//
// The screen is intentionally state-machine driven so each branch can show a
// distinct, user-readable message (Device connected / QR expired / Invalid
// QR / Login required / Notification permission denied).

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Linking from 'expo-linking';

import { parsePairingUrl } from '../lib/pairingDeepLink';
import { requestPushPermissionAndToken } from '../lib/pushRegistration';
import { completeMobilePairing } from '../services/pairingService';

// expo-camera and expo-barcode-scanner ship a single component in newer
// versions; the import surface here is the older barcode-scanner package
// which still works on all supported Expo SDKs.
import { BarCodeScanner } from 'expo-barcode-scanner';

const STAGES = Object.freeze({
  REQUESTING_CAMERA: 'requesting_camera',
  SCANNING: 'scanning',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  ERROR: 'error',
});

export default function ScanPairDeviceScreen({ apiClient, isLoggedIn, navigate }) {
  const [stage, setStage] = useState(STAGES.REQUESTING_CAMERA);
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [message, setMessage] = useState('');
  const lastCodeRef = useRef(null);

  // Ask for camera permission on mount. We don't ask for notification
  // permission yet — that comes only after we have a valid pairing code, so
  // users who back out aren't pestered for nothing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      if (cancelled) return;
      setHasCameraPermission(status === 'granted');
      setStage(status === 'granted' ? STAGES.SCANNING : STAGES.ERROR);
      if (status !== 'granted') {
        setMessage('Camera access is required to scan the pairing QR code.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Also accept the code via deep link in case the user opens the URL on the
  // same device the web is open on (e.g. tester laptop + phone). Handles
  // both cold-start and warm-start deep links.
  useEffect(() => {
    const handleUrl = ({ url }) => {
      const parsed = parsePairingUrl(url);
      if (parsed?.code) {
        void handleScannedCode(parsed.code);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });
    const subscription = Linking.addEventListener('url', handleUrl);
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScannedCode = async (rawScannedValue) => {
    if (!rawScannedValue) return;
    if (stage === STAGES.PROCESSING || stage === STAGES.SUCCESS) return;

    // The scanner sometimes hands us either the full URL or the raw code
    // string. Accept both shapes.
    let code = null;
    const parsed = parsePairingUrl(rawScannedValue);
    if (parsed?.code) code = parsed.code;
    else if (/^[A-Za-z0-9\-_]{16,128}$/.test(String(rawScannedValue).trim())) {
      code = String(rawScannedValue).trim();
    }

    if (!code) {
      setStage(STAGES.ERROR);
      setMessage('That QR code is not a SIARA pairing code.');
      return;
    }

    // Avoid duplicate submissions if the scanner emits the same frame twice.
    if (lastCodeRef.current === code) return;
    lastCodeRef.current = code;

    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
      setStage(STAGES.ERROR);
      setMessage('Please log in to SIARA first, then scan again.');
      if (typeof navigate === 'function') navigate('Login');
      return;
    }

    setStage(STAGES.PROCESSING);
    setMessage('');

    const tokenInfo = await requestPushPermissionAndToken();
    if (!tokenInfo.token) {
      setStage(STAGES.ERROR);
      if (tokenInfo.reason === 'permission_denied') {
        setMessage('Notification permission is required to receive SIARA alerts.');
      } else if (tokenInfo.reason === 'simulator') {
        setMessage('Push notifications are not supported on simulators.');
      } else {
        setMessage('Could not obtain an Expo push token on this device.');
      }
      lastCodeRef.current = null;
      return;
    }

    try {
      const result = await completeMobilePairing(apiClient, {
        code,
        token: tokenInfo.token,
        platform: tokenInfo.platform,
        provider: 'expo',
        appVersion: tokenInfo.appVersion,
        deviceName: tokenInfo.deviceName,
      });
      if (result?.device?.id) {
        setStage(STAGES.SUCCESS);
        setMessage('Device connected. You will receive SIARA notifications on this phone.');
      } else {
        setStage(STAGES.ERROR);
        setMessage('Pairing did not complete. Please try again.');
        lastCodeRef.current = null;
      }
    } catch (err) {
      setStage(STAGES.ERROR);
      const status = err?.response?.status;
      if (status === 410) {
        setMessage('That QR has expired. Please generate a new one on the web.');
      } else if (status === 409) {
        setMessage('That QR has already been used.');
      } else if (status === 403) {
        setMessage('This QR belongs to a different SIARA account.');
      } else if (status === 401) {
        setMessage('Please log in to SIARA first.');
        if (typeof navigate === 'function') navigate('Login');
      } else if (status === 400) {
        setMessage(err?.response?.data?.message || 'Invalid QR code.');
      } else {
        setMessage(err?.message || 'Pairing failed.');
      }
      lastCodeRef.current = null;
    }
  };

  if (hasCameraPermission === null || stage === STAGES.REQUESTING_CAMERA) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
        <Text style={styles.muted}>Requesting camera permission…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {(stage === STAGES.SCANNING || stage === STAGES.PROCESSING) && hasCameraPermission && (
        <BarCodeScanner
          onBarCodeScanned={
            stage === STAGES.PROCESSING ? undefined : ({ data }) => handleScannedCode(data)
          }
          style={StyleSheet.absoluteFillObject}
        />
      )}
      <View style={styles.overlay}>
        <Text style={styles.title}>Scan the pairing QR</Text>
        <Text style={styles.muted}>
          Open SIARA on the web → Settings → Notifications → Add mobile device.
        </Text>
        {stage === STAGES.PROCESSING && (
          <View style={styles.banner}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.bannerText}>Connecting this device…</Text>
          </View>
        )}
        {stage === STAGES.SUCCESS && (
          <View style={[styles.banner, styles.bannerOk]}>
            <Text style={styles.bannerText}>{message}</Text>
          </View>
        )}
        {stage === STAGES.ERROR && (
          <View style={[styles.banner, styles.bannerErr]}>
            <Text style={styles.bannerText}>{message}</Text>
            <TouchableOpacity
              onPress={() => {
                lastCodeRef.current = null;
                setMessage('');
                setStage(hasCameraPermission ? STAGES.SCANNING : STAGES.ERROR);
              }}
              style={styles.retry}
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.20)',
  },
  title: { color: '#ffffff', fontSize: 20, fontWeight: '600' },
  muted: { color: '#cbd5f5', fontSize: 14, marginTop: 6 },
  banner: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  bannerOk: { backgroundColor: 'rgba(22, 101, 52, 0.85)' },
  bannerErr: { backgroundColor: 'rgba(127, 29, 29, 0.85)' },
  bannerText: { color: '#ffffff', fontSize: 14 },
  retry: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  retryText: { color: '#ffffff', fontWeight: '600' },
});
