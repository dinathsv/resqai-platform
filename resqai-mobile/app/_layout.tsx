import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Colors from '../constants/colors';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.white,
          },
          headerTintColor: Colors.black,
          headerTitleStyle: {
            fontWeight: '600',
            color: Colors.black,
          },
          headerShadowVisible: false,
          headerBackTitle: '<',
          contentStyle: {
            backgroundColor: Colors.white,
          },
          animation: 'none',
        }}
      />
    </>
  );
}
