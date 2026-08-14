import { Stack } from 'expo-router'

export default function PeopleLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFF' },
        headerTintColor: '#000',
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="donate" options={{ title: 'Donate' }} />
      <Stack.Screen name="volunteer" options={{ title: 'Volunteer' }} />
      <Stack.Screen name="quiz" options={{ title: 'Quiz' }} />
    </Stack>
  )
}
