import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Colors from '../../../constants/colors';

export default function AlertDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Alert #{id}</Text>
      <Text style={styles.placeholder}>Alert details here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: Colors.white,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 16,
  },
  placeholder: {
    fontSize: 14,
    color: Colors.gray,
  },
});
