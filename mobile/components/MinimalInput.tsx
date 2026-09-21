import React, { useState } from 'react'
import { View, Text, TextInput, StyleSheet, KeyboardTypeOptions } from 'react-native'
import { Fonts } from '../constants/theme'
import { useTheme } from '../context/ThemeContext'

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
  const { theme } = useTheme()
  const [isFocused, setIsFocused] = useState(false)

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.label,
          { color: isFocused ? theme.brandActive : theme.textSecondary },
          isFocused && { fontFamily: Fonts.semiBold },
        ]}
      >
        {label}
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.inputBg,
            borderColor: isFocused ? theme.brandActive : theme.inputBorder,
            color: theme.textPrimary,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
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
    marginBottom: 6,
  },
  input: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: Fonts.regular,
    borderRadius: 8,
    borderWidth: 1,
  },
})