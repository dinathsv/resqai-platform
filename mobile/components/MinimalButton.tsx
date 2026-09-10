import React from 'react'
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { ThemeTokens } from '../constants/theme'
import { useTheme } from '../context/ThemeContext'
import { Fonts } from '../constants/theme'

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
  const { theme } = useTheme()
  const isCta = variant === 'cta'
  const isPrimary = variant === 'primary'
  const isOutline = variant === 'outline'

  const bgColor = isCta
    ? theme.emergency
    : isPrimary
    ? theme.brandActive
    : theme.surface

  const borderColor = isOutline ? theme.border : 'rgba(255,255,255,0.20)'
  const textColor = isOutline ? theme.textPrimary : '#FFFFFF'
  const shadowColor = isCta ? theme.emergency : isPrimary ? theme.brandActive : '#000000'

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.base,
        {
          backgroundColor: bgColor,
          borderColor,
          borderWidth: isOutline ? 1.5 : 1,
          shadowColor,
          shadowOpacity: isOutline ? 0.04 : 0.28,
        },
        small && styles.small,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: textColor, fontFamily: Fonts.semiBold },
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
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
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
    letterSpacing: 0.2,
  },
  smallText: {
    fontSize: 13,
  },
})