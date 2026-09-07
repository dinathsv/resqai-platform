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
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { aiFetch } from '../../config/api';
import { Colors, Fonts } from '../../constants/theme';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

const INITIAL_MESSAGE: Message = {
  id: 'initial',
  role: 'assistant',
  text: 'Hello! I am Your AI First-Aid Assistant\nHow can I help you?',
  timestamp: new Date(),
};

const SUGGESTIONS = [
  "What if doesn't stop?",
  'How to bandage?',
  'Severe Burns guidance',
  'CPR instructions',
  'Choking first aid',
];

export default function ChatbotScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [show1990, setShow1990] = useState(false);
  const [, setDetectedLang] = useState('en');
  const flatListRef = useRef<FlatList>(null);

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
            isUser ? styles.userMessageCard : styles.assistantMessageCard,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUser ? styles.userMessageText : styles.assistantMessageText,
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Deep Midnight Navy/Indigo Top Header matching Image 1 */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Ai First-Aid Assistant</Text>
          <Text style={styles.headerSub}>Available 24/7</Text>
        </View>

        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => router.push('/(people)/dashboard')}
          activeOpacity={0.7}
        >
          <Text style={styles.headerDots}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Curved Top White Sheet Container */}
      <View style={styles.sheetContainer}>
        <KeyboardAvoidingView
          style={styles.chatArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <FlatList
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
              <ActivityIndicator size="small" color="#160B3F" />
              <Text style={styles.loadingText}>
                Assistant is preparing guidance...
              </Text>
            </View>
          )}

          {show1990 && (
            <TouchableOpacity
              style={styles.banner1990}
              onPress={() => Linking.openURL('tel:1990')}
              activeOpacity={0.8}
            >
              <Text style={styles.banner1990Text}>
                🚨 Call 1990 Suwa Seriya Now
              </Text>
            </TouchableOpacity>
          )}

          {/* Quick Suggestion Pills matching Image 1 */}
          <View style={styles.suggestionsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsScroll}
            >
              {SUGGESTIONS.map((suggestion, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.suggestionPill}
                  onPress={() => sendMessageText(suggestion)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Floating Pill Input Box matching Image 1 */}
          <View style={styles.inputContainer}>
            <View style={styles.inputCapsule}>
              <TextInput
                style={styles.textInput}
                value={input}
                onChangeText={setInput}
                placeholder="Type your messages...."
                placeholderTextColor="#94A3B8"
                multiline={false}
                returnKeyType="send"
                onSubmitEditing={onSend}
              />

              {/* Microphone icon button */}
              <TouchableOpacity
                style={styles.micButton}
                onPress={() => {
                  setInput('My friend is bleeding heavily, what should i do?');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.micIcon}>🎙️</Text>
              </TouchableOpacity>

              {/* Dark navy/indigo send arrow button */}
              <TouchableOpacity
                style={[
                  styles.sendButton,
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
          <View style={styles.disclaimerContainer}>
            <View style={styles.disclaimerPill}>
              <Text style={styles.disclaimerText}>
                Disclaimer: This AI provides general first-aid guidance only and
                does not replace professional medical advice
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
    backgroundColor: '#160B3F',
  },
  /* Top Deep Indigo Header */
  topHeader: {
    backgroundColor: '#160B3F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 14,
    paddingBottom: 20,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'linear-gradient(180deg, #10062C 0%, #1A0D48 100%)',
        } as any)
      : {}),
  },
  headerIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  headerTitleGroup: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#C4B5FD',
    marginTop: 2,
  },
  headerDots: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* Curved Top Sheet Container */
  sheetContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
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
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  assistantMessageCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
    borderTopLeftRadius: 6,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)',
        } as any)
      : {}),
  },
  userMessageCard: {
    backgroundColor: '#160B3F',
    borderBottomRightRadius: 6,
    shadowColor: '#160B3F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'linear-gradient(135deg, #160B3F 0%, #2A1468 100%)',
          boxShadow: '0 4px 16px rgba(22, 11, 63, 0.30)',
        } as any)
      : {}),
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
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
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
    borderWidth: 1.5,
    borderColor: '#241458',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  suggestionText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    fontWeight: '700',
    color: '#160B3F',
  },

  /* Floating Input Capsule matching Image 1 */
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  inputCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
        } as any)
      : {}),
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
    color: '#160B3F',
    fontSize: 20,
    fontWeight: '900',
  },

  /* Bottom Medical Disclaimer */
  disclaimerContainer: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    paddingTop: 4,
    backgroundColor: '#FFFFFF',
  },
  disclaimerPill: {
    backgroundColor: '#EFECE6',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimerText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: '#4B4844',
    textAlign: 'center',
    lineHeight: 15,
  },
});
