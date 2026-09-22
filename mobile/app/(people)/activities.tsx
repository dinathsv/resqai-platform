import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../config/api';
import { Colors, Fonts } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import BottomNav from '../../components/BottomNav';
import TopBar from '../../components/TopBar';

interface RescueItem {
  request_id: string;
  title: string;
  status: string;
  location?: string;
  date: string;
}

interface DonationItem {
  donation_id: string;
  amount: number;
  status: string;
  title: string;
  date: string;
}

interface AlertItem {
  alert_id: string;
  disaster_type: string;
  severity: number;
  district?: string;
  work_plan?: string;
  created_at?: string;
}

export default function ActivitiesScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [userName, setUserName] = useState<string>('Citizen');
  const [myRequests, setMyRequests] = useState<RescueItem[]>([]);
  const [myDonations, setMyDonations] = useState<DonationItem[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    async function loadActivities() {
      try {
        // 1. Instant username from cache
        const cachedName = await AsyncStorage.getItem('user_name');
        if (cachedName && mounted) {
          setUserName(cachedName);
        }

        // 2. Fetch authenticated profile
        const meRes = await apiFetch('/api/auth/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          if (mounted && meData.full_name) {
            setUserName(meData.full_name);
            await AsyncStorage.setItem('user_name', meData.full_name);
          }
        }

        // 3. Fetch user's real rescue requests
        const reqRes = await apiFetch('/api/requests/my');
        if (reqRes.ok) {
          const reqData = await reqRes.json();
          if (mounted && Array.isArray(reqData)) {
            setMyRequests(
              reqData.map((r: any) => ({
                request_id: r.request_id,
                title:
                  r.message ||
                  `${r.emergency_type ? r.emergency_type.toUpperCase() : 'Emergency'} Request`,
                status: r.status || 'Active',
                location: r.location || 'Reported Location',
                date: r.created_at
                  ? new Date(r.created_at).toLocaleString([], {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Recent',
              }))
            );
          }
        }

        // 4. Fetch user's real donations
        const donRes = await apiFetch('/api/donations');
        if (donRes.ok) {
          const donData = await donRes.json();
          if (mounted && Array.isArray(donData)) {
            setMyDonations(
              donData.map((d: any) => ({
                donation_id: d.donation_id
                  ? `#DON${d.donation_id.slice(0, 6).toUpperCase()}`
                  : '#DONATION',
                amount: d.amount || 0,
                status: d.status || 'completed',
                title: d.mission_title || 'Disaster Relief Fund',
                date: d.created_at
                  ? new Date(d.created_at).toLocaleDateString([], {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Recent',
              }))
            );
          }
        }

        // 5. Fetch real active alerts
        const alertRes = await apiFetch('/api/alerts');
        if (alertRes.ok) {
          const alertData = await alertRes.json();
          if (mounted && alertData.alerts && Array.isArray(alertData.alerts)) {
            setRecentAlerts(alertData.alerts);
          }
        }
      } catch (err) {
        console.error('Activities load error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadActivities();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await AsyncStorage.clear();
    } catch (e) {
      console.warn('Sign out clear error:', e);
    }
    router.replace('/');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Standard TopBar */}
        <TopBar transparent={false} />
        {/* Avatar and User Info */}
        <View style={styles.bannerUserRow}>
          <View style={[styles.avatarCircle, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="person" size={28} color={theme.textPrimary} />
          </View>
          <View style={styles.greetingWrap}>
            <Text style={[styles.greetingText, { color: theme.textPrimary }]}>
              Hello, {userName || 'Citizen'}!
            </Text>
            <Text style={[styles.greetingSubText, { color: theme.textSecondary }]}>
              Sri Lanka Disaster Relief Network
            </Text>
          </View>
        </View>

        {/* Floating ResQ-Quiz Card overlapping banner */}
        <View style={styles.quizCardWrapper}>
          <TouchableOpacity style={[styles.quizCard, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => router.push('/(people)/quiz')} activeOpacity={0.8}>
            <View style={[styles.robotIconCircle, { backgroundColor: theme.emergency }]}>
              <Ionicons name="hardware-chip-outline" size={16} color="#FFFFFF" />
            </View>
            <Text style={[styles.quizTitle, { color: theme.textPrimary }]}>ResQ-Quiz</Text>
          </TouchableOpacity>
        </View>

        {/* My Rescue Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>My Rescue</Text>
          <TouchableOpacity
            onPress={() => router.push('/(people)/help')}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewAllRed, { color: theme.brandActive }]}>View All</Text>
          </TouchableOpacity>
        </View>

        {myRequests.length > 0 ? (
          myRequests.map((item) => (
            <View key={item.request_id} style={[styles.rescueCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.badgeRow}>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.rescueTitle}>{item.title}</Text>
              <View style={styles.locationRow}>
                <View style={styles.locItem}>
                  <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
                  <Text style={[styles.locText, { color: theme.textSecondary }]}>{item.location}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.arrowSquareBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                  onPress={() => router.push('/(people)/help')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.arrowIcon}>➔</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.calendarRow}>
                <Ionicons name="calendar-outline" size={15} color={theme.textMuted} />
                <Text style={[styles.calText, { color: theme.textMuted }]}>{item.date}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="folder-open-outline" size={36} color={theme.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Active Rescue Requests</Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              You have no active emergency requests. If you or someone nearby is
              in danger, request immediate relief.
            </Text>
            <TouchableOpacity
              style={[styles.emptyActionBtn, { backgroundColor: theme.emergency }]}
              onPress={() => router.push('/(people)/help')}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyActionBtnText}>
                Request Emergency Help
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* My Donations Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>My Donations</Text>
          <TouchableOpacity
            onPress={() => router.push('/(people)/donate')}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewAllRed, { color: theme.brandActive }]}>View All</Text>
          </TouchableOpacity>
        </View>

        {myDonations.length > 0 ? (
          myDonations.map((don) => (
            <View key={don.donation_id} style={[styles.donationCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.donationTopRow}>
                <Text style={[styles.donationId, { color: theme.textMuted }]}>
                  Donation ID: {don.donation_id}
                </Text>
                <TouchableOpacity
                  style={[styles.arrowSquareBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                  onPress={() => router.push('/(people)/donate')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.arrowIcon}>➔</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.donationTitle}>{don.title}</Text>
              <Text style={styles.donationAmountDate}>
                LKR {don.amount.toLocaleString()}
                {'   '}
                {don.date}
              </Text>
            </View>
          ))
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="wallet-outline" size={36} color={theme.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Donations Yet</Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              Contribute essential relief supplies and funds to flood and disaster
              victims across Sri Lanka.
            </Text>
            <TouchableOpacity
              style={[styles.emptyActionBtn, { backgroundColor: theme.emergency }]}
              onPress={() => router.push('/(people)/donate')}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyActionBtnText}>
                Donate to Relief Fund
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recent Alerts Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>Recent Alerts</Text>
        </View>

        {recentAlerts.length > 0 ? (
          recentAlerts.map((alert) => (
            <View key={alert.alert_id} style={[styles.recentAlertCard, { backgroundColor: theme.emergencyLight, borderColor: theme.emergency }]}>
              <View style={[styles.hazardSquare, { backgroundColor: theme.emergency }]}>
                <Ionicons name="warning-outline" size={26} color="#FFFFFF" />
              </View>
              <View style={styles.alertContentTextWrap}>
                <Text style={[styles.recentAlertTitle, { color: theme.emergency }]}>
                  {alert.disaster_type.toUpperCase()} Alert
                  {alert.district ? ` in ${alert.district}` : ''}
                </Text>
                <Text style={styles.recentAlertSub}>
                  {alert.work_plan ||
                    'Active alert in your zone. Please follow safety instructions.'}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.safeAlertCard, { backgroundColor: theme.successLight, borderColor: theme.success }]}>
            <View style={[styles.safeShieldSquare, { backgroundColor: theme.success }]}>
              <Ionicons name="shield-checkmark-outline" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.alertContentTextWrap}>
              <Text style={[styles.safeAlertTitle, { color: theme.success }]}>No Active Emergency Alerts</Text>
              <Text style={[styles.safeAlertSub, { color: theme.textSecondary }]}>
                All monitored zones are reporting normal conditions. We will notify
                you immediately if an alert is issued.
              </Text>
            </View>
          </View>
        )}

        {/* Account Sign Out Button */}
        <View style={styles.signOutWrapper}>
          <TouchableOpacity
            style={[styles.signOutBtn, { backgroundColor: theme.emergency, borderColor: theme.emergency }]}
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <Text style={[styles.signOutBtnText, { color: theme.white }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Navigation with Profile Active */}
      <BottomNav currentTab="activities" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  bannerUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSilhouette: {
    fontSize: 28,
  },
  greetingWrap: {
    flex: 1,
  },
  greetingText: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    letterSpacing: -0.3,
  },
  greetingSubText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    marginTop: 4,
  },

  quizCardWrapper: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  quizCard: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
  },
  robotIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  robotEmoji: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  quizTitle: {
    fontSize: 15,
    fontFamily: Fonts.bold,
  },

  /* Section Header Rows */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  viewAllRed: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    fontWeight: '700',
    color: '#DC2626',
  },

  rescueCard: {
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  activeBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 3.5,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: '#16A34A',
    fontSize: 12,
    fontFamily: Fonts.bold,
    fontWeight: '800',
  },
  rescueTitle: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  locItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locIcon: {
    fontSize: 16,
  },
  locText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#334155',
  },
  arrowSquareBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowIcon: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calIcon: {
    fontSize: 15,
  },
  calText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#64748B',
  },

  donationCard: {
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  donationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  donationId: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#64748B',
  },
  donationTitle: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  donationAmountDate: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#475569',
  },

  emptyCard: {
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  emptyActionBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: Fonts.bold,
    fontWeight: '700',
  },

  recentAlertCard: {
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 10,
  },
  hazardSquare: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  hazardTriangle: {
    fontSize: 26,
  },
  alertContentTextWrap: {
    flex: 1,
  },
  recentAlertTitle: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    fontWeight: '800',
    color: '#DC2626',
    marginBottom: 2,
  },
  recentAlertSub: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#475569',
    lineHeight: 16,
  },

  /* Safe / No Alerts Card */
  safeAlertCard: {
    marginHorizontal: 20,
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 10,
  },
  safeShieldSquare: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  safeShieldEmoji: {
    fontSize: 24,
  },
  safeAlertTitle: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    fontWeight: '800',
    color: '#15803D',
    marginBottom: 2,
  },
  safeAlertSub: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#475569',
    lineHeight: 16,
  },
  signOutWrapper: {
    paddingHorizontal: 20,
    marginTop: 24,
    alignItems: 'center',
  },
  signOutBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
  },
  signOutBtnText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
});
