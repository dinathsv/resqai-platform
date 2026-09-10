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
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../config/api';
import { Colors, Fonts } from '../../constants/theme';
import BottomNav from '../../components/BottomNav';

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
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Red Header Banner */}
        <View style={styles.headerBanner}>
          {/* Top Bar with Logo on top, Back button underneath, no 3-dot button */}
          <View style={styles.bannerTopBar}>
            <View style={styles.bannerHeaderLeft}>
              {/* 1. First: Logo */}
              <View style={styles.logoBadgeWrap}>
                <Image
                  source={require('../../assets/Resqai.jpeg')}
                  style={styles.headerLogo}
                  resizeMode="contain"
                />
              </View>

              {/* 2. Under Logo: Back Button */}
              <TouchableOpacity
                style={styles.backUnderLogoBtn}
                onPress={() => router.replace('/(people)/dashboard')}
                activeOpacity={0.75}
              >
                <View style={styles.backCircle}>
                  <Text style={styles.backArrow}>←</Text>
                </View>
                <Text style={styles.backBtnLabel}>Back</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Avatar and Real User Name Greeting */}
          <View style={styles.bannerUserRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarSilhouette}>👤</Text>
            </View>
            <View style={styles.greetingWrap}>
              <Text style={styles.greetingText}>
                Hello, {userName || 'Citizen'}!
              </Text>
              <Text style={styles.greetingSubText}>
                Sri Lanka Disaster Relief Network
              </Text>
            </View>
          </View>
        </View>

        {/* Floating ResQ-Quiz Card overlapping banner */}
        <View style={styles.quizCardWrapper}>
          <TouchableOpacity
            style={styles.quizCard}
            onPress={() => router.push('/(people)/quiz')}
            activeOpacity={0.8}
          >
            <View style={styles.robotIconCircle}>
              <Text style={styles.robotEmoji}>🤖</Text>
            </View>
            <Text style={styles.quizTitle}>ResQ-Quiz</Text>
          </TouchableOpacity>
        </View>

        {/* My Rescue Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>My Rescue</Text>
          <TouchableOpacity
            onPress={() => router.push('/(people)/help')}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllRed}>View All</Text>
          </TouchableOpacity>
        </View>

        {myRequests.length > 0 ? (
          myRequests.map((item) => (
            <View key={item.request_id} style={styles.rescueCard}>
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
                  <Text style={styles.locIcon}>📍</Text>
                  <Text style={styles.locText}>{item.location}</Text>
                </View>
                <TouchableOpacity
                  style={styles.arrowSquareBtn}
                  onPress={() => router.push('/(people)/help')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.arrowIcon}>➔</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.calendarRow}>
                <Text style={styles.calIcon}>📅</Text>
                <Text style={styles.calText}>{item.date}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🛟</Text>
            <Text style={styles.emptyTitle}>No Active Rescue Requests</Text>
            <Text style={styles.emptySub}>
              You have no active emergency requests. If you or someone nearby is
              in danger, request immediate relief.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
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
          <Text style={styles.sectionHeading}>My Donations</Text>
          <TouchableOpacity
            onPress={() => router.push('/(people)/donate')}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllRed}>View All</Text>
          </TouchableOpacity>
        </View>

        {myDonations.length > 0 ? (
          myDonations.map((don) => (
            <View key={don.donation_id} style={styles.donationCard}>
              <View style={styles.donationTopRow}>
                <Text style={styles.donationId}>
                  Donation ID: {don.donation_id}
                </Text>
                <TouchableOpacity
                  style={styles.arrowSquareBtn}
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
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🤝</Text>
            <Text style={styles.emptyTitle}>No Donations Yet</Text>
            <Text style={styles.emptySub}>
              Contribute essential relief supplies and funds to flood and disaster
              victims across Sri Lanka.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
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
            <View key={alert.alert_id} style={styles.recentAlertCard}>
              <View style={styles.hazardSquare}>
                <Text style={styles.hazardTriangle}>⚠️</Text>
              </View>
              <View style={styles.alertContentTextWrap}>
                <Text style={styles.recentAlertTitle}>
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
          <View style={styles.safeAlertCard}>
            <View style={styles.safeShieldSquare}>
              <Text style={styles.safeShieldEmoji}>🛡️</Text>
            </View>
            <View style={styles.alertContentTextWrap}>
              <Text style={styles.safeAlertTitle}>No Active Emergency Alerts</Text>
              <Text style={styles.safeAlertSub}>
                All monitored zones are reporting normal conditions. We will notify
                you immediately if an alert is issued.
              </Text>
            </View>
          </View>
        )}

        {/* Account Sign Out Button */}
        <View style={styles.signOutWrapper}>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <Text style={styles.signOutBtnText}>🚪 Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Navigation with Profile Active */}
      <BottomNav currentTab="profile" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 24,
  },

  /* Red Header Banner */
  headerBanner: {
    backgroundColor: '#DC2626',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingTop: Platform.OS === 'ios' ? 8 : 14,
    paddingBottom: 48,
    paddingHorizontal: 20,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(180deg, #D41C2C 0%, #B91C1C 100%)',
        } as any)
      : {}),
  },
  bannerTopBar: {
    marginBottom: 16,
  },
  bannerHeaderLeft: {
    alignItems: 'flex-start',
    gap: 10,
  },
  logoBadgeWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  backUnderLogoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  backCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  backBtnLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: Fonts.bold,
    fontWeight: '700',
  },
  signOutWrapper: {
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 24,
  },
  signOutBtn: {
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  signOutBtnText: {
    color: '#DC2626',
    fontSize: 14,
    fontFamily: Fonts.bold,
    fontWeight: '700',
  },
  bannerUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  avatarCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarSilhouette: {
    fontSize: 34,
  },
  greetingWrap: {
    flex: 1,
  },
  greetingText: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  greetingSubText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },

  /* ResQ-Quiz Floating Card */
  quizCardWrapper: {
    paddingHorizontal: 20,
    marginTop: -28,
    marginBottom: 16,
  },
  quizCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
        } as any)
      : {}),
  },
  robotIconCircle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  robotEmoji: {
    fontSize: 32,
  },
  quizTitle: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    fontWeight: '800',
    color: '#0F172A',
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

  /* My Rescue Card */
  rescueCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.06)',
        } as any)
      : {}),
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
    backgroundColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowIcon: {
    color: '#FFFFFF',
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

  /* My Donations Card */
  donationCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.06)',
        } as any)
      : {}),
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

  /* Empty State Cards */
  emptyCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)',
        } as any)
      : {}),
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

  /* Recent Alerts Card */
  recentAlertCard: {
    marginHorizontal: 20,
    backgroundColor: '#FDE8E8',
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
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
});
