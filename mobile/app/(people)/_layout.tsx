import { useEffect, useState, type ContextType } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { Stack } from 'expo-router';
import { apiFetch, getAuthSession } from '../../config/api';
import { Fonts } from '../../constants/theme';
import { PeopleAccessContext, type GuestStatus } from '../../context/PeopleAccessContext';
import { useTheme } from '../../context/ThemeContext';

export default function PeopleLayout() {
  const { theme } = useTheme();
  const [access, setAccess] = useState<ContextType<typeof PeopleAccessContext> | null>(null);

  useEffect(() => {
    let mounted = true;
    let checking = false;
    let guestToken: string | null = null;
    let guestStatus: GuestStatus = 'unavailable';
    let controller: AbortController | undefined;

    function updateAccess(canUseRequests: boolean, status: GuestStatus | null) {
      if (!mounted) return;
      setAccess(current => current?.canUseRequests === canUseRequests && current.guestStatus === status
        ? current : { canUseRequests, guestStatus: status });
    }

    async function refreshAccess() {
      if (checking) return;
      checking = true;
      try {
        const session = await getAuthSession();
        if (!mounted) return;
        if (session?.role !== 'guest') {
          updateAccess(!!session, !session && guestToken ? 'expired' : null);
          return;
        }

        if (guestToken !== session.token) {
          guestToken = session.token;
          guestStatus = 'unavailable';
        }
        controller = new AbortController();
        const timeout = setTimeout(() => controller?.abort(), 5000);
        try {
          const response = await apiFetch('/api/auth/me', { signal: controller.signal });
          if (response.ok) {
            const { role, identity_status } = await response.json();
            guestStatus = role === 'guest' && (identity_status === 'approved' || identity_status === 'pending' || identity_status === 'rejected')
              ? identity_status : 'unavailable';
          } else if (response.status < 500) {
            guestStatus = response.status === 401 ? 'expired' : 'unavailable';
          }
        } finally {
          clearTimeout(timeout);
          controller = undefined;
        }
        updateAccess(guestStatus === 'approved', guestStatus);
      } catch {
        updateAccess(false, 'unavailable');
      } finally {
        checking = false;
      }
    }

    void refreshAccess();
    const timer = setInterval(() => {
      if (guestToken) void refreshAccess();
    }, 10000);
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') void refreshAccess();
    });
    return () => {
      mounted = false;
      controller?.abort();
      clearInterval(timer);
      foreground.remove();
    };
  }, []);

  if (!access) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <PeopleAccessContext.Provider value={access}>
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.accent,
          headerTitleStyle: { fontWeight: '700', fontFamily: Fonts.bold },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Protected guard={access.canUseRequests}>
          <Stack.Screen name="dashboard" options={{ gestureEnabled: false }} />
          <Stack.Screen name="alerts" />
          <Stack.Screen name="alert/[id]" />
          <Stack.Screen name="activities" />
          <Stack.Screen name="help" />
          <Stack.Screen name="locator" />
          <Stack.Screen name="donate" options={{ title: 'Donate' }} />
          <Stack.Screen name="volunteer" options={{ title: 'Volunteer' }} />
          <Stack.Screen name="prediction" />
          <Stack.Screen name="quiz" options={{ headerShown: true, title: 'Quiz' }} />
        </Stack.Protected>
        <Stack.Screen name="chatbot" />
      </Stack>
    </PeopleAccessContext.Provider>
  );
}
