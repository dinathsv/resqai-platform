import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Fonts } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import AppearanceSettings from './AppearanceSettings';

export type NavTab = 'home' | 'alerts' | 'activities' | 'profile';

interface BottomNavProps {
  currentTab: NavTab;
}

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

  const activeColor = theme.brandActive;
  const inactiveColor = theme.textMuted;

  const handleTabPress = (tab: NavTab) => {
    if (tab === currentTab) return;
    if (tab === 'home') router.replace('/(people)/dashboard');
    else if (tab === 'alerts') router.replace('/(people)/alerts');
    else if (tab === 'activities') router.replace('/(people)/activities');
    else if (tab === 'profile') setProfileModalVisible(true);
  };

  const handleSignOut = async () => {
    setProfileModalVisible(false);
    await AsyncStorage.clear();
    router.replace('/');
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
      icon: <ProfileIcon active={currentTab === 'profile'} color={currentTab === 'profile' ? activeColor : inactiveColor} />,
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
            boxShadow: theme.isDark
              ? '0 -2px 16px rgba(0,0,0,0.40)'
              : '0 -2px 10px rgba(22,79,67,0.06)',
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
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <TouchableOpacity
          style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}
          activeOpacity={1}
          onPress={() => setProfileModalVisible(false)}
        >
          <View
            style={[
              styles.profileSheet,
              {
                backgroundColor: theme.navBar,
                borderTopColor: theme.border,
              },
              Platform.OS === 'web' && ({
                boxShadow: theme.isDark
                  ? '0 -10px 30px rgba(0,0,0,0.50)'
                  : '0 -10px 30px rgba(22,79,67,0.12)',
              } as any),
            ]}
          >
            <View style={[styles.profileAvatarBig, { backgroundColor: theme.successLight }]}>
              <Text style={styles.profileAvatarText}>👤</Text>
            </View>
            <Text style={[styles.profileTitle, { color: theme.textPrimary }]}>ResQAI Account</Text>
            <Text style={[styles.profileSub, { color: theme.textMuted }]}>Emergency & Relief Platform</Text>

            <View style={[styles.profileMenu, { backgroundColor: theme.surfaceSubtle, borderColor: theme.borderSubtle }]}>

              <TouchableOpacity
                style={[styles.profileMenuItem, { borderBottomColor: theme.borderSubtle }]}
                onPress={() => { setProfileModalVisible(false); router.push('/(people)/quiz'); }}
              >
                <Text style={styles.profileMenuEmoji}>🎮</Text>
                <Text style={[styles.profileMenuText, { color: theme.textPrimary }]}>Disaster Preparedness Quiz</Text>
                <Text style={[styles.profileMenuChevron, { color: theme.textMuted }]}>➔</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.profileMenuItem, { borderBottomColor: theme.borderSubtle }]}
                onPress={() => { setProfileModalVisible(false); router.push('/(people)/donate'); }}
              >
                <Text style={styles.profileMenuEmoji}>❤️</Text>
                <Text style={[styles.profileMenuText, { color: theme.textPrimary }]}>Relief Fund Donations</Text>
                <Text style={[styles.profileMenuChevron, { color: theme.textMuted }]}>➔</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.profileMenuItem, { borderBottomColor: theme.borderSubtle }]}
                onPress={() => { setAppearanceVisible(true); }}
              >
                <Text style={styles.profileMenuEmoji}>{theme.isDark ? '🌙' : '☀'}</Text>
                <Text style={[styles.profileMenuText, { color: theme.textPrimary }]}>Appearance</Text>
                <Text style={[styles.profileMenuChevron, { color: theme.textMuted }]}>➔</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.profileMenuItem, styles.signOutItem]}
                onPress={handleSignOut}
              >
                <Text style={styles.profileMenuEmoji}>🚪</Text>
                <Text style={[styles.signOutText, { color: theme.emergency }]}>Sign Out</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
              onPress={() => setProfileModalVisible(false)}
            >
              <Text style={[styles.closeBtnText, { color: theme.textPrimary }]}>Close</Text>
            </TouchableOpacity>
          </View>
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
    maxWidth: 420,
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 36,
    alignItems: 'center',
  },
  profileAvatarBig: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  profileAvatarText: { fontSize: 34 },
  profileTitle: { fontSize: 19, fontFamily: Fonts.bold, marginBottom: 2 },
  profileSub: { fontSize: 13, fontFamily: Fonts.medium, marginBottom: 20 },
  profileMenu: { width: '100%', borderRadius: 16, borderWidth: 1, paddingVertical: 4, marginBottom: 18 },
  profileMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1 },
  profileMenuEmoji: { fontSize: 18, marginRight: 12 },
  profileMenuText: { flex: 1, fontSize: 14, fontFamily: Fonts.semiBold },
  profileMenuChevron: { fontSize: 14 },
  signOutItem: { borderBottomWidth: 0 },
  signOutText: { flex: 1, fontSize: 14, fontFamily: Fonts.bold },
  closeBtn: { width: '100%', paddingVertical: 12, borderRadius: 14, alignItems: 'center', borderWidth: 1 },
  closeBtnText: { fontSize: 14, fontFamily: Fonts.bold },
});