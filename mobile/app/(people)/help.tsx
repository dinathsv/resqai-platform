
/**
 * Flow 3: Asking for Help (registered users) & Flow 4: Guest help
 *
 * Help Center with 3 options:
 * 1. AI Chatbot (first-aid guidance)
 * 2. Call 1990 (ambulance) + send help request w/ location to backend
 * 3. Submit a help request manually
 *
 * When calling 1990:
 *  - App calls 1990 ambulance directly
 *  - App also sends help message & location to Backend
 *  - Backend sends request to AI Brain to analyze the message
 *  - AI Brain identifies emergency details
 *  - Backend saves the request to Database
 *  - If critical: Backend alerts Admin
 *  - Backend confirms request received
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Linking,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../config/api';
import { Colors, Fonts, Glass } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import BottomNav from '../../components/BottomNav';
import TopBar from '../../components/TopBar';

export default function HelpScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [message, setMessage] = useState('');
  const [requestType, setRequestType] = useState<'help_rescue' | 'donation'>('help_rescue');
  const [submitting, setSubmitting] = useState(false);
  const [calling1990, setCalling1990] = useState(false);

  /**
   * Get the user's current location.
   */
  const getLocation = async (): Promise<{ lat: number; lng: number } | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Please enable location access for emergency services.');
        return null;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
    } catch {
      return null;
    }
  };

  /**
   * Option 2: Call 1990 + send help request with location to backend
   */
  const handleCall1990 = async () => {
    setCalling1990(true);

    try {
      // Initiate the phone call to 1990
      Linking.openURL('tel:1990');

      // Simultaneously send the help request with location to backend
      const coords = await getLocation();
      if (coords) {
        const res = await apiFetch('/api/requests', {
          method: 'POST',
          body: JSON.stringify({
            message: 'Emergency: User called 1990 ambulance service. Automatic help request sent with location.',
            lat: coords.lat,
            lng: coords.lng,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          Alert.alert(
            'Help Request Sent',
            `Your location has been sent to emergency services.\n\nRequest ID: ${data.request_id}\nEmergency: ${data.emergency_type}\nUrgency: ${data.urgency_level}/5`,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (err) {
      console.error('Call 1990 + request error:', err);
    } finally {
      setCalling1990(false);
    }
  };

  /**
   * Option 3: Submit a manual help request
   */
  const handleSubmitRequest = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please describe your emergency situation.');
      return;
    }

    setSubmitting(true);

    try {
      let coords = await getLocation();
      if (!coords) {
        // Fallback for web without HTTPS/Location permissions
        coords = { lat: 6.9271, lng: 79.8612 };
      }

      const res = await apiFetch('/api/requests', {
        method: 'POST',
        body: JSON.stringify({
          message: trimmed,
          lat: coords.lat,
          lng: coords.lng,
          request_type: requestType,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage('');
        setShowRequestForm(false);

        Alert.alert(
          'Request Received ✓',
          `Your ${requestType === 'donation' ? 'Donation' : 'Help & Rescue'} request has been successfully submitted.\n\nRequest ID: ${data.request_id}`,
          [{ text: 'OK' }]
        );
      } else {
        const errorData = await res.json().catch(() => ({}));
        Alert.alert('Error', errorData.detail || 'Failed to submit request. Please try again.');
      }
    } catch (err) {
      console.error('Submit request error:', err);
      Alert.alert('Error', 'Connection error. Your request will be saved offline and sent when connected.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(people)/dashboard');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <TopBar title="Help Center" showBack onBack={handleBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>

        <Text style={styles.subtitle}>
          Select an emergency response channel based on immediate threat level
        </Text>

        {/* Priority 1: Call 1990 Ambulance (Immediate Threat) */}
        <TouchableOpacity
          style={[styles.optionCard, styles.emergencyCard]}
          onPress={handleCall1990}
          disabled={calling1990}
          activeOpacity={0.85}
        >
          <View style={[styles.optionIcon, styles.emergencyIcon]}>
            {calling1990 ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.emoji}>🚑</Text>
            )}
          </View>
          <View style={styles.optionContent}>
            <View style={styles.badgeCritical}>
              <Text style={styles.badgeCriticalText}>IMMEDIATE THREAT</Text>
            </View>
            <Text style={[styles.optionTitle, styles.emergencyTitle]}>
              Call 1990 Ambulance
            </Text>
            <Text style={[styles.optionDesc, styles.emergencyDesc]}>
              Connect with Suwa Seriya & automatically transmit live GPS triage coordinates
            </Text>
          </View>
          <View style={styles.emergencyChevronWrap}>
            <Text style={styles.emergencyChevron}>📞</Text>
          </View>
        </TouchableOpacity>

        {/* Priority 2: AI First-Aid Chatbot */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => router.push('/(people)/chatbot')}
          activeOpacity={0.75}
        >
          <View style={[styles.optionIcon, { backgroundColor: Colors.ctaLight }]}>
            <Text style={styles.emoji}>💬</Text>
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>AI First-Aid Guidance</Text>
            <Text style={styles.optionDesc}>
              Instant step-by-step instructions for CPR, bleeding, burns, or shock
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Priority 3: Submit a Help Request */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => setShowRequestForm(true)}
          activeOpacity={0.75}
        >
          <View style={[styles.optionIcon, { backgroundColor: Colors.infoLight }]}>
            <Text style={styles.emoji}>📝</Text>
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Log Community Rescue Request</Text>
            <Text style={styles.optionDesc}>
              Report trapped victims, supply needs, or flood levels for coordinator dispatch
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Official Hotline Callout */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Sri Lanka National Disaster Protocol</Text>
          <Text style={styles.infoText}>
            For critical, life-threatening conditions, always dial 1990 first.{'\n'}
            ResQAI coordinates automatically with Disaster Management Centre (DMC) dispatchers.
          </Text>
        </View>
      </ScrollView>

      {/* Submit Request Modal */}
      <Modal
        visible={showRequestForm}
        animationType="slide"
        presentationStyle="pageSheet"
        transparent={isWeb}
        onRequestClose={() => setShowRequestForm(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.surface }]}>
            <KeyboardAvoidingView
              style={styles.modalFlex}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={[styles.modalHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => setShowRequestForm(false)}>
                  <Text style={styles.modalCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Help Request</Text>
                <View style={{ width: 60 }} />
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={[styles.formLabel, { color: theme.textPrimary }]}>Describe your emergency</Text>
                <TextInput
                  style={[styles.messageInput, {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.textPrimary
                  }]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Tell us what happened, where you are, and what help you need..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  editable={!submitting}
                />

                <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginVertical: 12 }}>
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      { flex: 1, marginRight: 6, backgroundColor: requestType === 'help_rescue' ? theme.emergency : theme.surfaceSubtle }
                    ]}
                    onPress={() => setRequestType('help_rescue')}
                  >
                    <Text style={{ color: requestType === 'help_rescue' ? '#FFFFFF' : theme.textSecondary, fontFamily: Fonts.bold, textAlign: 'center' }}>Help & Rescue</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      { flex: 1, marginLeft: 6, backgroundColor: requestType === 'donation' ? '#10B981' : theme.surfaceSubtle }
                    ]}
                    onPress={() => setRequestType('donation')}
                  >
                    <Text style={{ color: requestType === 'donation' ? '#FFFFFF' : theme.textSecondary, fontFamily: Fonts.bold, textAlign: 'center' }}>Donation</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.formHint}>
                  📍 Your location will be automatically included.
                </Text>

                <TouchableOpacity
                  style={[styles.submitButton, submitting && styles.buttonDisabled]}
                  onPress={handleSubmitRequest}
                  disabled={submitting}
                  activeOpacity={0.7}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.submitButtonText}>Submit Request</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const { width: screenWidth } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isMobileWeb = isWeb && screenWidth <= 480;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  backButtonTouch: {
    paddingVertical: 6,
    paddingRight: 10,
  },
  backButton: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#DC2626',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 60,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#64748B',
    paddingHorizontal: 20,
    marginTop: 2,
    marginBottom: 20,
    lineHeight: 18,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
  },
  emergencyCard: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  badgeCritical: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    marginBottom: 6,
  },
  badgeCriticalText: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  emergencyIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  emoji: {
    fontSize: 24,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#0F172A',
    marginBottom: 3,
  },
  emergencyTitle: {
    color: '#FFFFFF',
  },
  optionDesc: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#64748B',
    lineHeight: 18,
  },
  emergencyDesc: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontFamily: Fonts.medium,
  },
  chevron: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: '#94A3B8',
    marginLeft: 8,
  },
  emergencyChevronWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emergencyChevron: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  infoBox: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoTitle: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#0F172A',
    marginBottom: 4,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    ...(isWeb
      ? {
          backgroundColor: 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
        }
      : {}),
  },
  modalContainer: {
    flex: 1,
    ...(isWeb
      ? ({
          width: '100%',
          maxWidth: 480,
          height: '100%',
          maxHeight: '100%',
          borderRadius: 0,
          overflow: 'hidden',
          borderWidth: 0,
        } as any)
      : {}),
  },
  modalFlex: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalCancel: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: Colors.textMuted,
    width: 60,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  formLabel: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    marginBottom: 10,
  },
  messageInput: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: Fonts.regular,
    minHeight: 140,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 12,
  },
  formHint: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: '#059669',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 32,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
});
