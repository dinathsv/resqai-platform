

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
    paddingHorizontal: 22,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primary: {
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  outline: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.borderDark,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cta: {
    backgroundColor: Colors.cta,
    shadowColor: Colors.cta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  small: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  disabled: {
    opacity: 0.45,
  },
  text: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.2,
  },
  primaryText: {
    color: Colors.white,
  },
  outlineText: {
    color: Colors.textPrimary,
  },
  ctaText: {
    color: Colors.white,
  },
  smallText: {
    fontSize: 13,
  },
});
