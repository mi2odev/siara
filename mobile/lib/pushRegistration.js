// Helpers around expo-notifications / expo-device.
//
// Returns null + a reason if the device cannot deliver push (simulator,
// permission denied, etc.). The screen logic decides how to surface that to
// the user.

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function requestPushPermissionAndToken() {
  if (!Device.isDevice) {
    return { token: null, reason: 'simulator' };
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') {
    return { token: null, reason: 'permission_denied' };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'SIARA alerts',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync();
  const token = String(tokenResponse?.data || '').trim();
  if (!token) {
    return { token: null, reason: 'no_token' };
  }

  return {
    token,
    platform: Platform.OS, // 'ios' | 'android'
    deviceName: Device.modelName || Device.deviceName || null,
    appVersion: Device?.osVersion ? `${Device.osVersion}` : null,
  };
}
