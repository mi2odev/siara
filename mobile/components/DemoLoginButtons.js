// SIARA one-click demo login — drop-in button block for the Expo app's Login
// (and/or Register) screen. Renders a button per available demo role; tapping
// one logs straight in as that role (no inputs) and hands the result to the
// host via `onAuthenticated`.
//
// Expected props the host Expo app provides:
//   - apiClient: axios instance pointing at the SIARA API (baseURL .../api)
//   - onAuthenticated(result): store result.accessToken + result.user, then
//       navigate to the role's home. `result.user.roles` tells you the role,
//       and `result.readOnly` is true for the (read-only) admin demo.
//   - rememberMe?: boolean (defaults false)
//   - onError?(message): optional error surface
//
// The component self-hides if the backend reports demo login disabled
// (ALLOW_DEMO_LOGIN=false). Dependency-light: react-native primitives only.

import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getDemoLoginOptions, demoLogin } from '../services/demoAuthService';

// Fixed display order + label/icon per demo role. Only roles the backend
// advertises as available are rendered.
const DEMO_ROLES = [
  { key: 'citizen', icon: '👤', label: 'Demo User' },
  { key: 'police', icon: '🚓', label: 'Demo Police' },
  { key: 'supervisor', icon: '🛡️', label: 'Demo Supervisor' },
  { key: 'admin', icon: '⚙️', label: 'Demo Admin' },
];

export default function DemoLoginButtons({ apiClient, onAuthenticated, rememberMe = false, onError }) {
  const [available, setAvailable] = useState([]);
  const [pendingRole, setPendingRole] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const options = await getDemoLoginOptions(apiClient);
      if (cancelled) return;
      setAvailable(options.enabled ? options.roles : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  const roles = DEMO_ROLES.filter((role) => available.includes(role.key));
  if (roles.length === 0) {
    return null;
  }

  const handleDemo = async (roleKey) => {
    if (pendingRole) return;
    setError('');
    setPendingRole(roleKey);
    try {
      const result = await demoLogin(apiClient, roleKey, rememberMe);
      if (!result.accessToken && !result.user) {
        throw new Error('Demo login failed');
      }
      if (typeof onAuthenticated === 'function') {
        onAuthenticated(result);
      }
    } catch (demoError) {
      const message =
        demoError?.response?.data?.message
        || demoError?.message
        || 'Could not start the demo session.';
      setError(message);
      if (typeof onError === 'function') onError(message);
    } finally {
      setPendingRole(null);
    }
  };

  return (
    <View style={styles.block}>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or explore a demo</Text>
        <View style={styles.dividerLine} />
      </View>
      <Text style={styles.hint}>Jump in as a sample account — no signup needed.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.grid}>
        {roles.map((role) => {
          const isPending = pendingRole === role.key;
          return (
            <TouchableOpacity
              key={role.key}
              style={[styles.btn, pendingRole ? styles.btnDisabled : null]}
              onPress={() => handleDemo(role.key)}
              disabled={Boolean(pendingRole)}
              accessibilityRole="button"
              accessibilityLabel={role.label}
            >
              {isPending ? (
                <ActivityIndicator color="#4f46e5" />
              ) : (
                <Text style={styles.icon}>{role.icon}</Text>
              )}
              <Text style={styles.label}>{isPending ? 'Entering…' : role.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.note}>The Demo Admin is read-only.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 18 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  dividerText: { marginHorizontal: 10, color: '#64748b', fontSize: 12.5 },
  hint: { textAlign: 'center', color: '#64748b', fontSize: 12.5, marginBottom: 10 },
  error: {
    color: '#b91c1c',
    fontSize: 12.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  btn: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#d8dee9',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  btnDisabled: { opacity: 0.6 },
  icon: { fontSize: 16 },
  label: { color: '#1f2937', fontSize: 13.5, fontWeight: '600' },
  note: { textAlign: 'center', color: '#94a3b8', fontSize: 11.5, marginTop: 2 },
});
