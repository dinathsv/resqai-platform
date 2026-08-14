/**
 * ResQAI — People Layout
 * Stack navigator for the people (public user) screens.
 */

import { Stack } from 'expo-router';

export default function PeopleLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFFFFF' },
        animation: 'slide_from_right',
      }}
    />
  );
}
