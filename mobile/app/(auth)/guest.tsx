/**
 * Flow 4: Guest user asking for help
 * Sri Lankan NIC Verification via Induwara.lk API
 * Supports real-time real/fake detection and photo proof
 */
import React, { useState, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch } from '../../config/api';
import { Fonts, makeGlass, Colors } from '../../constants/theme';
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

  const [nic, setNic] = useState('');
  const [nicPhoto, setNicPhoto] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [validatingNic, setValidatingNic] = useState(false);
  const [nicCheckResult, setNicCheckResult] = useState<NicCheckResult | null>(null);
  const [error, setError] = useState('');

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
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Needed',
          'Please allow access to your photo library to upload your NIC photo.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 10],
        quality: 0.7,
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
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera Permission Needed',
          'Please allow camera access to take a photo of your NIC card.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 10],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const dataUrl = await ensureBase64(asset);
        setNicPhoto(dataUrl);
        setPhotoUri(asset.uri);
      }
    } catch (err) {
      console.error('Camera error:', err);
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
      setError(t('auth.nicNumberRequired') || 'Please enter a Sri Lankan NIC number.');
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

    // Reset validation if user edits
    if (nicCheckResult) {
      setNicCheckResult(null);
    }

    // Auto-trigger validation when full NIC length is reached (10 or 12 chars)
    const trimmed = uppercaseText.trim();
    if (trimmed.length === 10 || trimmed.length === 12) {
      handleValidateNic(trimmed);
    }
  };

  const handleVerifyNic = async () => {
    const trimmedNic = nic.trim().toUpperCase();
    if (!trimmedNic) {
      setError(t('auth.nicNumberRequired') || 'Please enter your Sri Lankan NIC number.');
      return;
    }

    // Validate real/fake NIC first
    setError('');
    let isRealNic = nicCheckResult?.isValid;
    if (isRealNic === undefined || !isRealNic) {
      isRealNic = await handleValidateNic(trimmedNic);
      if (!isRealNic) {
        setError(nicCheckResult?.message || 'Invalid or fake NIC number. Please enter a genuine NIC.');
        return;
      }
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
          nic_photo: nicPhoto || undefined,
          lat,
          lng,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        await AsyncStorage.setItem('guest_token', data.access_token);
        router.replace('/(people)/dashboard');
      } else {
        setError(data.detail || t('common.error'));
      }
    } catch {
      console.error('Guest NIC verify error');
      setError(t('auth.connectionError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(auth)/login');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.backText, { color: theme.brandActive }]}>
              ← {t('auth.signIn')}
            </Text>
          </TouchableOpacity>

          <View style={[styles.iconCircle, { backgroundColor: theme.successLight }]}>
            <Ionicons name="shield-checkmark" size={36} color={theme.success} />
          </View>

          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {t('auth.guestSignIn')}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {t('auth.guestTagline')}
          </Text>

          <View style={[styles.card, glass.card]}>
            <LanguageSelector variant="segmented" style={{ marginBottom: 16 }} />

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: theme.emergencyLight, borderColor: theme.emergency }]}>
                <Text style={[styles.errorText, { color: theme.isDark ? '#FFFFFF' : theme.emergency }]}>⚠ {error}</Text>
              </View>
            ) : null}

            {/* 1. Sri Lankan NIC Number Input & Real/Fake Live Validation */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Ionicons name="card-outline" size={16} color={theme.brandActive} style={{ marginRight: 6 }} />
                <Text style={[styles.label, { color: theme.textPrimary }]}>
                  {t('auth.nicNumber') || 'Sri Lankan NIC Number'}
                </Text>
                <Text style={styles.requiredStar}> *</Text>
              </View>
              <Text style={[styles.hint, { color: theme.textMuted, marginBottom: 8 }]}>
                Enter 10-char old format (e.g. 923456789V) or 12-digit new format (e.g. 199234567890).
              </Text>

              <View style={styles.nicInputRow}>
                <TextInput
                  style={[
                    styles.input,
                    styles.nicInputFlex,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: nicCheckResult?.isValid
                        ? '#10B981'
                        : nicCheckResult && !nicCheckResult.isValid
                        ? '#EF4444'
                        : theme.inputBorder,
                      color: theme.textPrimary,
                    },
                  ]}
                  value={nic}
                  onChangeText={handleNicTextChange}
                  placeholder="e.g. 199234567890 or 923456789V"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!loading}
                  maxLength={12}
                />

                <TouchableOpacity
                  style={[
                    styles.validateBtn,
                    { backgroundColor: theme.brandActive },
                    validatingNic && styles.buttonDisabled,
                  ]}
                  onPress={() => handleValidateNic()}
                  disabled={validatingNic || loading}
                  activeOpacity={0.8}
                >
                  {validatingNic ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.validateBtnText}>{t('auth.verifyBtn') || 'Check'}</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Verified Real NIC Badge & Decoded Identity Card */}
              {nicCheckResult?.isValid && nicCheckResult.data ? (
                <View style={[styles.verifiedCard, { backgroundColor: theme.isDark ? '#064E3B40' : '#ECFDF5', borderColor: '#10B981' }]}>
                  <View style={styles.verifiedHeaderRow}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text style={[styles.verifiedTitle, { color: '#047857' }]}>
                      Real Sri Lankan NIC Verified
                    </Text>
                    <View style={styles.validFormatPill}>
                      <Text style={styles.validFormatPillText}>
                        {nicCheckResult.data.format === 'old' ? 'Old Format' : 'New Format'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.decodedGrid}>
                    <View style={styles.decodedItem}>
                      <Text style={[styles.decodedLabel, { color: theme.textMuted }]}>Gender</Text>
                      <View style={styles.decodedValueRow}>
                        <Ionicons
                          name={nicCheckResult.data.gender === 'Female' ? 'female' : 'male'}
                          size={13}
                          color={theme.brandActive}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.decodedValue, { color: theme.textPrimary }]}>
                          {nicCheckResult.data.gender || 'N/A'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.decodedItem}>
                      <Text style={[styles.decodedLabel, { color: theme.textMuted }]}>Date of Birth</Text>
                      <Text style={[styles.decodedValue, { color: theme.textPrimary }]}>
                        {nicCheckResult.data.dateOfBirth || 'N/A'}
                      </Text>
                    </View>

                    {nicCheckResult.data.age ? (
                      <View style={styles.decodedItem}>
                        <Text style={[styles.decodedLabel, { color: theme.textMuted }]}>Age</Text>
                        <Text style={[styles.decodedValue, { color: theme.textPrimary }]}>
                          {nicCheckResult.data.age.years} yrs
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {/* Fake / Invalid NIC Error Notice */}
              {nicCheckResult && !nicCheckResult.isValid ? (
                <View style={[styles.fakeNicAlert, { backgroundColor: theme.isDark ? '#450A0A50' : '#FEF2F2', borderColor: '#EF4444' }]}>
                  <View style={styles.fakeNicHeaderRow}>
                    <Ionicons name="alert-circle" size={18} color="#EF4444" />
                    <Text style={[styles.fakeNicTitle, { color: '#B91C1C' }]}>
                      Fake or Invalid NIC Detected
                    </Text>
                  </View>
                  <Text style={[styles.fakeNicMessage, { color: theme.isDark ? '#FCA5A5' : '#991B1B' }]}>
                    {nicCheckResult.message}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* 2. NIC Photo Card Upload Section (Optional Supporting Proof) */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Ionicons name="camera-outline" size={16} color={theme.brandActive} style={{ marginRight: 6 }} />
                <Text style={[styles.label, { color: theme.textPrimary }]}>
                  {t('auth.uploadNicPhoto') || 'NIC Photo Card (Optional Proof)'}
                </Text>
              </View>
              <Text style={[styles.hint, { color: theme.textMuted, marginBottom: 10 }]}>
                Upload or capture a photo of your National Identity Card for faster verification.
              </Text>

              {photoUri ? (
                <View style={[styles.previewContainer, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
                  <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />
                  <View style={styles.badgeSuccess}>
                    <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                    <Text style={styles.badgeSuccessText}>{t('auth.photoAttached') || 'Photo Attached'}</Text>
                  </View>

                  <View style={styles.photoActionsRow}>
                    <TouchableOpacity
                      style={[styles.smallActionBtn, { backgroundColor: theme.surfaceSubtle }]}
                      onPress={handleTakePhoto}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera-outline" size={15} color={theme.textPrimary} />
                      <Text style={[styles.smallActionBtnText, { color: theme.textPrimary }]}>{t('auth.retakePhoto') || 'Retake'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.smallActionBtn, { backgroundColor: theme.surfaceSubtle }]}
                      onPress={handlePickGallery}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="images-outline" size={15} color={theme.textPrimary} />
                      <Text style={[styles.smallActionBtnText, { color: theme.textPrimary }]}>{t('auth.chooseFromGallery') || 'Gallery'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.smallActionBtn, { backgroundColor: theme.emergencyLight }]}
                      onPress={handleRemovePhoto}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trash-outline" size={15} color={theme.emergency} />
                      <Text style={[styles.smallActionBtnText, { color: theme.emergency }]}>{t('auth.removePhoto') || 'Remove'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={[styles.uploadBox, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
                  <View style={[styles.uploadIconCircle, { backgroundColor: theme.accentSubtle }]}>
                    <Ionicons name="camera" size={24} color={theme.brandActive} />
                  </View>
                  <Text style={[styles.uploadBoxTitle, { color: theme.textPrimary }]}>
                    {t('auth.uploadNicPhoto') || 'Upload NIC Card Photo'}
                  </Text>
                  <Text style={[styles.uploadBoxSubtitle, { color: theme.textMuted }]}>
                    Take a photo or choose an existing image from your device
                  </Text>

                  <View style={styles.uploadButtonsRow}>
                    <TouchableOpacity
                      style={[styles.uploadOptionBtn, { backgroundColor: theme.brandActive }]}
                      onPress={handleTakePhoto}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.uploadOptionBtnText}>{t('auth.takeNicPhoto') || 'Camera'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.uploadOptionBtn, { backgroundColor: theme.surfaceElevated, borderWidth: 1, borderColor: theme.border }]}
                      onPress={handlePickGallery}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="images" size={15} color={theme.brandActive} style={{ marginRight: 6 }} />
                      <Text style={[styles.uploadOptionBtnText, { color: theme.textPrimary }]}>{t('auth.chooseFromGallery') || 'Gallery'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.verifyButton,
                { backgroundColor: theme.brandActive },
                Platform.OS === 'web' ? { boxShadow: `0 4px 8px ${theme.brandActive}40` } : { shadowColor: theme.brandActive },
                loading && styles.buttonDisabled,
              ]}
              onPress={handleVerifyNic}
              disabled={loading || validatingNic}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.verifyButtonText}>{t('common.confirm') || 'Verify & Continue as Guest'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 18 },
  backLink: { marginBottom: 12 },
  backText: { fontSize: 14, fontFamily: Fonts.semiBold },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 10 },
  title: { fontSize: 23, fontFamily: Fonts.bold, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, fontFamily: Fonts.regular, textAlign: 'center', marginBottom: 16, paddingHorizontal: 16 },
  card: { padding: 18, borderRadius: 14 },
  errorBox: { borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1 },
  errorText: { fontSize: 13, fontFamily: Fonts.bold, textAlign: 'center' },
  inputGroup: { marginBottom: 18 },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 13, fontFamily: Fonts.semiBold, marginBottom: 4 },
  requiredStar: { fontSize: 14, fontFamily: Fonts.bold, color: '#EF4444' },
  hint: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 2 },

  nicInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nicInputFlex: {
    flex: 1,
  },
  input: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  validateBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  validateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: Fonts.bold,
  },

  // Verified NIC card
  verifiedCard: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  verifiedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  verifiedTitle: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    flex: 1,
  },
  validFormatPill: {
    backgroundColor: '#10B98120',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  validFormatPillText: {
    color: '#047857',
    fontSize: 10,
    fontFamily: Fonts.semiBold,
  },
  decodedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: '#10B98140',
  },
  decodedItem: {
    minWidth: 70,
  },
  decodedLabel: {
    fontSize: 10,
    fontFamily: Fonts.regular,
    marginBottom: 2,
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
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  uploadIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadBoxTitle: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    marginBottom: 3,
  },
  uploadBoxSubtitle: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  uploadButtonsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },
  uploadOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
  },
  uploadOptionBtnText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
  },

  // Preview area styles
  previewContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    position: 'relative',
    marginTop: 4,
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
  },
  badgeSuccess: {
    position: 'absolute',
    top: 18,
    right: 18,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
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
    borderRadius: 6,
    gap: 4,
  },
  smallActionBtnText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
  },

  verifyButton: { paddingVertical: 13, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonDisabled: { opacity: 0.6 },
  verifyButtonText: { color: '#FFFFFF', fontSize: 15, fontFamily: Fonts.bold },
});