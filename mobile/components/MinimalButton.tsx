import React from 'react'
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'

interface MinimalButtonProps {
  title: string
  onPress: () => void
  variant?: 'primary' | 'outline'
  small?: boolean
  style?: ViewStyle
  textStyle?: TextStyle
  disabled?: boolean
}

export default function MinimalButton({
  title,
  onPress,
  variant = 'primary',
  small = false,
  style,
  textStyle,
  disabled = false,
}: MinimalButtonProps) {
  const isPrimary = variant === 'primary'

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.base,
        isPrimary ? styles.primary : styles.outline,
        small && styles.small,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          isPrimary ? styles.primaryText : styles.outlineText,
          small && styles.smallText,
          textStyle,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: '#000',
  },
  outline: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#000',
  },
  small: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryText: {
    color: '#FFF',
  },
  outlineText: {
    color: '#000',
  },
  smallText: {
    fontSize: 13,
  },
})
