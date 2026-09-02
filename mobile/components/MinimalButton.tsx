

import React from 'react'
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { Colors, Fonts } from '../constants/theme'

interface MinimalButtonProps {
  title: string
  onPress: () => void
  variant?: 'primary' | 'outline' | 'cta'
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
  const isCta = variant === 'cta'
  const isPrimary = variant === 'primary'
  const isOutline = variant === 'outline'

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.base,
        isPrimary && styles.primary,
        isOutline && styles.outline,
        isCta && styles.cta,
        small && styles.small,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          isPrimary && styles.primaryText,
          isOutline && styles.outlineText,
          isCta && styles.ctaText,
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
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  cta: {
    backgroundColor: Colors.cta,
    shadowColor: Colors.cta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  small: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
  },
  primaryText: {
    color: Colors.white,
  },
  outlineText: {
    color: Colors.accent,
  },
  ctaText: {
    color: Colors.white,
  },
  smallText: {
    fontSize: 13,
  },
})
