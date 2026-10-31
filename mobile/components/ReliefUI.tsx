import React from 'react';
import { usePathname } from 'expo-router';
import { View, Text, StyleSheet, TextInput, TextInputProps, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Fonts } from '../constants/theme';

export function ReliefPage({ title, subtitle, children, refreshing = false, onRefresh }: React.PropsWithChildren<{title: string; subtitle?: string; refreshing?: boolean; onRefresh?: () => void}>) {
  const { theme } = useTheme(); const pathname = usePathname();
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: theme.background }}>
    <TopBar title={title} showBack />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={reliefStyles.page} refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
      {subtitle ? <Text style={[reliefStyles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text> : null}{children}
    </ScrollView><BottomNav currentTab={/activities|donate|volunteer/.test(pathname) ? 'activities' : 'home'} />
  </SafeAreaView>;
}
export function ReliefCard({ children }: React.PropsWithChildren) {
  const { theme } = useTheme(); return <View style={[reliefStyles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>{children}</View>;
}
export function ReliefText({ children, title = false, muted = false }: React.PropsWithChildren<{title?: boolean; muted?: boolean}>) {
  const { theme } = useTheme(); return <Text style={[title ? reliefStyles.title : reliefStyles.text, { color: muted ? theme.textSecondary : theme.textPrimary }]}>{children}</Text>;
}
export function ReliefField({ label, ...props }: TextInputProps & {label: string}) {
  const { theme } = useTheme(); return <View style={{ gap: 7 }}><ReliefText>{label}</ReliefText><TextInput {...props} accessibilityLabel={label} placeholderTextColor={theme.textMuted} style={[reliefStyles.input, { color: theme.textPrimary, borderColor: theme.inputBorder, backgroundColor: theme.inputBg }, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, props.style]} /></View>;
}
export function ReliefBadge({ status }: { status: string }) {
  const { theme } = useTheme(); const { t } = useLanguage();
  const good = ['verified', 'delivered', 'received', 'completed', 'sent', 'resolved'].includes(status);
  const bad = ['failed', 'rejected', 'disputed'].includes(status);
  const key = `relief.${status}`; const translated = t(key);
  return <View style={[reliefStyles.badge, { backgroundColor: good ? theme.successSubtle : bad ? theme.errorSubtle : theme.warningSubtle }]}><Text style={{ fontFamily: Fonts.semiBold, fontSize: 11, color: good ? theme.success : bad ? theme.error : theme.warning }}>{translated === key ? status.replace(/_/g, ' ') : translated}</Text></View>;
}
export const reliefStyles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 115, gap: 18, width: '100%', maxWidth: 720, alignSelf: 'center' },
  subtitle: { fontSize: 15, lineHeight: 23, fontFamily: Fonts.regular },
  card: { borderWidth: 1, borderRadius: 18, padding: 20, gap: 13 },
  title: { fontSize: 18, lineHeight: 25, fontFamily: Fonts.semiBold },
  text: { fontSize: 14, lineHeight: 22, fontFamily: Fonts.regular },
  input: { borderWidth: 1, borderRadius: 10, padding: 13, fontSize: 15, fontFamily: Fonts.regular },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
});
