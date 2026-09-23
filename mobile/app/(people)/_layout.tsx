

import { Stack } from 'expo-router';
import { Fonts } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

export default function PeopleLayout() {
  const { theme } = useTheme();

  return (
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
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="alerts" options={{ headerShown: false }} />
      <Stack.Screen name="activities" options={{ headerShown: false }} />
      <Stack.Screen name="help" options={{ headerShown: false }} />
      <Stack.Screen name="chatbot" options={{ headerShown: false }} />
      <Stack.Screen name="locator" options={{ headerShown: false }} />
      <Stack.Screen name="donate" options={{ headerShown: true, title: 'Donate' }} />
      <Stack.Screen name="volunteer" options={{ headerShown: true, title: 'Volunteer' }} />
      <Stack.Screen name="prediction" options={{ headerShown: false }} />
      <Stack.Screen name="quiz" options={{ headerShown: true, title: 'Quiz' }} />
    </Stack>
  );
}