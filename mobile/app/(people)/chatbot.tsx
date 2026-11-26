import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { aiFetch } from '../../config/api';
import { Colors, Fonts } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { usePeopleAccess } from '../../context/PeopleAccessContext';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import TopBar from '../../components/TopBar';
interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export default function ChatbotScreen() {
  const { theme } = useTheme();
  const { language, t } = useLanguage();
  const { canUseRequests, guestStatus } = usePeopleAccess();
  const router = useRouter();

  const initialText = t('chatbot.initialGreeting');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'initial',
      role: 'assistant',
      text: initialText,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [show1990, setShow1990] = useState(false);
  const voice = useVoiceInput(setInput);
  const isListening = voice.state === 'listening';
  const voiceBusy = voice.state === 'starting' || voice.state === 'stopping';
  const [voiceLanguage, setVoiceLanguage] = useState(
    language === 'si' ? 'si-LK' : language === 'ta' ? 'ta-LK' : 'en-US'
  );

  useEffect(() => {
    setVoiceLanguage(language === 'si' ? 'si-LK' : language === 'ta' ? 'ta-LK' : 'en-US');
  }, [language]);
  const [, setDetectedLang] = useState('en');
  const flatListRef = useRef<FlatList>(null);

  const sendMessageText = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;
    voice.cancel();

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await aiFetch('/api/ai/first-aid-chat', {
        method: 'POST',
        body: JSON.stringify({
          message: trimmed,
          language: 'auto',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMsg: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: data.reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);

        if (data.language_detected) {
          setDetectedLang(data.language_detected);
        }

        if (data.show_1990) {
          setShow1990(true);
        }
      } else {
        throw new Error('AI request failed');
      }
    } catch (err) {
      console.warn('Chat request unavailable');
      setShow1990(true);
      setMessages((prev) => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: 'The AI service is temporarily unavailable. Please try again shortly. If this is a life-threatening emergency, call 1990 (Suwa Seriya) immediately.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const onSend = () => {
    sendMessageText(input);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(canUseRequests ? '/(people)/dashboard' : '/(auth)/login');
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.userMessageRow : styles.assistantMessageRow,
        ]}
      >
        <View
          style={[
            styles.messageCard,
            isUser
              ? styles.userMessageCard
              : {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.border,
                },
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUser ? styles.userMessageText : { color: theme.textPrimary },
            ]}
          >
            {item.text}
          </Text>
        </View>
        <Text
          style={[
            styles.timestamp,
            isUser ? styles.userTimestamp : styles.assistantTimestamp,
          ]}
        >
          {formatTimestamp(item.timestamp)}
        </Text>
      </View>
    );
  };

  const suggestions = [
    t('chatbot.sugBleeding'),
    t('chatbot.sugBandage'),
    t('chatbot.sugBurns'),
    t('chatbot.sugCpr'),
    t('chatbot.sugChoking'),
  ];

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Midnight Navy Top Header with Back and 3-Dot Navigation Menu */}
      <TopBar
        title={t('chatbot.firstAidTitle')}
        showBack
        onBack={handleBack}
        theme={theme.isDark ? 'dark' : 'light'}
        transparent={true}
      />

      {/* Curved Top Sheet Container */}
      <View style={[styles.sheetContainer, { backgroundColor: theme.isDark ? theme.surface : '#FFFFFF' }]}>
        <KeyboardAvoidingView
          style={styles.chatArea}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 72 : 0}
        >
          {guestStatus && (
            <View style={[styles.reviewBanner, { backgroundColor: theme.surfaceSubtle }]}>
              <Text accessibilityLiveRegion="polite" style={{ color: theme.textPrimary }}>{t(`auth.guestReview.${guestStatus}`)}</Text>
              {guestStatus === 'approved' && (
                <TouchableOpacity accessibilityRole="button" onPress={() => router.replace('/(people)/dashboard')}>
                  <Text style={{ color: theme.accent, fontFamily: Fonts.semiBold }}>{t('nav.home')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <FlatList
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            ref={flatListRef as any}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
          />

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.accent} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                {t('chatbot.assistantPreparing')}
              </Text>
            </View>
          )}

          {(show1990 || !canUseRequests) && (
            <TouchableOpacity
              style={[styles.banner1990, { backgroundColor: theme.error }]}
              onPress={() => Linking.openURL('tel:1990')}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.banner1990Text}>
                {t('chatbot.call1990Now')}
              </Text>
            </TouchableOpacity>
          )}

          {/* Quick Suggestion Pills */}
          <View style={[styles.suggestionsWrapper, { backgroundColor: theme.surface }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsScroll}
            >
              {suggestions.map((suggestion, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.suggestionPill,
                    { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
                  ]}
                  onPress={() => sendMessageText(suggestion)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.suggestionText, { color: theme.textSecondary }]}>
                    {suggestion}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Floating Pill Input Box */}
          <View style={[styles.inputContainer, { backgroundColor: theme.surface }]}>
            <View style={styles.voiceLanguageRow}>
              {[
                { label: 'English', value: 'en-US' },
                { label: 'සිංහල', value: 'si-LK' },
                { label: 'தமிழ்', value: 'ta-LK' },
              ].map((langOpt) => (
                <TouchableOpacity
                  key={langOpt.value}
                  style={[
                    styles.voiceLanguageButton,
                    {
                      backgroundColor:
                        voiceLanguage === langOpt.value
                          ? theme.accent
                          : theme.surfaceElevated,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => setVoiceLanguage(langOpt.value)}
                  disabled={isListening || voiceBusy}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.voiceLanguageText,
                      {
                        color:
                          voiceLanguage === langOpt.value
                            ? theme.white
                            : theme.textSecondary,
                      },
                    ]}
                  >
                    {langOpt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View
              style={[
                styles.inputCapsule,
                { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
              ]}
            >
              <TextInput
                style={[styles.textInput, { color: theme.textPrimary }]}
                value={input}
                onChangeText={setInput}
                editable={!isListening && !voiceBusy}
                placeholder={t('chatbot.typeMessagePlaceholder')}
                placeholderTextColor={theme.textMuted}
                multiline={false}
                returnKeyType="send"
                onSubmitEditing={onSend}
              />

              {/* Microphone icon button */}
              <TouchableOpacity
                style={[
                  styles.micButton,
                  voiceBusy && styles.micButtonDisabled,
                ]}
                onPress={() => void voice.toggle(input, voiceLanguage)}
                disabled={voiceBusy}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t(isListening ? 'chatbot.stopVoice' : 'chatbot.startVoice')}
              >
                {voiceBusy ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <Text style={[styles.micIcon, { opacity: theme.isDark ? 0.8 : 1 }]}>
                    {isListening ? '■' : '🎙️'}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Dark navy/indigo send arrow button */}
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  { backgroundColor: theme.brand },
                  (!input.trim() || loading) && styles.sendButtonMuted,
                ]}
                onPress={onSend}
                disabled={loading || !input.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.sendArrow}>➤</Text>
              </TouchableOpacity>
            </View>
            {voice.issue && (
              <View style={styles.voiceFeedback}>
                <Text accessibilityRole="alert" style={{ color: theme.textSecondary }}>
                  {t(`chatbot.${voice.issue}`)}
                </Text>
                {voice.issue === 'micSettingsPermission' && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => void Linking.openSettings().catch(() => {})}
                  >
                    <Text style={{ color: theme.accent, fontFamily: Fonts.semiBold }}>
                      {t('chatbot.openSettings')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Bottom Medical Disclaimer Pill matching Image 1 */}
          <View style={[styles.disclaimerContainer, { backgroundColor: theme.surface }]}>
            <View style={[styles.disclaimerPill, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <Text style={[styles.disclaimerText, { color: theme.isDark ? theme.textSecondary : '#4B4844' }]}>
                General first-aid tips only. Not medical advice.
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  reviewBanner: {
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    gap: 8,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  /* Top Deep Indigo Header - Replaced with minimal standard header */
  topHeader: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 14,
    paddingBottom: 20,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: '#0F172A',
    fontWeight: '700',
  },
  headerTitleGroup: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#64748B',
    marginTop: 2,
  },
  headerDots: {
    fontSize: 22,
    color: '#0F172A',
    fontWeight: '700',
  },

  /* Curved Top Sheet Container */
  sheetContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  chatArea: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 12,
  },
  messageRow: {
    marginVertical: 8,
    maxWidth: '85%',
  },
  userMessageRow: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  assistantMessageRow: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },

  /* Message Cards */
  messageCard: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  assistantMessageCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderTopLeftRadius: 4,
  },
  userMessageCard: {
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    lineHeight: 22,
  },
  assistantMessageText: {
    color: '#0F172A',
    fontWeight: '500',
  },
  userMessageText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  userTimestamp: {
    textAlign: 'right',
    paddingRight: 4,
  },
  assistantTimestamp: {
    textAlign: 'left',
    paddingLeft: 4,
  },

  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: Fonts.medium,
  },

  banner1990: {
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 18,
    borderRadius: 14,
    marginBottom: 8,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 8px rgba(220, 38, 38, 0.25)' } as any)
      : {
          shadowColor: '#DC2626',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
        }),
    elevation: 3,
  },
  banner1990Text: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: Fonts.bold,
    fontWeight: '800',
    textAlign: 'center',
  },

  /* Suggestions row */
  suggestionsWrapper: {
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  suggestionsScroll: {
    paddingHorizontal: 18,
    gap: 10,
  },
  suggestionPill: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
  },
  suggestionText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#0F172A',
  },

  /* Floating Input Capsule matching Image 1 */
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  voiceLanguageRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  voiceLanguageButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  voiceLanguageText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
  },
  voiceFeedback: {
    marginTop: 6,
    gap: 6,
    alignItems: 'flex-start',
  },
  inputCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: Fonts.regular,
    color: '#0F172A',
    paddingVertical: 10,
  },
  micButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  micButtonDisabled: {
    opacity: 0.45,
  },
  micIcon: {
    fontSize: 18,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonMuted: {
    opacity: 0.45,
  },
  sendArrow: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },

  /* Bottom Medical Disclaimer */
  disclaimerContainer: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    paddingTop: 4,
    backgroundColor: '#FFFFFF',
  },
  disclaimerPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimerText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 15,
  },
});
