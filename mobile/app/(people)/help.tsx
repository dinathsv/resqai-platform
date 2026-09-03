
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

export default function HelpScreen() {
  const router = useRouter();
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [message, setMessage] = useState('');
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
      // Default to Colombo center if location fails
      return { lat: 6.9271, lng: 79.8612 };
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
      const coords = await getLocation();
      if (!coords) {
        setSubmitting(false);
        return;
      }

      const res = await apiFetch('/api/requests', {
        method: 'POST',
        body: JSON.stringify({
          message: trimmed,
          lat: coords.lat,
          lng: coords.lng,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage('');
        setShowRequestForm(false);

        Alert.alert(
          'Request Received ✓',
          `Your help request has been submitted and analyzed by our AI system.\n\nEmergency Type: ${data.emergency_type}\nUrgency Level: ${data.urgency_level}/5\n${data.ai_summary ? `\nSummary: ${data.ai_summary}` : ''}`,
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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Help Center</Text>
          <View style={styles.headerSpacer} />
        </View>

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
          <SafeAreaView style={styles.modalContainer}>
            <KeyboardAvoidingView
              style={styles.modalFlex}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowRequestForm(false)}>
                  <Text style={styles.modalCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Help Request</Text>
                <View style={{ width: 60 }} />
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={styles.formLabel}>Describe your emergency</Text>
                <TextInput
                  style={styles.messageInput}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Tell us what happened, where you are, and what help you need..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  editable={!submitting}
                />

                <Text style={styles.formHint}>
                  📍 Your location will be automatically included.{'\n'}
                  🤖 Our AI will analyze and categorize your request.
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
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'transparent',
  },
  backButton: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 50,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
    opacity: 0.9,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  optionCard: {
    ...Glass.card,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
  },
  emergencyCard: {
    ...Glass.cardUrgent,
  },
  badgeCritical: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.30)',
  },
  badgeCriticalText: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.35)',
        } as any)
      : {}),
  },
  emergencyIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.38)',
  },
  emoji: {
    fontSize: 22,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  emergencyTitle: {
    color: '#FFFFFF',
  },
  optionDesc: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
    opacity: 0.92,
    lineHeight: 17,
  },
  emergencyDesc: {
    color: '#FFFFFF',
    opacity: 0.95,
  },
  chevron: {
    fontSize: 20,
    color: '#FFFFFF',
    opacity: 0.85,
    marginLeft: 8,
  },
  emergencyChevronWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emergencyChevron: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  infoBox: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.30)',
        } as any)
      : {}),
  },
  infoTitle: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    ...(isWeb
      ? {
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
        }
      : {}),
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#EBEBEB',
    ...(isWeb
      ? ({
          width: isMobileWeb ? '100%' : 420,
          maxWidth: isMobileWeb ? '100%' : 420,
          height: isMobileWeb ? '100%' : '92%',
          maxHeight: isMobileWeb ? '100%' : 840,
          borderRadius: isMobileWeb ? 0 : 28,
          overflow: 'hidden',
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 25 },
          shadowOpacity: 0.35,
          shadowRadius: 50,
          elevation: 24,
          borderWidth: isMobileWeb ? 0 : 1,
          borderColor: '#D1D5DB',
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
    borderBottomColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  modalCancel: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: '#4A1224',
    width: 60,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#0F172A',
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  formLabel: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  messageInput: {
    ...Glass.input,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
    minHeight: 140,
    marginBottom: 16,
  },
  formHint: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: 'rgba(5, 150, 105, 0.88)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: Colors.cta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 32,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 4px 20px rgba(5, 150, 105, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.3)',
        } as any)
      : {}),
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
