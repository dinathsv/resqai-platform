/**
 * Flow 4: Guest user asking for help
 * Photo verification of National Identity Card (NIC)
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

export default function GuestScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const glass = useMemo(() => makeGlass(theme), [theme]);

  const [nic, setNic] = useState('');
  const [nicPhoto, setNicPhoto] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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

  const handleVerifyNic = async () => {
    if (!nicPhoto) {
      setError(t('auth.nicPhotoRequired') || 'Please upload or capture a photo of your NIC card.');
      return;
    }

    const trimmedNic = nic.trim();
    if (trimmedNic) {
      const nicRegex = /^[0-9]{9}[VvXx]$|^[0-9]{12}$/;
      if (!nicRegex.test(trimmedNic)) {
        setError(t('auth.invalidNic'));
        return;
      }
    }

    setError('');
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
          nic_photo: nicPhoto,
          nic_number: trimmedNic || undefined,
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

            {/* NIC Photo Upload Section (Primary Requirement) */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>
                  {t('auth.uploadNicPhoto') || 'NIC Photo Verification'}
                </Text>
                <Text style={styles.requiredStar}> *</Text>
              </View>
              <Text style={[styles.hint, { color: theme.textMuted, marginBottom: 10 }]}>
                {t('auth.nicPhotoHint') || 'Upload or take a clear photo of the front of your National Identity Card.'}
              </Text>

              {photoUri ? (
                <View style={[styles.previewContainer, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
                  <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />
                  <View style={styles.badgeSuccess}>
                    <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                    <Text style={styles.badgeSuccessText}>{t('auth.photoAttached') || 'NIC Photo Attached'}</Text>
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
                    <Ionicons name="camera" size={28} color={theme.brandActive} />
                  </View>
                  <Text style={[styles.uploadBoxTitle, { color: theme.textPrimary }]}>
                    {t('auth.uploadNicPhoto') || 'Capture or Select NIC'}
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
                      <Ionicons name="camera" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.uploadOptionBtnText}>{t('auth.takeNicPhoto') || 'Take Photo'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.uploadOptionBtn, { backgroundColor: theme.surfaceElevated, borderWidth: 1, borderColor: theme.border }]}
                      onPress={handlePickGallery}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="images" size={16} color={theme.brandActive} style={{ marginRight: 6 }} />
                      <Text style={[styles.uploadOptionBtnText, { color: theme.textPrimary }]}>{t('auth.chooseFromGallery') || 'Gallery'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Optional NIC text number */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {t('auth.optionalNicNumber') || 'NIC Number (Optional)'}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                value={nic}
                onChangeText={setNic}
                placeholder={t('auth.nicPlaceholder')}
                placeholderTextColor={theme.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!loading}
                onSubmitEditing={handleVerifyNic}
                maxLength={12}
              />
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                {t('auth.nicHint')}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.verifyButton,
                { backgroundColor: theme.brandActive },
                Platform.OS === 'web' ? { boxShadow: `0 4px 8px ${theme.brandActive}40` } : { shadowColor: theme.brandActive },
                loading && styles.buttonDisabled,
              ]}
              onPress={handleVerifyNic}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.verifyButtonText}>{t('common.confirm') || 'Verify & Continue'}</Text>
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
  content: { flexGrow: 1, paddingHorizontal: 22, paddingVertical: 20 },
  backLink: { marginBottom: 12 },
  backText: { fontSize: 14, fontFamily: Fonts.semiBold },
  iconCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 24, fontFamily: Fonts.bold, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, fontFamily: Fonts.regular, textAlign: 'center', marginBottom: 18, paddingHorizontal: 16 },
  card: { padding: 20, borderRadius: 14 },
  errorBox: { borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1 },
  errorText: { fontSize: 13, fontFamily: Fonts.bold, textAlign: 'center' },
  inputGroup: { marginBottom: 18 },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 13, fontFamily: Fonts.semiBold, marginBottom: 4 },
  requiredStar: { fontSize: 14, fontFamily: Fonts.bold, color: '#EF4444' },
  hint: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 2 },
  input: { paddingVertical: 12, paddingHorizontal: 14, fontSize: 14, fontFamily: Fonts.semiBold, borderRadius: 8, borderWidth: 1 },

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
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadBoxTitle: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  uploadBoxSubtitle: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    marginBottom: 12,
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
    paddingVertical: 10,
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
    height: 180,
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