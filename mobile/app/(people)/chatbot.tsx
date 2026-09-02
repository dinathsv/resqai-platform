

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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { aiFetch } from '../../config/api';
import { Colors, Fonts, Glass } from '../../constants/theme';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

const INITIAL_MESSAGE: Message = {
  id: 'initial',
  role: 'assistant',
  text: 'Describe your emergency and I will provide first-aid guidance. For life-threatening emergencies call 1990 immediately.',
  timestamp: new Date(),
};

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
        console.log('Chatbot: No auth token — running as anonymous');
      }
    }
    checkAuth();
  }, []);

  const onSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev: Message[]) => [...prev, userMsg]);
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
        setMessages((prev: Message[]) => [...prev, assistantMsg]);

        if (data.language_detected) {
          setDetectedLang(data.language_detected);
        }

        if (data.show_1990) {
          setShow1990(true);
        }
      } else {

        const assistantMsg: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: 'Sorry, I am temporarily unable to respond. If this is a life-threatening emergency, please call 1990 immediately.',
          timestamp: new Date(),
        };
        setMessages((prev: Message[]) => [...prev, assistantMsg]);
        setShow1990(true);
      }
    } catch (err) {
      console.error('Chat error:', err);
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: 'Connection error. Please check your internet connection. For emergencies, call 1990.',
        timestamp: new Date(),
      };
      setMessages((prev: Message[]) => [...prev, assistantMsg]);
      setShow1990(true);
    } finally {
      setLoading(false);
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
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          <Text style={[styles.messageText, isUser && styles.userMessageText]}>{item.text}</Text>
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

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>First Aid Chat</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >

        <FlatList
          ref={flatListRef as any}
          data={messages}
          keyExtractor={(item: Message) => item.id}
          renderItem={renderMessage}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={Colors.accent} />
            <Text style={styles.loadingText}>Thinking...</Text>
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

        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Describe your emergency..."
            placeholderTextColor={Colors.textMuted}
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={onSend}
          />
          <TouchableOpacity
            onPress={onSend}
            disabled={loading || !input.trim()}
            activeOpacity={0.7}
            style={[
              styles.sendButton,
              (!input.trim() || loading) && styles.sendButtonDisabled,
            ]}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.background,
  },
  backButton: {
    fontSize: 22,
    color: Colors.accent,
    paddingRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  headerSpacer: {
    width: 34,
  },
  chatArea: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginVertical: 4,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  assistantMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: Colors.accent,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    ...Glass.card,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  userMessageText: {
    color: Colors.white,
  },
  timestamp: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginTop: 2,
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
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginLeft: 8,
  },
  banner1990: {
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  banner1990Text: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  textInput: {
    flex: 1,
    ...Glass.input,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: Colors.cta,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
});
