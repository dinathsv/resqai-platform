

import { Stack } from 'expo-router';
import { Colors, Fonts } from '../../constants/theme';

export default function PeopleLayout() {
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
      <Stack.Screen name="donate" options={{ title: 'Donate' }} />
      <Stack.Screen name="volunteer" options={{ title: 'Volunteer' }} />
      <Stack.Screen name="quiz" options={{ title: 'Quiz' }} />
    </Stack>
  );
}