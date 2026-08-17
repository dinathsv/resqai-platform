

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
          <Text style={styles.messageText}>{item.text}</Text>
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
            <ActivityIndicator size="small" color="#000000" />
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
              Call 1990 Suwa Seriya Now
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Describe your emergency..."
            placeholderTextColor="#999999"
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={onSend}
          />
          <TouchableOpacity
            onPress={onSend}
            disabled={loading || !input.trim()}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.sendButton,
                (!input.trim() || loading) && styles.sendButtonDisabled,
              ]}
            >
              Send
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    fontSize: 22,
    color: '#000000',
    paddingRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
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
    padding: 10,
  },
  userBubble: {
    backgroundColor: '#F5F5F5',

  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 3,
    borderLeftColor: '#000000',
  },
  messageText: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 11,
    color: '#999999',
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
    color: '#888888',
    marginLeft: 8,
  },
  banner1990: {
    backgroundColor: '#000000',
    paddingVertical: 14,
    paddingHorizontal: 16,

  },
  banner1990Text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#000000',
    padding: 8,
    fontSize: 15,
    color: '#000000',

  },
  sendButton: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
    paddingHorizontal: 16,
  },
  sendButtonDisabled: {
    color: '#CCCCCC',
  },
});
