import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../config/api';
import { Colors, Fonts } from '../../constants/theme';
import BottomNav from '../../components/BottomNav';

export default function ActivitiesScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>('Vithu');
  const [activeRequest, setActiveRequest] = useState({
    title: 'Flood Resque Request',
    location: 'Kelniya, Gampaha',
    date: '1 May 2026  11.22 AM',
  });

  useEffect(() => {
    let mounted = true;

    async function fetchUserData() {
      try {
        const meRes = await apiFetch('/api/auth/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          if (mounted && meData.full_name) {
            setUserName(meData.full_name);
          }
        }

        // Fetch user's active help requests
        const reqRes = await apiFetch('/api/help/requests');
        if (reqRes.ok) {
          const reqData = await reqRes.json();
          if (mounted && reqData.requests && reqData.requests.length > 0) {
            const first = reqData.requests[0];
            setActiveRequest({
              title: first.message || 'Flood Resque Request',
              location: first.district || 'Kelniya, Gampaha',
              date: first.created_at
                ? new Date(first.created_at).toLocaleString([], {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '1 May 2026  11.22 AM',
            });
          }
        }
      } catch (err) {
        console.error('Activities fetch error:', err);
      }
    }

    fetchUserData();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Red Header Banner matching Image 2 */}
        <View style={styles.headerBanner}>
          {/* Top Bar with Three Dots and Settings Gear */}
          <View style={styles.bannerTopBar}>
            <TouchableOpacity
              style={styles.bannerIconBtn}
              onPress={() => router.push('/(people)/dashboard')}
              activeOpacity={0.7}
            >
              <Text style={styles.bannerDots}>⋮</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.bannerIconBtn}
              onPress={() => router.push('/(people)/dashboard')}
              activeOpacity={0.7}
            >
              <Text style={styles.bannerGear}>⚙</Text>
            </TouchableOpacity>
          </View>

          {/* Avatar and Greeting */}
          <View style={styles.bannerUserRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarSilhouette}>👤</Text>
            </View>
            <Text style={styles.greetingText}>Hello, {userName}!</Text>
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

        {/* My Rescue Section matching Image 2 */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>My Rescue</Text>
          <TouchableOpacity
            onPress={() => router.push('/(people)/help')}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllRed}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rescueCard}>
          {/* Active Badge */}
          <View style={styles.badgeRow}>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          </View>

          {/* Request Title */}
          <Text style={styles.rescueTitle}>{activeRequest.title}</Text>

          {/* Location Row with Right Arrow */}
          <View style={styles.locationRow}>
            <View style={styles.locItem}>
              <Text style={styles.locIcon}>📍</Text>
              <Text style={styles.locText}>{activeRequest.location}</Text>
            </View>
            <TouchableOpacity
              style={styles.arrowSquareBtn}
              onPress={() => router.push('/(people)/help')}
              activeOpacity={0.7}
            >
              <Text style={styles.arrowIcon}>➔</Text>
            </TouchableOpacity>
          </View>

          {/* Calendar Row */}
          <View style={styles.calendarRow}>
            <Text style={styles.calIcon}>📅</Text>
            <Text style={styles.calText}>{activeRequest.date}</Text>
          </View>
        </View>

        {/* My Donations Section matching Image 2 */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>My Donations</Text>
          <TouchableOpacity
            onPress={() => router.push('/(people)/donate')}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllRed}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.donationCard}>
          {/* Donation ID & Arrow */}
          <View style={styles.donationTopRow}>
            <Text style={styles.donationId}>Donation ID: #DON23678</Text>
            <TouchableOpacity
              style={styles.arrowSquareBtn}
              onPress={() => router.push('/(people)/donate')}
              activeOpacity={0.7}
            >
              <Text style={styles.arrowIcon}>➔</Text>
            </TouchableOpacity>
          </View>

          {/* Fund Title */}
          <Text style={styles.donationTitle}>Relief Fund -Flood Victims</Text>

          {/* Amount & Date */}
          <Text style={styles.donationAmountDate}>
            LKR 2,500.00{'   '}28 Apr 2026
          </Text>
        </View>

        {/* Recent Alerts Section matching Image 2 */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>Recent Alerts</Text>
        </View>

        <View style={styles.recentAlertCard}>
          {/* Alert Hazard Square Icon */}
          <View style={styles.hazardSquare}>
            <Text style={styles.hazardTriangle}>⚠️</Text>
          </View>

          {/* Alert Content */}
          <View style={styles.alertContentTextWrap}>
            <Text style={styles.recentAlertTitle}>
              Flood Alert in Gampaha District
            </Text>
            <Text style={styles.recentAlertSub}>
              Stay indoors and avoid heavy traffic areas
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Navigation with Activities Active */}
      <BottomNav currentTab="activities" />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  bannerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerDots: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  bannerGear: {
    color: '#FFFFFF',
    fontSize: 20,
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
  greetingText: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
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
});
