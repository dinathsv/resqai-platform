import { Stack } from 'expo-router';
import Colors from '../../constants/colors';

export default function GuestLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.black,
        headerTitleStyle: { fontWeight: '600', color: Colors.black },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.white },
      }}
    >
      <Stack.Screen name="nic-verify" options={{ title: 'Verify NIC' }} />
      <Stack.Screen name="request" options={{ title: 'Guest Request' }} />
    </Stack>
  );
}
