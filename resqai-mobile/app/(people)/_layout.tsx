import { Stack } from 'expo-router';
import Colors from '../../constants/colors';

export default function PeopleLayout() {
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
      <Stack.Screen name="dashboard" options={{ title: 'ResQAI' }} />
      <Stack.Screen name="chatbot" options={{ title: 'First Aid Chatbot' }} />
      <Stack.Screen name="locator" options={{ title: 'Shelter Locator' }} />
      <Stack.Screen name="request" options={{ title: 'Help Request' }} />
      <Stack.Screen name="alert/[id]" options={{ title: 'Alert Details' }} />
    </Stack>
  );
}
