import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  Image,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Fonts } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import AppearanceSettings from './AppearanceSettings';
import { apiFetch } from '../config/api';

export type NavTab = 'home' | 'alerts' | 'activities' | 'profile';

interface BottomNavProps {
  currentTab: NavTab;
}

const AVATAR_PRESETS = [
  { id: 'rescuer', label: 'Rescuer', emoji: '🦸‍♂️', bg: '#1E88E5' },
  { id: 'medic', label: 'Medic', emoji: '👨‍⚕️', bg: '#00897B' },
  { id: 'firefighter', label: 'Firefighter', emoji: '👩‍🚒', bg: '#E53935' },
  { id: 'coordinator', label: 'Coordinator', emoji: '🧑‍💼', bg: '#5E35B1' },
  { id: 'guardian', label: 'Guardian', emoji: '🛡️', bg: '#F57C00' },
  { id: 'pilot', label: 'Air Pilot', emoji: '🚁', bg: '#3949AB' },
  { id: 'marine', label: 'Coast Guard', emoji: '🌊', bg: '#00ACC1' },
  { id: 'hero', label: 'Volunteer Hero', emoji: '⭐', bg: '#FBC02D' },
];

function HomeIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <View style={iconStyles.iconBox}>
      <View style={[iconStyles.roof, { borderBottomColor: color }]} />
      <View style={[iconStyles.homeBase, { borderColor: color, backgroundColor: active ? color : 'transparent' }]}>
        <View style={[iconStyles.homeDoor, { backgroundColor: active ? '#FFFFFF' : color }]} />
      </View>
    </View>
  );
}

function AlertsIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <View style={iconStyles.iconBox}>
      <View style={[iconStyles.bellTopDot, { backgroundColor: color }]} />
      <View style={[iconStyles.bellBody, { borderColor: color, backgroundColor: active ? color : 'transparent' }]} />
      <View style={[iconStyles.bellRim, { backgroundColor: color }]} />
      <View style={[iconStyles.bellClapper, { backgroundColor: color }]} />
    </View>
  );
}

function ActivitiesIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <View style={iconStyles.iconBox}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={iconStyles.listRow}>
          <View style={[iconStyles.listBullet, { backgroundColor: color }]} />
          <View style={[iconStyles.listLine, { backgroundColor: color, width: i === 1 ? 13 : i === 2 ? 10 : 15 }]} />
        </View>
      ))}
    </View>
  );
}

function ProfileIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <View style={[iconStyles.profileRing, { borderColor: color }]}>
      <View style={[iconStyles.profileHead, { backgroundColor: color }]} />
      <View style={[iconStyles.profileShoulders, { borderColor: color, backgroundColor: active ? color : 'transparent' }]} />
    </View>
  );
}

export default function BottomNav({ currentTab }: BottomNavProps) {
  const router = useRouter();
  const { theme } = useTheme();

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [appearanceVisible, setAppearanceVisible] = useState(false);
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);

  // User Profile State
  const [profileName, setProfileName] = useState<string>('Sriranjan Kirushajithan');
  const [profileEmail, setProfileEmail] = useState<string>('');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);

  // Edit Name State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameText, setEditNameText] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const activeColor = theme.brandActive;
  const inactiveColor = theme.textMuted;

  // Load user profile details on mount and whenever modal becomes visible
  const loadProfile = async () => {
    try {
      const cachedName = await AsyncStorage.getItem('user_name');
      const cachedEmail = await AsyncStorage.getItem('user_email');
      const cachedAvatar = await AsyncStorage.getItem('user_avatar');

      if (cachedName) setProfileName(cachedName);
      if (cachedEmail) setProfileEmail(cachedEmail);
      if (cachedAvatar) setProfileAvatar(cachedAvatar);

      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.full_name) {
          setProfileName(data.full_name);
          await AsyncStorage.setItem('user_name', data.full_name);
        }
        if (data.email) {
          setProfileEmail(data.email);
          await AsyncStorage.setItem('user_email', data.email);
        }
        if (data.avatar_url) {
          setProfileAvatar(data.avatar_url);
          await AsyncStorage.setItem('user_avatar', data.avatar_url);
        }
      }
    } catch (err) {
      console.warn('Profile load error in BottomNav:', err);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleTabPress = (tab: NavTab) => {
    if (tab === currentTab) return;
    if (tab === 'home') router.replace('/(people)/dashboard');
    else if (tab === 'alerts') router.replace('/(people)/alerts');
    else if (tab === 'activities') router.replace('/(people)/activities');
    else if (tab === 'profile') {
      loadProfile();
      setProfileModalVisible(true);
    }
  };

  const handleSignOut = async () => {
    setProfileModalVisible(false);
    await AsyncStorage.clear();
    router.replace('/');
  };

  // Save Name Handler
  const handleSaveName = async () => {
    const trimmed = editNameText.trim();
    if (!trimmed) return;
    setSavingName(true);
    try {
      setProfileName(trimmed);
      await AsyncStorage.setItem('user_name', trimmed);

      await apiFetch('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ full_name: trimmed }),
      });

      setIsEditingName(false);
      showNotice('Profile name updated!');
    } catch (err) {
      console.warn('Update name notice:', err);
      setIsEditingName(false);
    } finally {
      setSavingName(false);
    }
  };

  // Save Avatar Handler
  const handleSaveAvatar = async (newAvatar: string | null) => {
    try {
      setProfileAvatar(newAvatar);
      if (newAvatar) {
        await AsyncStorage.setItem('user_avatar', newAvatar);
      } else {
        await AsyncStorage.removeItem('user_avatar');
      }

      await apiFetch('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ avatar_url: newAvatar || '' }),
      });

      setAvatarPickerVisible(false);
      showNotice('Profile picture updated!');
    } catch (err) {
      console.warn('Update avatar notice:', err);
      setAvatarPickerVisible(false);
    }
  };

  // File picker for custom photo upload
  const handlePickFile = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            if (base64) {
              await handleSaveAvatar(base64);
            }
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  };

  const showNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => {
      setStatusNotice(null);
    }, 3500);
  };

  // Render Avatar Helper
  const renderAvatarContent = (size = 72) => {
    if (profileAvatar) {
      if (profileAvatar.startsWith('preset:')) {
        const presetId = profileAvatar.replace('preset:', '');
        const found = AVATAR_PRESETS.find((p) => p.id === presetId);
        if (found) {
          return (
            <View
              style={[
                styles.avatarCircle,
                { width: size, height: size, borderRadius: size / 2, backgroundColor: found.bg },
              ]}
            >
              <Text style={{ fontSize: size * 0.5 }}>{found.emoji}</Text>
            </View>
          );
        }
      } else {
        return (
          <Image
            source={{ uri: profileAvatar }}
            style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2 }]}
            resizeMode="cover"
          />
        );
      }
    }

    // Default Initials / Silhouette
    const initials = profileName
      ? profileName
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
      : 'SK';

    return (
      <View
        style={[
          styles.avatarCircle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.brandActive },
        ]}
      >
        <Text style={[styles.avatarInitials, { fontSize: size * 0.38, color: '#FFFFFF' }]}>
          {initials}
        </Text>
      </View>
    );
  };

  // Render small profile avatar for bottom nav tab
  const renderNavProfileIcon = () => {
    const size = 24;
    if (profileAvatar) {
      if (profileAvatar.startsWith('preset:')) {
        const presetId = profileAvatar.replace('preset:', '');
        const found = AVATAR_PRESETS.find((p) => p.id === presetId);
        if (found) {
          return (
            <View
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: found.bg,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 2,
                borderWidth: currentTab === 'profile' ? 2 : 1.5,
                borderColor: currentTab === 'profile' ? activeColor : inactiveColor,
              }}
            >
              <Text style={{ fontSize: size * 0.45 }}>{found.emoji}</Text>
            </View>
          );
        }
      } else {
        return (
          <Image
            source={{ uri: profileAvatar }}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              marginBottom: 2,
              borderWidth: currentTab === 'profile' ? 2 : 1.5,
              borderColor: currentTab === 'profile' ? activeColor : inactiveColor,
            }}
            resizeMode="cover"
          />
        );
      }
    }
    return <ProfileIcon active={currentTab === 'profile'} color={currentTab === 'profile' ? activeColor : inactiveColor} />;
  };

  const tabs: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'home',
      label: 'Home',
      icon: <HomeIcon active={currentTab === 'home'} color={currentTab === 'home' ? activeColor : inactiveColor} />,
    },
    {
      id: 'alerts',
      label: 'Alerts',
      icon: <AlertsIcon active={currentTab === 'alerts'} color={currentTab === 'alerts' ? activeColor : inactiveColor} />,
    },
    {
      id: 'activities',
      label: 'Activities',
      icon: <ActivitiesIcon active={currentTab === 'activities'} color={currentTab === 'activities' ? activeColor : inactiveColor} />,
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: renderNavProfileIcon(),
    },
  ];

  return (
    <>
      <View
        style={[
          styles.navBar,
          {
            backgroundColor: theme.navBar,
            borderTopColor: theme.navBarBorder,
          },
          Platform.OS === 'web' && ({
            borderTopWidth: 1,
            borderTopColor: theme.navBarBorder,
          } as any),
        ]}
      >
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.navItem}
              onPress={() => handleTabPress(tab.id)}
              activeOpacity={0.7}
            >
              {tab.icon}
              <Text
                style={[
                  styles.navLabel,
                  {
                    color: isActive ? activeColor : inactiveColor,
                    fontFamily: isActive ? Fonts.bold : Fonts.medium,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Profile / Account Modal */}
      <Modal
        visible={profileModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setProfileModalVisible(false);
          setIsEditingName(false);
        }}
      >
        <TouchableOpacity
          style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}
          activeOpacity={1}
          onPress={() => {
            setProfileModalVisible(false);
            setIsEditingName(false);
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.profileSheet,
              {
                backgroundColor: theme.navBar,
                borderTopColor: theme.border,
              },
              Platform.OS === 'web' && ({
                borderTopWidth: 1,
                borderTopColor: theme.border,
              } as any),
            ]}
          >
            {/* Sheet Top Controls: Theme Switcher Icon & Close Button */}
            <View style={styles.sheetTopControls}>
              <TouchableOpacity
                style={[
                  styles.appearanceHeaderIconBtn,
                  {
                    backgroundColor: theme.surfaceSubtle,
                    borderColor: theme.borderSubtle,
                  },
                ]}
                onPress={() => setAppearanceVisible(true)}
                activeOpacity={0.7}
                accessibilityLabel="Change Theme Appearance"
              >
                <Text style={styles.appearanceHeaderEmoji}>
                  {theme.isDark ? '🌙' : '☀'}
                </Text>
                <Text style={[styles.appearanceHeaderText, { color: theme.textSecondary }]}>
                  Appearance
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.closeIconTouch, { backgroundColor: theme.surfaceSubtle }]}
                onPress={() => {
                  setProfileModalVisible(false);
                  setIsEditingName(false);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.closeIconText, { color: theme.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Status Notice Toast */}
            {statusNotice && (
              <View style={[styles.noticeBadge, { backgroundColor: theme.successLight }]}>
                <Text style={[styles.noticeBadgeText, { color: theme.success }]}>
                  ✓ {statusNotice}
                </Text>
              </View>
            )}

            {/* Avatar with Camera Badge */}
            <View style={styles.avatarWrapper}>
              <TouchableOpacity
                onPress={() => setAvatarPickerVisible(true)}
                activeOpacity={0.8}
                accessibilityLabel="Change Profile Picture"
              >
                {renderAvatarContent(76)}
                <View style={[styles.cameraBadge, { backgroundColor: theme.brandActive, borderColor: theme.navBar }]}>
                  <Text style={styles.cameraBadgeIcon}>⬡</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Profile Name (Display or Edit Form) */}
            {isEditingName ? (
              <View style={styles.nameEditBox}>
                <TextInput
                  style={[
                    styles.nameInput,
                    {
                      color: theme.textPrimary,
                      backgroundColor: theme.inputBg,
                      borderColor: theme.brandActive,
                    },
                  ]}
                  value={editNameText}
                  onChangeText={setEditNameText}
                  placeholder="Enter full name"
                  placeholderTextColor={theme.textMuted}
                  autoFocus
                />
                <View style={styles.nameActionButtonsRow}>
                  <TouchableOpacity
                    style={[styles.saveNameBtn, { backgroundColor: theme.brandActive }]}
                    onPress={handleSaveName}
                    disabled={savingName}
                    activeOpacity={0.8}
                  >
                    {savingName ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveNameBtnText}>Save</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.cancelNameBtn, { borderColor: theme.borderSubtle }]}
                    onPress={() => setIsEditingName(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.cancelNameBtnText, { color: theme.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.nameDisplayRow}>
                <Text style={[styles.profileTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  {profileName}
                </Text>
                <TouchableOpacity
                  style={[styles.editPencilBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.borderSubtle }]}
                  onPress={() => {
                    setEditNameText(profileName);
                    setIsEditingName(true);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Edit Profile Name"
                >
                  <Text style={styles.editPencilIcon}>⬡</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Profile Subtitle / Verified Badge */}
            <View style={styles.subInfoRow}>
              <Text style={[styles.profileSub, { color: theme.textMuted }]}>
                {profileEmail || 'Citizen • Emergency & Relief Platform'}
              </Text>
              <View style={[styles.verifiedChip, { backgroundColor: 'rgba(38, 116, 95, 0.12)' }]}>
                <Text style={[styles.verifiedChipText, { color: theme.brandActive }]}>
                  ✓ Active Citizen
                </Text>
              </View>
            </View>

            {/* Quick Photo Change Hint */}
            <TouchableOpacity
              onPress={() => setAvatarPickerVisible(true)}
              style={styles.changePhotoTextBtn}
              activeOpacity={0.7}
            >
              <Text style={[styles.changePhotoText, { color: theme.brandActive }]}>
                Change Profile Picture
              </Text>
            </TouchableOpacity>

            {/* Profile Menu Actions */}
            <View style={[styles.profileMenu, { backgroundColor: theme.surfaceSubtle, borderColor: theme.borderSubtle }]}>
              {/* Appearance Menu Item with icon */}
              <TouchableOpacity
                style={[styles.profileMenuItem, { borderBottomColor: theme.borderSubtle }]}
                onPress={() => setAppearanceVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.profileMenuEmoji}>⬡</Text>
                <View style={styles.menuTextCol}>
                  <Text style={[styles.profileMenuText, { color: theme.textPrimary }]}>Appearance & Theme</Text>
                  <Text style={[styles.profileMenuDesc, { color: theme.textMuted }]}>
                    Current: {theme.isDark ? 'Dark Mode' : 'Light Mode'}
                  </Text>
                </View>
                <Text style={styles.profileMenuModeIcon}>{theme.isDark ? '🌙' : '☀'}</Text>
                <Text style={[styles.profileMenuChevron, { color: theme.textMuted }]}>➔</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.profileMenuItem, { borderBottomColor: theme.borderSubtle }]}
                onPress={() => { setProfileModalVisible(false); router.push('/(people)/quiz'); }}
                activeOpacity={0.7}
              >
                <Text style={styles.profileMenuEmoji}>⬡</Text>
                <View style={styles.menuTextCol}>
                  <Text style={[styles.profileMenuText, { color: theme.textPrimary }]}>Disaster Preparedness Quiz</Text>
                  <Text style={[styles.profileMenuDesc, { color: theme.textMuted }]}>Earn emergency readiness score</Text>
                </View>
                <Text style={[styles.profileMenuChevron, { color: theme.textMuted }]}>➔</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.profileMenuItem, { borderBottomColor: theme.borderSubtle }]}
                onPress={() => { setProfileModalVisible(false); router.push('/(people)/donate'); }}
                activeOpacity={0.7}
              >
                <Text style={styles.profileMenuEmoji}>⬡</Text>
                <View style={styles.menuTextCol}>
                  <Text style={[styles.profileMenuText, { color: theme.textPrimary }]}>Relief Fund Donations</Text>
                  <Text style={[styles.profileMenuDesc, { color: theme.textMuted }]}>Support flood & disaster victims</Text>
                </View>
                <Text style={[styles.profileMenuChevron, { color: theme.textMuted }]}>➔</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.profileMenuItem, styles.signOutItem]}
                onPress={handleSignOut}
                activeOpacity={0.7}
              >
                <Text style={styles.profileMenuEmoji}>⬡</Text>
                <View style={styles.menuTextCol}>
                  <Text style={[styles.signOutText, { color: theme.emergency }]}>Sign Out</Text>
                  <Text style={[styles.profileMenuDesc, { color: theme.textMuted }]}>Disconnect this session</Text>
                </View>
                <Text style={[styles.profileMenuChevron, { color: theme.emergency }]}>➔</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
              onPress={() => {
                setProfileModalVisible(false);
                setIsEditingName(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.closeBtnText, { color: theme.textPrimary }]}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Avatar Picture Picker Modal */}
      <Modal
        visible={avatarPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarPickerVisible(false)}
      >
        <TouchableOpacity
          style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}
          activeOpacity={1}
          onPress={() => setAvatarPickerVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.avatarPickerSheet,
              {
                backgroundColor: theme.navBar,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: theme.textPrimary }]}>
                Change Profile Picture
              </Text>
              <TouchableOpacity
                onPress={() => setAvatarPickerVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.pickerCloseText, { color: theme.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Custom Upload Option */}
            <TouchableOpacity
              style={[styles.uploadButton, { backgroundColor: theme.brandActive }]}
              onPress={handlePickFile}
              activeOpacity={0.8}
            >
              <Text style={styles.uploadButtonIcon}>⬡</Text>
              <Text style={styles.uploadButtonText}>Upload Photo from Device</Text>
            </TouchableOpacity>

            {/* Presets Gallery */}
            <Text style={[styles.presetsSectionTitle, { color: theme.textSecondary }]}>
              Or choose a responder avatar:
            </Text>

            <View style={styles.presetsGrid}>
              {AVATAR_PRESETS.map((preset) => {
                const isSelected = profileAvatar === `preset:${preset.id}`;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    style={[
                      styles.presetCard,
                      {
                        backgroundColor: theme.surfaceSubtle,
                        borderColor: isSelected ? theme.brandActive : theme.borderSubtle,
                      },
                      isSelected && styles.presetCardSelected,
                    ]}
                    onPress={() => handleSaveAvatar(`preset:${preset.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.presetEmojiCircle, { backgroundColor: preset.bg }]}>
                      <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                    </View>
                    <Text
                      style={[
                        styles.presetLabel,
                        { color: isSelected ? theme.brandActive : theme.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Remove Photo Button */}
            {profileAvatar && (
              <TouchableOpacity
                style={[styles.removePhotoBtn, { borderColor: theme.borderSubtle }]}
                onPress={() => handleSaveAvatar(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.removePhotoBtnText, { color: theme.emergency }]}>
                  Reset to Default Initials
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.cancelPickerBtn, { backgroundColor: theme.surfaceSubtle }]}
              onPress={() => setAvatarPickerVisible(false)}
            >
              <Text style={[styles.cancelPickerBtnText, { color: theme.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Appearance Settings Modal */}
      <AppearanceSettings
        visible={appearanceVisible}
        onClose={() => setAppearanceVisible(false)}
      />
    </>
  );
}

const iconStyles = StyleSheet.create({
  iconBox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  roof: { width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderBottomWidth: 8, borderStyle: 'solid', borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  homeBase: { width: 14, height: 10, borderWidth: 1.8, borderTopWidth: 0, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, alignItems: 'center', justifyContent: 'flex-end' },
  homeDoor: { width: 4, height: 5, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  bellTopDot: { width: 3, height: 3, borderRadius: 1.5, marginBottom: 1 },
  bellBody: { width: 14, height: 11, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderWidth: 1.8 },
  bellRim: { width: 18, height: 2, borderRadius: 1, marginTop: -0.5 },
  bellClapper: { width: 4, height: 2.5, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, marginTop: 0.5 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 1.2 },
  listBullet: { width: 4, height: 4, borderRadius: 2 },
  listLine: { height: 2.5, borderRadius: 1.5 },
  profileRing: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 2 },
  profileHead: { width: 7, height: 7, borderRadius: 3.5, marginTop: 2 },
  profileShoulders: { width: 15, height: 9, borderRadius: 7.5, borderWidth: 1.5, marginTop: 2 },
});

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    height: 62,
    borderTopWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 14 : 6,
    paddingTop: 6,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  navLabel: { fontSize: 11, letterSpacing: -0.2, marginTop: 2 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  profileSheet: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 32,
    alignItems: 'center',
  },
  sheetTopControls: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  appearanceHeaderIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  appearanceHeaderEmoji: {
    fontSize: 14,
  },
  appearanceHeaderText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
  },
  closeIconTouch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIconText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  noticeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 10,
  },
  noticeBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  avatarCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitials: {
    fontFamily: Fonts.bold,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  cameraBadgeIcon: {
    fontSize: 12,
  },
  nameDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  profileTitle: {
    fontSize: 19,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  editPencilBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPencilIcon: {
    fontSize: 11,
  },
  nameEditBox: {
    width: '100%',
    paddingHorizontal: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  nameInput: {
    width: '100%',
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: Fonts.medium,
    textAlign: 'center',
    marginBottom: 8,
  },
  nameActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  saveNameBtn: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveNameBtnText: {
    color: '#FFFFFF',
    fontFamily: Fonts.bold,
    fontSize: 13,
  },
  cancelNameBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelNameBtnText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
  },
  subInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  profileSub: {
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
  verifiedChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  verifiedChipText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
  },
  changePhotoTextBtn: {
    paddingVertical: 4,
    marginBottom: 14,
  },
  changePhotoText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  profileMenu: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 4,
    marginBottom: 16,
  },
  profileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  profileMenuEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  menuTextCol: {
    flex: 1,
  },
  profileMenuText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
  profileMenuDesc: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    marginTop: 1,
  },
  profileMenuModeIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  profileMenuChevron: {
    fontSize: 13,
  },
  signOutItem: {
    borderBottomWidth: 0,
  },
  signOutText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  closeBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  closeBtnText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },

  /* Avatar Picker Sheet Styles */
  avatarPickerSheet: {
    width: '92%',
    maxWidth: 380,
    alignSelf: 'center',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 'auto',
    marginTop: 'auto',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  pickerTitle: {
    fontFamily: Fonts.bold,
    fontSize: 16,
  },
  pickerCloseText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  uploadButtonIcon: {
    fontSize: 16,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontFamily: Fonts.bold,
    fontSize: 13,
  },
  presetsSectionTitle: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    marginBottom: 10,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  presetCard: {
    width: '22%',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  presetCardSelected: {
    borderWidth: 2,
  },
  presetEmojiCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  presetEmoji: {
    fontSize: 18,
  },
  presetLabel: {
    fontSize: 9,
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  removePhotoBtn: {
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 10,
  },
  removePhotoBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
  },
  cancelPickerBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelPickerBtnText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
  },
});