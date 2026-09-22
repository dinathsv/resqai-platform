

import { Stack } from 'expo-router';
import { Fonts } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

export default function AuthLayout() {
  const { theme } = useTheme();
  
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.textPrimary,
        headerTitleStyle: { fontWeight: '700', fontFamily: Fonts.bold },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Sign In', headerShown: false }} />
      <Stack.Screen name="register" options={{ title: 'Create Account', headerShown: false }} />
      <Stack.Screen name="verify-otp" options={{ title: 'Verify OTP' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Forgot Password' }} />
      <Stack.Screen name="reset-password" options={{ title: 'Reset Password' }} />
      <Stack.Screen name="guest" options={{ title: 'Guest Access', headerShown: false }} />
    </Stack>
  );
}
