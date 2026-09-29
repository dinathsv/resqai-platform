import React from 'react';
import { View, Text, TextInput, StyleSheet, ViewStyle } from 'react-native';
import Colors from '../constants/colors';

interface MinimalInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  error?: string;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  style?: ViewStyle;
}

export default function MinimalInput({
  label,
  value,
  onChangeText,
  placeholder = '',
  secureTextEntry = false,
  error = '',
  keyboardType = 'default',
  style,
}: MinimalInputProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.gray}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    width: '100%',
  },
  label: {
    fontSize: 12,
    color: Colors.gray,
    marginBottom: 6,
  },
  input: {
    fontSize: 16,
    color: Colors.black,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.black,
    borderRadius: 0,
  },
  error: {
    fontSize: 12,
    color: Colors.red,
    marginTop: 4,
  },
});
