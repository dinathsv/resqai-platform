/**
 * Flow 4: Guest user emergency access
 * Sri Lankan NIC Verification via Induwara.lk API
 * Enforces compulsory:
 * 1. Real NIC number verification
 * 2. NIC photo card image
 * 3. Mobile phone number + OTP verification
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch } from '../../config/api';
import { Fonts, makeGlass } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import LanguageSelector from '../../components/LanguageSelector';

interface NicDecodedData {
  nic: string;
  valid: boolean;
  format?: string;
  dateOfBirth?: string;
  gender?: string;
  age?: {
    years: number;
    months: number;
    days: number;
  };
  serial?: number;
  votingEligible?: string | null;
  equivalentNewNic?: string;
  source?: string;
  lastVerified?: string;
}

interface NicCheckResult {
  isValid: boolean;
  message: string;
  data?: NicDecodedData | null;
}

export default function GuestScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const glass = useMemo(() => makeGlass(theme), [theme]);

  // Form State
  const [nic, setNic] = useState('');
  const [nicPhoto, setNicPhoto] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  // Status & Validation State
  const [validatingNic, setValidatingNic] = useState(false);
  const [nicCheckResult, setNicCheckResult] = useState<NicCheckResult | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Live Camera state for Web
  const [showWebCamera, setShowWebCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<any>(null);

  // Manage WebRTC live camera stream on Web
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    if (showWebCamera && Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof navigator?.mediaDevices?.getUserMedia === 'function') {
      navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
        .then((stream) => {
          activeStream = stream;
          setCameraStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        })
        .catch((err) => {
          console.warn('getUserMedia error, falling back to device camera:', err);
          setShowWebCamera(false);
          triggerFallbackWebCamera();
        });
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [showWebCamera]);

  // Resend Countdown Timer
  useEffect(() => {
    let timer: any = null;
    if (resendCountdown > 0) {
      timer = setTimeout(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [resendCountdown]);

  const handleCloseWebCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowWebCamera(false);
  };

  const handleSnapWebCamera = () => {
    if (videoRef.current && typeof document !== 'undefined') {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setNicPhoto(dataUrl);
        setPhotoUri(dataUrl);
      }
    }
    handleCloseWebCamera();
  };

  const triggerFallbackWebCamera = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.setAttribute('capture', 'environment');
      input.style.display = 'none';
      document.body.appendChild(input);
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            setNicPhoto(dataUrl);
            setPhotoUri(dataUrl);
          };
          reader.readAsDataURL(file);
        }
        document.body.removeChild(input);
      };
      input.click();
    }
  };

  const ensureBase64 = async (asset: ImagePicker.ImagePickerAsset): Promise<string> => {
    if (asset.base64) {
      return asset.base64.startsWith('data:')
        ? asset.base64
        : `data:image/jpeg;base64,${asset.base64}`;
    }
    if (Platform.OS === 'web' && asset.uri) {
      try {
        const resp = await fetch(asset.uri);
        const blob = await resp.blob();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {
        return asset.uri;
      }
    }
    return asset.uri;
  };

  const handlePickGallery = async () => {
    try {
      setError('');
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string;
              setNicPhoto(dataUrl);
              setPhotoUri(dataUrl);
            };
            reader.readAsDataURL(file);
          }
          document.body.removeChild(input);
        };
        input.click();
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Needed',
          'Please allow access to your photo library to select your NIC photo.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const dataUrl = await ensureBase64(asset);
        setNicPhoto(dataUrl);
        setPhotoUri(asset.uri);
      }
    } catch (err) {
      console.error('Gallery pick error:', err);
      setError('Could not select image. Please try again.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      setError('');
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && typeof navigator?.mediaDevices?.getUserMedia === 'function') {
          setShowWebCamera(true);
        } else {
          triggerFallbackWebCamera();
        }
        return;
      }

      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera Permission Needed',
          'Please allow camera access in device settings to take a photo of your NIC card.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const dataUrl = await ensureBase64(asset);
        setNicPhoto(dataUrl);
        setPhotoUri(asset.uri);
      }
    } catch (err) {
      console.error('Camera error on native:', err);
      setError('Could not access camera. You can choose a photo from your gallery instead.');
    }
  };

  const handleRemovePhoto = () => {
    setNicPhoto(null);
    setPhotoUri(null);
  };

  // Real-time NIC Validation via Induwara.lk API
  const handleValidateNic = async (nicValue?: string) => {
    const raw = (nicValue !== undefined ? nicValue : nic).trim().toUpperCase();
    if (!raw) {
      setError('Please enter a Sri Lankan NIC number.');
      setNicCheckResult(null);
      return false;
    }

    const nicRegex = /^[0-9]{9}[VvXx]$|^[0-9]{12}$/;
    if (!nicRegex.test(raw)) {
      setNicCheckResult({
        isValid: false,
        message: 'NIC must be 10 characters (e.g. 923456789V) or 12 digits (e.g. 199234567890).',
        data: null,
      });
      return false;
    }

    setError('');
    setValidatingNic(true);

    try {
      const res = await apiFetch(`/api/auth/guest/validate-nic/${encodeURIComponent(raw)}`);
      const body = await res.json();
      const isOk = Boolean(body.is_valid);
      setNicCheckResult({
        isValid: isOk,
        message: body.message,
        data: body.data,
      });
      return isOk;
    } catch (err) {
      console.error('NIC validation network error:', err);
      setNicCheckResult({
        isValid: false,
        message: 'Unable to connect to NIC verification service. Please verify your connection.',
        data: null,
      });
      return false;
    } finally {
      setValidatingNic(false);
    }
  };

  const handleNicTextChange = (text: string) => {
    const uppercaseText = text.toUpperCase();
    setNic(uppercaseText);

    if (nicCheckResult) {
      setNicCheckResult(null);
    }

    const trimmed = uppercaseText.trim();
    if (trimmed.length === 10 || trimmed.length === 12) {
      handleValidateNic(trimmed);
    }
  };

  // Send OTP to Mobile Number
  const handleSendOtp = async () => {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setError('Please enter your mobile phone number.');
      return;
    }

    const trimmedNic = nic.trim().toUpperCase();
    if (!trimmedNic) {
      setError('Please enter your NIC number first.');
      return;
    }

    setError('');
    setSendingOtp(true);

    try {
      const res = await apiFetch('/api/auth/guest/send-otp', {
        method: 'POST',
        body: JSON.stringify({
          phone_number: trimmedPhone,
          nic_number: trimmedNic,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setOtpSent(true);
        setOtpMessage(data.message || `Verification code sent to ${trimmedPhone}`);
        setResendCountdown(45);
      } else {
        setError(data.detail || 'Could not send verification code. Please check your phone number.');
      }
    } catch (err) {
      console.error('Send guest OTP error:', err);
      setError('Unable to send verification code. Please check your connection.');
    } finally {
      setSendingOtp(false);
    }
  };

  // Final Submission: Compulsorily checks NIC number, NIC photo, and Mobile OTP
  const handleVerifyNic = async () => {
    setError('');

    // 1. NIC number validation
    const trimmedNic = nic.trim().toUpperCase();
    if (!trimmedNic) {
      setError('NIC number is compulsory. Please enter and verify your NIC number.');
      return;
    }

    if (!nicCheckResult?.isValid) {
      const isReal = await handleValidateNic(trimmedNic);
      if (!isReal) {
        setError(nicCheckResult?.message || 'Invalid or fake NIC number. Please enter a genuine NIC.');
        return;
      }
    }

    // 2. Compulsory NIC photo
    if (!nicPhoto || !photoUri) {
      setError('NIC image is compulsory. Please capture or upload your NIC card photo.');
      return;
    }

    // 3. Compulsory Mobile Number & OTP
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setError('Mobile number is compulsory. Please enter your mobile number.');
      return;
    }

    if (!otpSent) {
      setError('Please tap "Send OTP" to receive your verification code.');
      return;
    }

    const trimmedOtp = otp.trim();
    if (!trimmedOtp || trimmedOtp.length < 4) {
      setError('Please enter the 6-digit OTP code sent to your mobile number.');
      return;
    }

    setLoading(true);

    try {
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      } catch {
        // Non-blocking location capture
      }

      const res = await apiFetch('/api/auth/guest/verify-nic', {
        method: 'POST',
        body: JSON.stringify({
          nic_number: trimmedNic,
          nic_photo: nicPhoto,
          phone_number: trimmedPhone,
          otp: trimmedOtp,
          lat,
          lng,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        await AsyncStorage.setItem('guest_token', data.access_token);
        await AsyncStorage.setItem('guest_phone', data.phone_number || trimmedPhone);
        await AsyncStorage.setItem('guest_nic', data.nic_number || trimmedNic);
        router.replace('/(people)/dashboard');
      } else {
        setError(data.detail || t('common.error'));
      }
    } catch {
      console.error('Guest complete verification error');
      setError(t('auth.connectionError'));
    } finally {
      setLoading(false);
    }
  };

  const isDark = theme.isDark;

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
          {/* Top navigation */}
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(auth)/login');
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color={theme.brandActive} style={{ marginRight: 4 }} />
            <Text style={[styles.backText, { color: theme.brandActive }]}>
              {t('auth.signIn')}
            </Text>
          </TouchableOpacity>

          {/* Header icon and branding (without removed subtitle text) */}
          <View style={styles.headerArea}>
            <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7' }]}>
              <Ionicons name="shield-checkmark" size={38} color="#10B981" />
            </View>

            <Text style={[styles.title, { color: theme.textPrimary }]}>
              {t('auth.guestSignIn')}
            </Text>
          </View>

          <View style={[styles.card, glass.card, { borderColor: theme.border }]}>
            <LanguageSelector variant="segmented" style={{ marginBottom: 18 }} />

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2', borderColor: '#EF4444' }]}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" style={{ marginRight: 6 }} />
                <Text style={[styles.errorText, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>{error}</Text>
              </View>
            ) : null}

            {/* 1. Sri Lankan NIC Number (Compulsory) */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Ionicons name="card-outline" size={16} color={theme.brandActive} style={{ marginRight: 6 }} />
                <Text style={[styles.label, { color: theme.textPrimary }]}>
                  {t('auth.nicNumber')}
                </Text>
                <Text style={styles.requiredStar}> *</Text>
              </View>

              <View style={styles.nicInputRow}>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: nicCheckResult?.isValid ? '#10B981' : nicCheckResult && !nicCheckResult.isValid ? '#EF4444' : theme.inputBorder }]}>
                  <Ionicons name="finger-print-outline" size={18} color={theme.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.input, { color: theme.textPrimary }]}
                    value={nic}
                    onChangeText={handleNicTextChange}
                    placeholder="199234567890 or 923456789V"
                    placeholderTextColor={theme.textMuted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={!loading}
                    maxLength={12}
                  />
                  {nic.length > 0 && !validatingNic && (
                    <TouchableOpacity onPress={() => setNic('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={[
                    styles.validateBtn,
                    { backgroundColor: theme.brandActive },
                    validatingNic && styles.buttonDisabled,
                    Platform.OS === 'web' ? { boxShadow: `0 2px 8px ${theme.brandActive}40` } : { elevation: 2 },
                  ]}
                  onPress={() => handleValidateNic()}
                  disabled={validatingNic || loading}
                  activeOpacity={0.8}
                >
                  {validatingNic ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark-outline" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.validateBtnText}>{t('auth.verifyBtn') || 'Verify'}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Verified Real NIC Badge & Decoded Identity Card */}
              {nicCheckResult?.isValid && nicCheckResult.data ? (
                <View style={[styles.verifiedCard, { backgroundColor: isDark ? '#064E3B30' : '#ECFDF5', borderColor: '#10B981' }]}>
                  <View style={styles.verifiedHeaderRow}>
                    <View style={styles.verifiedHeaderLeft}>
                      <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                      <View style={{ marginLeft: 8 }}>
                        <Text style={[styles.verifiedTitle, { color: isDark ? '#34D399' : '#047857' }]}>
                          Real Sri Lankan NIC Verified
                        </Text>
                        <Text style={[styles.verifiedSubtitle, { color: isDark ? '#6EE7B7' : '#059669' }]}>
                          Department for Registration of Persons
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.validFormatPill, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#D1FAE5' }]}>
                      <Text style={[styles.validFormatPillText, { color: isDark ? '#34D399' : '#047857' }]}>
                        {nicCheckResult.data.format === 'old' ? 'Old Format' : 'New 12-Digit'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.decodedGrid, { borderTopColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#A7F3D0' }]}>
                    <View style={[styles.decodedTile, { backgroundColor: isDark ? '#0B291E' : '#FFFFFF', borderColor: isDark ? '#134E39' : '#D1FAE5' }]}>
                      <Text style={[styles.decodedLabel, { color: theme.textMuted }]}>Gender</Text>
                      <View style={styles.decodedValueRow}>
                        <Ionicons
                          name={nicCheckResult.data.gender === 'Female' ? 'female' : 'male'}
                          size={14}
                          color={nicCheckResult.data.gender === 'Female' ? '#EC4899' : '#3B82F6'}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.decodedValue, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>
                          {nicCheckResult.data.gender || 'N/A'}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.decodedTile, { backgroundColor: isDark ? '#0B291E' : '#FFFFFF', borderColor: isDark ? '#134E39' : '#D1FAE5' }]}>
                      <Text style={[styles.decodedLabel, { color: theme.textMuted }]}>Date of Birth</Text>
                      <View style={styles.decodedValueRow}>
                        <Ionicons name="calendar" size={13} color={theme.brandActive} style={{ marginRight: 4 }} />
                        <Text style={[styles.decodedValue, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>
                          {nicCheckResult.data.dateOfBirth || 'N/A'}
                        </Text>
                      </View>
                    </View>

                    {nicCheckResult.data.age ? (
                      <View style={[styles.decodedTile, { backgroundColor: isDark ? '#0B291E' : '#FFFFFF', borderColor: isDark ? '#134E39' : '#D1FAE5' }]}>
                        <Text style={[styles.decodedLabel, { color: theme.textMuted }]}>Age</Text>
                        <View style={styles.decodedValueRow}>
                          <Ionicons name="time" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
                          <Text style={[styles.decodedValue, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>
                            {nicCheckResult.data.age.years} yrs
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {/* Fake / Invalid NIC Error Notice */}
              {nicCheckResult && !nicCheckResult.isValid ? (
                <View style={[styles.fakeNicAlert, { backgroundColor: isDark ? 'rgba(69, 10, 10, 0.4)' : '#FEF2F2', borderColor: '#EF4444' }]}>
                  <View style={styles.fakeNicHeaderRow}>
                    <Ionicons name="close-circle" size={18} color="#EF4444" />
                    <Text style={[styles.fakeNicTitle, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>
                      Fake or Invalid NIC Detected
                    </Text>
                  </View>
                  <Text style={[styles.fakeNicMessage, { color: isDark ? '#F87171' : '#991B1B' }]}>
                    {nicCheckResult.message}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* 2. NIC Photo Card (Compulsory) */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Ionicons name="camera-outline" size={16} color={theme.brandActive} style={{ marginRight: 6 }} />
                <Text style={[styles.label, { color: theme.textPrimary }]}>
                  NIC Photo Card
                </Text>
                <Text style={styles.requiredStar}> *</Text>
              </View>

              {photoUri ? (
                <View style={[styles.previewContainer, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
                  <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />
                  <View style={styles.badgeSuccess}>
                    <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                    <Text style={styles.badgeSuccessText}>NIC Photo Attached</Text>
                  </View>

                  <View style={styles.photoActionsRow}>
                    <TouchableOpacity
                      style={[styles.smallActionBtn, { backgroundColor: theme.surfaceSubtle }]}
                      onPress={handleTakePhoto}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera" size={15} color={theme.brandActive} />
                      <Text style={[styles.smallActionBtnText, { color: theme.textPrimary }]}>Retake</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.smallActionBtn, { backgroundColor: theme.surfaceSubtle }]}
                      onPress={handlePickGallery}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="images" size={15} color={theme.brandActive} />
                      <Text style={[styles.smallActionBtnText, { color: theme.textPrimary }]}>Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.smallActionBtn, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' }]}
                      onPress={handleRemovePhoto}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trash-outline" size={15} color="#EF4444" />
                      <Text style={[styles.smallActionBtnText, { color: '#EF4444' }]}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={[styles.uploadBox, { borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : theme.surfaceSubtle }]}>
                  <View style={[styles.uploadIconCircle, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#DBEAFE' }]}>
                    <Ionicons name="camera" size={26} color={theme.brandActive} />
                  </View>

                  <View style={styles.uploadButtonsRow}>
                    <TouchableOpacity
                      style={[
                        styles.uploadOptionBtn,
                        { backgroundColor: theme.brandActive },
                        Platform.OS === 'web' ? { boxShadow: `0 3px 8px ${theme.brandActive}40` } : { elevation: 2 },
                      ]}
                      onPress={handleTakePhoto}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.uploadOptionBtnText}>Take Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.uploadOptionBtn, styles.uploadGalleryBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                      onPress={handlePickGallery}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="images-outline" size={16} color={theme.textPrimary} style={{ marginRight: 6 }} />
                      <Text style={[styles.uploadOptionBtnText, { color: theme.textPrimary }]}>Choose from Gallery</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* 3. Mobile Number & OTP Verification (Compulsory) */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Ionicons name="call-outline" size={16} color={theme.brandActive} style={{ marginRight: 6 }} />
                <Text style={[styles.label, { color: theme.textPrimary }]}>
                  {t('auth.phone')}
                </Text>
                <Text style={styles.requiredStar}> *</Text>
              </View>

              <View style={styles.nicInputRow}>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                  <Ionicons name="phone-portrait-outline" size={18} color={theme.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.input, { color: theme.textPrimary }]}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder={t('auth.phonePlaceholder') || '077 123 4567'}
                    placeholderTextColor={theme.textMuted}
                    keyboardType="phone-pad"
                    editable={!loading}
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.validateBtn,
                    { backgroundColor: theme.brandActive },
                    sendingOtp && styles.buttonDisabled,
                    Platform.OS === 'web' ? { boxShadow: `0 2px 8px ${theme.brandActive}40` } : { elevation: 2 },
                  ]}
                  onPress={handleSendOtp}
                  disabled={sendingOtp || loading || (otpSent && resendCountdown > 0)}
                  activeOpacity={0.8}
                >
                  {sendingOtp ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.validateBtnText}>
                      {otpSent
                        ? resendCountdown > 0
                          ? `${resendCountdown}s`
                          : t('auth.resendOtp') || 'Resend'
                        : 'Send OTP'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* OTP Input Field */}
              {otpSent && (
                <View style={styles.otpSectionWrap}>
                  {otpMessage ? (
                    <View style={styles.otpSentNoteRow}>
                      <Ionicons name="checkmark-circle" size={15} color="#10B981" />
                      <Text style={[styles.otpSentNoteText, { color: isDark ? '#A7F3D0' : '#047857' }]}>
                        {otpMessage}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.labelRow}>
                    <Ionicons name="keypad-outline" size={15} color={theme.brandActive} style={{ marginRight: 6 }} />
                    <Text style={[styles.label, { color: theme.textPrimary, fontSize: 13 }]}>
                      {t('auth.enterCode') || '6-Digit Verification Code'}
                    </Text>
                    <Text style={styles.requiredStar}> *</Text>
                  </View>

                  <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, marginTop: 4 }]}>
                    <Ionicons name="lock-closed-outline" size={18} color={theme.textMuted} style={{ marginRight: 8 }} />
                    <TextInput
                      style={[styles.input, { color: theme.textPrimary, letterSpacing: 4, fontSize: 16 }]}
                      value={otp}
                      onChangeText={setOtp}
                      placeholder="••••••"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="number-pad"
                      maxLength={6}
                      editable={!loading}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* GPS Dispatch Coordinates Note */}
            <View style={[styles.gpsNoteCard, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.1)' : '#EFF6FF', borderColor: isDark ? 'rgba(37, 99, 235, 0.25)' : '#BFDBFE' }]}>
              <Ionicons name="navigate-circle" size={18} color={theme.brandActive} style={{ marginRight: 8 }} />
              <Text style={[styles.gpsNoteText, { color: isDark ? '#93C5FD' : '#1E40AF' }]}>
                Emergency location coordinates are automatically captured for rapid field response.
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.verifyButton,
                { backgroundColor: theme.brandActive },
                Platform.OS === 'web' ? { boxShadow: `0 4px 14px ${theme.brandActive}50` } : { elevation: 3 },
                loading && styles.buttonDisabled,
              ]}
              onPress={handleVerifyNic}
              disabled={loading || validatingNic || sendingOtp}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={styles.submitBtnContent}>
                  <Ionicons name="flash" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.verifyButtonText}>Verify & Continue as Guest</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Web Live Camera Modal */}
      {showWebCamera && Platform.OS === 'web' && (
        <Modal visible={showWebCamera} transparent animationType="fade">
          <View style={styles.cameraModalBackdrop}>
            <View style={[styles.cameraModalContent, { backgroundColor: isDark ? '#18181B' : '#FFFFFF' }]}>
              <View style={styles.cameraModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="camera" size={20} color={theme.brandActive} style={{ marginRight: 8 }} />
                  <Text style={[styles.cameraModalTitle, { color: theme.textPrimary }]}>Capture NIC Card</Text>
                </View>
                <TouchableOpacity onPress={handleCloseWebCamera} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.videoContainer}>
                {React.createElement('video', {
                  ref: videoRef,
                  autoPlay: true,
                  playsInline: true,
                  muted: true,
                  style: {
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: 12,
                  },
                })}

                {/* ID Card Cutout Framing Overlay */}
                <View style={styles.cameraFrameGuide}>
                  <View style={styles.cardFrameCornerTL} />
                  <View style={styles.cardFrameCornerTR} />
                  <View style={styles.cardFrameCornerBL} />
                  <View style={styles.cardFrameCornerBR} />
                  <Text style={styles.cameraGuideText}>Position NIC Card inside frame</Text>
                </View>
              </View>

              <View style={styles.cameraActionsRow}>
                <TouchableOpacity
                  style={[styles.snapButton, { backgroundColor: theme.brandActive }]}
                  onPress={handleSnapWebCamera}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.snapButtonText}>Snap Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.cameraFallbackBtn, { borderColor: theme.border }]}
                  onPress={() => {
                    handleCloseWebCamera();
                    triggerFallbackWebCamera();
                  }}
                >
                  <Ionicons name="folder-open-outline" size={16} color={theme.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={[styles.cameraFallbackBtnText, { color: theme.textSecondary }]}>Use Device File</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 16 },
  backLink: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backText: { fontSize: 14, fontFamily: Fonts.semiBold },

  headerArea: { alignItems: 'center', marginBottom: 14 },
  iconCircle: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  title: { fontSize: 24, fontFamily: Fonts.bold, textAlign: 'center', marginBottom: 4 },

  card: { padding: 20, borderRadius: 16, borderWidth: 1 },
  errorBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1 },
  errorText: { fontSize: 13, fontFamily: Fonts.medium, flex: 1 },

  inputGroup: { marginBottom: 20 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  label: { fontSize: 14, fontFamily: Fonts.bold },
  requiredStar: { fontSize: 14, fontFamily: Fonts.bold, color: '#EF4444' },

  nicInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  validateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 10,
    minWidth: 85,
  },
  validateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: Fonts.bold,
  },

  // OTP section
  otpSectionWrap: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  otpSentNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  otpSentNoteText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
  },

  // Verified NIC card
  verifiedCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  verifiedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  verifiedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  verifiedTitle: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  verifiedSubtitle: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    marginTop: 1,
  },
  validFormatPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  validFormatPillText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
  },
  decodedGrid: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  decodedTile: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  decodedLabel: {
    fontSize: 10,
    fontFamily: Fonts.medium,
    marginBottom: 3,
  },
  decodedValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  decodedValue: {
    fontSize: 12,
    fontFamily: Fonts.bold,
  },

  // Fake NIC alert
  fakeNicAlert: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  fakeNicHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  fakeNicTitle: {
    fontSize: 13,
    fontFamily: Fonts.bold,
  },
  fakeNicMessage: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    lineHeight: 16,
  },

  // Upload area styles
  uploadBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  uploadButtonsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  uploadOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  uploadGalleryBtn: {
    borderWidth: 1,
  },
  uploadOptionBtnText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },

  // Preview area styles
  previewContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 170,
    borderRadius: 8,
  },
  badgeSuccess: {
    position: 'absolute',
    top: 18,
    right: 18,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeSuccessText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: Fonts.bold,
  },
  photoActionsRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  smallActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 5,
  },
  smallActionBtnText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
  },

  gpsNoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  gpsNoteText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    flex: 1,
    lineHeight: 15,
  },

  verifyButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  verifyButtonText: { color: '#FFFFFF', fontSize: 15, fontFamily: Fonts.bold },

  // Live Camera Modal Styles
  cameraModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  cameraModalContent: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  cameraModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cameraModalTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  videoContainer: {
    width: '100%',
    height: 320,
    backgroundColor: '#000000',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraFrameGuide: {
    position: 'absolute',
    width: '85%',
    height: '65%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFrameCornerTL: { position: 'absolute', top: -2, left: -2, width: 20, height: 20, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#10B981', borderTopLeftRadius: 10 },
  cardFrameCornerTR: { position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#10B981', borderTopRightRadius: 10 },
  cardFrameCornerBL: { position: 'absolute', bottom: -2, left: -2, width: 20, height: 20, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#10B981', borderBottomLeftRadius: 10 },
  cardFrameCornerBR: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#10B981', borderBottomRightRadius: 10 },
  cameraGuideText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontFamily: Fonts.medium,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cameraActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  snapButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  snapButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  cameraFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  cameraFallbackBtnText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
});