import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { useRouter } from 'expo-router';
import { aiFetch } from '../../config/api';
import { Colors, Fonts } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import TopBar from '../../components/TopBar';
interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

type WebSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type WebSpeechRecognitionConstructor = new () => WebSpeechRecognition;

interface NativeSpeechRecognitionModule {
  addListener: (
    eventName: string,
    listener: (event: NativeSpeechEvent) => void,
  ) => { remove: () => void };
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  isRecognitionAvailable: () => boolean;
  start: (options: {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    maxAlternatives: number;
    addsPunctuation: boolean;
  }) => void;
  stop: () => void;
}

interface NativeSpeechEvent {
  error?: string;
  results?: Array<{ transcript?: string }>;
}

const nativeSpeechRecognition =
  Platform.OS === 'web'
    ? null
    : requireOptionalNativeModule<NativeSpeechRecognitionModule>('ExpoSpeechRecognition');

function useNativeSpeechRecognitionEvent(
  eventName: string,
  listener: (event: NativeSpeechEvent) => void,
) {
  useEffect(() => {
    if (!nativeSpeechRecognition) return undefined;
    const subscription = nativeSpeechRecognition.addListener(eventName, listener);
    return () => subscription.remove();
  }, [eventName, listener]);
}

declare global {
  interface Window {
    SpeechRecognition?: WebSpeechRecognitionConstructor;
    webkitSpeechRecognition?: WebSpeechRecognitionConstructor;
  }
}

export default function ChatbotScreen() {
  const { theme } = useTheme();
  const { language, t } = useLanguage();
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
  const [isListening, setIsListening] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState(
    language === 'si' ? 'si-LK' : language === 'ta' ? 'ta-LK' : 'en-US'
  );

  useEffect(() => {
    setVoiceLanguage(language === 'si' ? 'si-LK' : language === 'ta' ? 'ta-LK' : 'en-US');
  }, [language]);
  const [, setDetectedLang] = useState('en');
  const flatListRef = useRef<FlatList>(null);
  const webRecognitionRef = useRef<WebSpeechRecognition | null>(null);
  const webListeningRef = useRef(false);
  const webTranscriptRef = useRef('');
  const webRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useNativeSpeechRecognitionEvent('start', () => setIsListening(true));
  useNativeSpeechRecognitionEvent('end', () => setIsListening(false));
  useNativeSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript;
    if (transcript) {
      setInput(transcript);
    }
  });
  useNativeSpeechRecognitionEvent('error', (event) => {
    setIsListening(false);
    if (event.error !== 'aborted') {
      Alert.alert(
        'Voice input',
        event.error === 'not-allowed'
          ? 'Allow microphone access to use voice input.'
          : 'Voice input is not available. Please try again.',
      );
    }
  });

  useEffect(() => {
    async function checkAuth() {
      const token = await AsyncStorage.getItem('token');
      const guestToken = await AsyncStorage.getItem('guest_token');

      if (!token && !guestToken) {
        console.log('Chatbot: Running as anonymous');
      }
    }
    checkAuth();
  }, []);

  useEffect(() => {
    return () => {
      webListeningRef.current = false;
      if (webRestartTimerRef.current) {
        clearTimeout(webRestartTimerRef.current);
      }
      webRecognitionRef.current?.abort();
      webRecognitionRef.current = null;
    };
  }, []);

  const sendMessageText = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

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
        // Fallback realistic first aid response if backend is offline/mocking
        let fallbackReply =
          'Follow these steps to stop the bleeding:\n\n1. Apply firm direct pressure on the wound using a clean cloth or bandage\n\n2. Keep the injured part above Heart level\n\n3. Do not remove the cloth if it becomes soaked.\n\n4. Seek medical help immediately.';
        if (!trimmed.toLowerCase().includes('bleed')) {
          fallbackReply =
            'For immediate first-aid: keep the patient calm, ensure their airway is clear, and call 1990 Suwa Seriya if symptoms are severe.';
        }

        const assistantMsg: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: fallbackReply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text:
          'Follow these steps to stop the bleeding:\n\n1. Apply firm direct pressure on the wound using a clean cloth or bandage\n\n2. Keep the injured part above Heart level\n\n3. Do not remove the cloth if it becomes soaked.\n\n4. Seek medical help immediately.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  };

  const onSend = () => {
    sendMessageText(input);
  };

  const toggleVoiceInput = async () => {
    if (isListening) {
      if (Platform.OS === 'web') {
        webListeningRef.current = false;
        if (webRestartTimerRef.current) {
          clearTimeout(webRestartTimerRef.current);
          webRestartTimerRef.current = null;
        }
        webRecognitionRef.current?.stop();
      } else {
        nativeSpeechRecognition?.stop();
      }
      return;
    }

    try {
      if (Platform.OS === 'web') {
        const SpeechRecognition =
          window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
          Alert.alert(
            'Voice input unavailable',
            'Use Chrome or Edge to use voice input in the browser.',
          );
          return;
        }

        const recognition = new SpeechRecognition();
        webRecognitionRef.current = recognition;
        webListeningRef.current = true;
        webTranscriptRef.current = '';
        recognition.lang = voiceLanguage;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let finalText = webTranscriptRef.current;
          let interimText = '';

          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const text = event.results[index][0]?.transcript ?? '';
            if (event.results[index].isFinal) {
              finalText += `${text} `;
            } else {
              interimText += text;
            }
          }

          webTranscriptRef.current = finalText;
          setInput(`${finalText}${interimText}`.trim());
        };
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          if (
            event.error === 'not-allowed' ||
            event.error === 'service-not-allowed'
          ) {
            webListeningRef.current = false;
            setIsListening(false);
            Alert.alert('Microphone access needed', 'Allow microphone access in your browser.');
          } else if (event.error === 'network') {
            setIsListening(true);
          } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
            webListeningRef.current = false;
            setIsListening(false);
            console.warn('Web voice input stopped:', event.error);
          }
        };
        recognition.onend = () => {
          if (webListeningRef.current && webRecognitionRef.current === recognition) {
            webRestartTimerRef.current = setTimeout(() => {
              if (webListeningRef.current && webRecognitionRef.current === recognition) {
                try {
                  recognition.start();
                } catch {
                  setIsListening(true);
                }
              }
            }, 150);
          } else {
            setIsListening(false);
          }
        };

        recognition.start();
        return;
      }

      if (!nativeSpeechRecognition) {
        console.warn('Voice input requires a development build on native platforms.');
        return;
      }

      const permission = await nativeSpeechRecognition.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone access needed', 'Allow microphone access to use voice input.');
        return;
      }

      if (!nativeSpeechRecognition.isRecognitionAvailable()) {
        Alert.alert('Voice input unavailable', 'Speech recognition is not available on this device.');
        return;
      }

      nativeSpeechRecognition.start({
        lang: voiceLanguage,
        interimResults: true,
        continuous: true,
        maxAlternatives: 1,
        addsPunctuation: true,
      });
    } catch (error) {
      console.error('Voice input error:', error);
      Alert.alert('Voice input error', 'Could not start voice input. Please try again.');
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(people)/dashboard');
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
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

          {show1990 && (
            <TouchableOpacity
              style={[styles.banner1990, { backgroundColor: theme.error }]}
              onPress={() => Linking.openURL('tel:1990')}
              activeOpacity={0.8}
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
                  disabled={isListening}
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
                  !nativeSpeechRecognition && Platform.OS !== 'web' && styles.micButtonDisabled,
                ]}
                onPress={toggleVoiceInput}
                disabled={!nativeSpeechRecognition && Platform.OS !== 'web'}
                activeOpacity={0.7}
                accessibilityLabel={isListening ? 'Stop voice input' : 'Start voice input'}
              >
                <Text style={[styles.micIcon, { opacity: theme.isDark ? 0.8 : 1 }]}>
                  {isListening ? '■' : '🎙️'}
                </Text>
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
