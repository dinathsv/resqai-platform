
import React, { useState } from 'react'
import { View, Text, TextInput, StyleSheet, KeyboardTypeOptions } from 'react-native'
import { Colors, Fonts, Glass } from '../constants/theme'

interface MinimalInputProps {
  label: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  keyboardType?: KeyboardTypeOptions
  secureTextEntry?: boolean
  maxLength?: number
}

export default function MinimalInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  secureTextEntry = false,
  maxLength,
}: MinimalInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, isFocused && styles.labelFocused]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          isFocused && styles.inputFocused,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        maxLength={maxLength}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  labelFocused: {
    color: Colors.accent,
    fontFamily: Fonts.semiBold,
  },
  input: {
    ...Glass.input,
    paddingVertical: 13,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  inputFocused: {
    borderColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
})
