

import { Stack } from 'expo-router';
import { Colors, Fonts } from '../../constants/theme';

export default function PeopleLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.accent,
        headerTitleStyle: { fontWeight: '700', fontFamily: Fonts.bold },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
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