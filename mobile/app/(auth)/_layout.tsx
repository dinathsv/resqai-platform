

import { Stack } from 'expo-router';
import { Colors, Fonts } from '../../constants/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.accent,
        headerTitleStyle: { fontWeight: '700', fontFamily: Fonts.bold },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Sign In', headerShown: false }} />
      <Stack.Screen name="register" options={{ title: 'Create Account', headerShown: false }} />
      <Stack.Screen name="verify-otp" options={{ title: 'Verify OTP' }} />
      <Stack.Screen name="guest" options={{ title: 'Guest Access', headerShown: false }} />
    </Stack>
  );
}
