import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Animated,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TopBar from '../../components/TopBar';
import BottomNav from '../../components/BottomNav';
import { useTheme } from '../../context/ThemeContext';
import { Fonts } from '../../constants/theme';
import { apiFetch } from '../../config/api';
import { connectSocket } from '../../config/socket';
import { cacheAlerts, getCachedAlerts } from '../../services/offlineStorage';

export interface AlertNotification {
  alert_id: string;
  disaster_type: string;
  severity: number;
  work_plan?: string | null;
  status: 'active' | 'expired' | 'cancelled' | 'resolved' | string;
  created_at: string;
  expires_at?: string | null;
  district?: string;
  zone_description?: string;
  acknowledged?: boolean;
}

const ACK_STORAGE_KEY = '@resqai_acknowledged_alerts';

function getDisasterMeta(type: string) {
  const lower = (type || '').toLowerCase();
  if (lower.includes('flood')) return { icon: '🌊', name: 'Flood Alert', color: '#1E88E5' };
  if (lower.includes('landslide')) return { icon: '⛰️', name: 'Landslide Warning', color: '#8D6E63' };
  if (lower.includes('tsunami')) return { icon: '🌊', name: 'Tsunami Warning', color: '#00ACC1' };
  if (lower.includes('fire')) return { icon: '🔥', name: 'Fire Hazard', color: '#E53935' };
  if (lower.includes('earthquake')) return { icon: '🌋', name: 'Earthquake Notice', color: '#6D4C41' };
  if (lower.includes('cyclone') || lower.includes('storm') || lower.includes('wind')) {
    return { icon: '🌪️', name: 'Severe Storm', color: '#5E35B1' };
  }
  if (lower.includes('medical')) return { icon: '🚑', name: 'Medical Emergency', color: '#D81B60' };
  return { icon: '⚠️', name: 'Emergency Warning', color: '#E65100' };
}

function getSeverityBadge(severity: number) {
  if (severity >= 5) return { label: 'CRITICAL', color: '#B51F2A', bg: 'rgba(181, 31, 42, 0.15)' };
  if (severity >= 4) return { label: 'HIGH SEVERITY', color: '#E65100', bg: 'rgba(230, 81, 0, 0.15)' };
  if (severity >= 3) return { label: 'MODERATE', color: '#F57C00', bg: 'rgba(245, 124, 0, 0.12)' };
  return { label: 'ADVISORY', color: '#2E7D32', bg: 'rgba(46, 125, 50, 0.12)' };
}

function formatRelativeTime(dateStr: string) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Just now';
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function AlertsScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'present' | 'past'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [liveBanner, setLiveBanner] = useState<string | null>(null);

  // Pulse animation for live alerts
  const pulseAnim = useMemo(() => new Animated.Value(1), []);
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  // Load local acknowledgments
  useEffect(() => {
    async function loadAcks() {
      try {
        const stored = await AsyncStorage.getItem(ACK_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setAcknowledgedIds(new Set(parsed));
          }
        }
      } catch (err) {
        console.warn('Failed to load alert acks:', err);
      }
    }
    loadAcks();
  }, []);

  // Fetch all alerts (present and past)
  const fetchAllAlerts = async () => {
    try {
      // Pass status=all to fetch both present (active) and past (expired/cancelled/resolved) alerts
      const res = await apiFetch('/api/alerts?status=all');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.alerts)) {
          setAlerts(data.alerts);
          try {
            cacheAlerts(data.alerts);
          } catch (e) {
            // cache error non-blocking
          }
          return;
        }
      }
      // Fallback to offline cached alerts if offline
      const cached = getCachedAlerts();
      if (cached && cached.length > 0) {
        setAlerts(
          cached.map((c: any) => ({
            alert_id: String(c.alert_id),
            disaster_type: c.disaster_type || 'emergency',
            severity: c.severity || 3,
            work_plan: c.work_plan,
            status: 'active',
            created_at: c.cached_at || new Date().toISOString(),
          }))
        );
      }
    } catch (err) {
      console.error('Fetch alerts error:', err);
      const cached = getCachedAlerts();
      if (cached && cached.length > 0) {
        setAlerts(
          cached.map((c: any) => ({
            alert_id: String(c.alert_id),
            disaster_type: c.disaster_type || 'emergency',
            severity: c.severity || 3,
            work_plan: c.work_plan,
            status: 'active',
            created_at: c.cached_at || new Date().toISOString(),
          }))
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllAlerts();
  }, []);

  // Socket listener for real-time broadcasts
  useEffect(() => {
    let mounted = true;

    async function initSocket() {
      try {
        const socket = await connectSocket();
        if (!socket) return;

        const onNewAlert = (alert: any) => {
          if (!mounted) return;
          const formattedAlert: AlertNotification = {
            alert_id: alert.alert_id || String(Date.now()),
            disaster_type: alert.disaster_type || 'emergency',
            severity: Number(alert.severity) || 3,
            work_plan: alert.work_plan || alert.description,
            status: 'active',
            created_at: alert.created_at || new Date().toISOString(),
            district: alert.district,
          };

          setAlerts((prev) => [
            formattedAlert,
            ...prev.filter((a) => a.alert_id !== formattedAlert.alert_id),
          ]);

          const meta = getDisasterMeta(formattedAlert.disaster_type);
          setLiveBanner(`New broadcast: ${meta.name} issued just now!`);
          setTimeout(() => {
            if (mounted) setLiveBanner(null);
          }, 6000);
        };

        socket.on('emergency_alert', onNewAlert);
        socket.on('alert_received', onNewAlert);
      } catch (err) {
        console.warn('Alerts socket listener setup error:', err);
      }
    }

    initSocket();
    return () => {
      mounted = false;
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAllAlerts();
  };

  const handleAcknowledge = async (alertId: string) => {
    if (acknowledgedIds.has(alertId)) return;

    const newSet = new Set(acknowledgedIds);
    newSet.add(alertId);
    setAcknowledgedIds(newSet);
    try {
      await AsyncStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(Array.from(newSet)));
      await apiFetch(`/api/alerts/${alertId}/acknowledge`, { method: 'PATCH' });
    } catch (e) {
      console.warn('Acknowledge sync notice:', e);
    }
  };

  // Determine present vs old
  const isPresentNotification = (alert: AlertNotification) => {
    if (alert.status !== 'active') return false;
    if (alert.expires_at) {
      const expires = new Date(alert.expires_at).getTime();
      if (!isNaN(expires) && expires < Date.now()) {
        return false; // has expired
      }
    }
    return true;
  };

  // Split into present and old
  const presentAlerts = useMemo(
    () => alerts.filter((a) => isPresentNotification(a)),
    [alerts]
  );

  const pastAlerts = useMemo(
    () => alerts.filter((a) => !isPresentNotification(a)),
    [alerts]
  );

  // Available unique disaster types for filter pill
  const disasterTypes = useMemo(() => {
    const types = new Set<string>();
    alerts.forEach((a) => {
      if (a.disaster_type) types.add(a.disaster_type.toLowerCase());
    });
    return Array.from(types);
  }, [alerts]);

  // Filtered view by activeTab and search
  const displayedAlerts = useMemo(() => {
    let list: AlertNotification[] = [];
    if (activeTab === 'all') {
      list = alerts;
    } else if (activeTab === 'present') {
      list = presentAlerts;
    } else {
      list = pastAlerts;
    }

    if (typeFilter !== 'all') {
      list = list.filter(
        (a) => (a.disaster_type || '').toLowerCase() === typeFilter.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          (a.disaster_type || '').toLowerCase().includes(q) ||
          (a.work_plan || '').toLowerCase().includes(q) ||
          (a.district || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [alerts, presentAlerts, pastAlerts, activeTab, typeFilter, searchQuery]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <TopBar title="Alerts & Notifications" showBack={false} showLogo={true} />

      {/* Real-time incoming broadcast banner toast */}
      {liveBanner && (
        <View style={[styles.liveBroadcastToast, { backgroundColor: theme.emergency }]}>
          <Text style={styles.liveBroadcastToastText}>🚨 {liveBanner}</Text>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.brandActive}
            colors={[theme.brandActive]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Screen Header Banner */}
        <View style={styles.headerCard}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerTextGroup}>
              <Text style={[styles.screenTitle, { color: theme.textPrimary }]}>
                Emergency Alerts
              </Text>
              <Text style={[styles.screenSubtitle, { color: theme.textSecondary }]}>
                Real-time disaster warnings, civil defense notices & history
              </Text>
            </View>
            <View style={[styles.totalBadge, { backgroundColor: theme.surfaceElevated }]}>
              <Text style={[styles.totalBadgeCount, { color: theme.brandActive }]}>
                {alerts.length}
              </Text>
              <Text style={[styles.totalBadgeLabel, { color: theme.textMuted }]}>
                Total
              </Text>
            </View>
          </View>

          {/* Quick Emergency Assistance Bar */}
          <View style={[styles.quickBar, { backgroundColor: theme.surfaceSubtle, borderColor: theme.borderSubtle }]}>
            <Text style={[styles.quickBarText, { color: theme.textSecondary }]}>
              National Disaster Center Hotline
            </Text>
            <TouchableOpacity
              style={[styles.callBtn, { backgroundColor: theme.emergency }]}
              onPress={() => Linking.openURL('tel:117')}
              activeOpacity={0.8}
            >
              <Text style={styles.callBtnText}>📞 117</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.borderSubtle }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder="Search notifications, disaster type, location..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.clearSearchText, { color: theme.textMuted }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Primary Segment Tabs: All / Present / Past */}
        <View style={[styles.segmentedTabsWrap, { backgroundColor: theme.surfaceSubtle, borderColor: theme.borderSubtle }]}>
          <TouchableOpacity
            style={[
              styles.segmentTab,
              activeTab === 'all' && [styles.segmentTabActive, { backgroundColor: theme.surface, borderColor: theme.border }],
            ]}
            onPress={() => setActiveTab('all')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: activeTab === 'all' ? theme.textPrimary : theme.textMuted },
                activeTab === 'all' && styles.segmentLabelActive,
              ]}
            >
              All
            </Text>
            <View style={[styles.countPill, { backgroundColor: activeTab === 'all' ? theme.brandActive : theme.borderSubtle }]}>
              <Text style={[styles.countPillText, { color: activeTab === 'all' ? '#FFFFFF' : theme.textMuted }]}>
                {alerts.length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentTab,
              activeTab === 'present' && [styles.segmentTabActive, { backgroundColor: theme.surface, borderColor: theme.border }],
            ]}
            onPress={() => setActiveTab('present')}
            activeOpacity={0.7}
          >
            <View style={styles.tabIconGroup}>
              {presentAlerts.length > 0 && (
                <Animated.View
                  style={[
                    styles.tabLivePulseDot,
                    { transform: [{ scale: pulseAnim }], backgroundColor: theme.emergency },
                  ]}
                />
              )}
              <Text
                style={[
                  styles.segmentLabel,
                  { color: activeTab === 'present' ? theme.textPrimary : theme.textMuted },
                  activeTab === 'present' && styles.segmentLabelActive,
                ]}
              >
                Present
              </Text>
            </View>
            <View
              style={[
                styles.countPill,
                {
                  backgroundColor:
                    presentAlerts.length > 0
                      ? theme.emergency
                      : activeTab === 'present'
                      ? theme.brandActive
                      : theme.borderSubtle,
                },
              ]}
            >
              <Text style={[styles.countPillText, { color: '#FFFFFF' }]}>
                {presentAlerts.length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentTab,
              activeTab === 'past' && [styles.segmentTabActive, { backgroundColor: theme.surface, borderColor: theme.border }],
            ]}
            onPress={() => setActiveTab('past')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: activeTab === 'past' ? theme.textPrimary : theme.textMuted },
                activeTab === 'past' && styles.segmentLabelActive,
              ]}
            >
              Past
            </Text>
            <View style={[styles.countPill, { backgroundColor: activeTab === 'past' ? theme.brandActive : theme.borderSubtle }]}>
              <Text style={[styles.countPillText, { color: activeTab === 'past' ? '#FFFFFF' : theme.textMuted }]}>
                {pastAlerts.length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Disaster Type Filter Pills (Horizontal Scroll) */}
        {disasterTypes.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeFilterRow}
          >
            <TouchableOpacity
              style={[
                styles.typePill,
                {
                  backgroundColor: typeFilter === 'all' ? theme.brandActive : theme.surface,
                  borderColor: typeFilter === 'all' ? theme.brandActive : theme.borderSubtle,
                },
              ]}
              onPress={() => setTypeFilter('all')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.typePillText,
                  { color: typeFilter === 'all' ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                All Hazards
              </Text>
            </TouchableOpacity>

            {disasterTypes.map((t) => {
              const meta = getDisasterMeta(t);
              const isSelected = typeFilter === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typePill,
                    {
                      backgroundColor: isSelected ? theme.brandActive : theme.surface,
                      borderColor: isSelected ? theme.brandActive : theme.borderSubtle,
                    },
                  ]}
                  onPress={() => setTypeFilter(isSelected ? 'all' : t)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.typePillEmoji}>{meta.icon}</Text>
                  <Text
                    style={[
                      styles.typePillText,
                      { color: isSelected ? '#FFFFFF' : theme.textSecondary },
                    ]}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Main Notifications Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.brandActive} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading alerts & notifications...
            </Text>
          </View>
        ) : displayedAlerts.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.borderSubtle }]}>
            <View style={[styles.emptyIconCircle, { backgroundColor: theme.surfaceSubtle }]}>
              <Text style={styles.emptyIconEmoji}>🛡️</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              {activeTab === 'present'
                ? 'No Present Emergency Alerts'
                : activeTab === 'past'
                ? 'No Past Notifications'
                : 'No Notifications Found'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
              {activeTab === 'present'
                ? 'All monitored sectors are currently normal. We will notify you immediately if an alert is issued.'
                : 'There are no notifications matching your current filters.'}
            </Text>
          </View>
        ) : (
          <View style={styles.alertsList}>
            {/* If in "All" view with both present and past, group them with section headers */}
            {activeTab === 'all' && presentAlerts.length > 0 && (
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Animated.View
                    style={[
                      styles.livePulseDot,
                      { transform: [{ scale: pulseAnim }], backgroundColor: theme.emergency },
                    ]}
                  />
                  <Text style={[styles.sectionTitle, { color: theme.emergency }]}>
                    PRESENT NOTIFICATIONS ({presentAlerts.length})
                  </Text>
                </View>
                <Text style={[styles.sectionSubtext, { color: theme.textMuted }]}>
                  Active emergencies requiring immediate attention
                </Text>
              </View>
            )}

            {/* Render List */}
            {displayedAlerts.map((alert) => {
              const isPresent = isPresentNotification(alert);
              const meta = getDisasterMeta(alert.disaster_type);
              const severity = getSeverityBadge(alert.severity);
              const isAcked = acknowledgedIds.has(alert.alert_id);

              return (
                <View
                  key={alert.alert_id}
                  style={[
                    styles.alertCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: isPresent ? meta.color : theme.borderSubtle,
                      borderLeftColor: isPresent ? meta.color : theme.textMuted,
                      borderLeftWidth: 5,
                    },
                    isPresent && styles.alertCardPresent,
                  ]}
                >
                  {/* Card Top Row: Meta Badge & Status */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.hazardGroup}>
                      <View style={[styles.hazardIconBox, { backgroundColor: meta.color + '20' }]}>
                        <Text style={styles.hazardIconEmoji}>{meta.icon}</Text>
                      </View>
                      <View style={styles.hazardTitleWrap}>
                        <Text style={[styles.hazardTitle, { color: theme.textPrimary }]}>
                          {meta.name}
                        </Text>
                        <Text style={[styles.timeAgo, { color: theme.textMuted }]}>
                          {formatRelativeTime(alert.created_at)}
                          {alert.district ? ` • 📍 ${alert.district}` : ''}
                        </Text>
                      </View>
                    </View>

                    {/* Status Pill */}
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: isPresent
                            ? 'rgba(181, 31, 42, 0.12)'
                            : 'rgba(120, 144, 156, 0.15)',
                        },
                      ]}
                    >
                      {isPresent && (
                        <Animated.View
                          style={[
                            styles.statusLiveDot,
                            { transform: [{ scale: pulseAnim }], backgroundColor: theme.emergency },
                          ]}
                        />
                      )}
                      <Text
                        style={[
                          styles.statusPillText,
                          { color: isPresent ? theme.emergency : theme.textMuted },
                        ]}
                      >
                        {isPresent ? 'ACTIVE' : alert.status ? alert.status.toUpperCase() : 'PAST'}
                      </Text>
                    </View>
                  </View>

                  {/* Severity Chip & Expiry */}
                  <View style={styles.chipsRow}>
                    <View style={[styles.severityChip, { backgroundColor: severity.bg }]}>
                      <Text style={[styles.severityChipText, { color: severity.color }]}>
                        Level {alert.severity} • {severity.label}
                      </Text>
                    </View>

                    {alert.expires_at && (
                      <View style={[styles.expiresChip, { backgroundColor: theme.surfaceSubtle }]}>
                        <Text style={[styles.expiresChipText, { color: theme.textMuted }]}>
                          {isPresent ? 'Expires: ' : 'Expired: '}
                          {new Date(alert.expires_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Body / Work Plan Description */}
                  <Text style={[styles.workPlanText, { color: theme.textSecondary }]}>
                    {alert.work_plan ||
                      'Emergency conditions reported in your area. Please stay vigilant and follow civil protection instructions.'}
                  </Text>

                  {/* Card Actions */}
                  <View style={[styles.cardActionsRow, { borderTopColor: theme.borderSubtle }]}>
                    {isPresent && (
                      <TouchableOpacity
                        style={[
                          styles.ackButton,
                          {
                            backgroundColor: isAcked
                              ? theme.surfaceSubtle
                              : theme.brandActive,
                          },
                        ]}
                        onPress={() => handleAcknowledge(alert.alert_id)}
                        disabled={isAcked}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.ackButtonText,
                            { color: isAcked ? theme.textMuted : '#FFFFFF' },
                          ]}
                        >
                          {isAcked ? '✓ Acknowledged' : 'Acknowledge Alert'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.detailsButton,
                        {
                          borderColor: theme.borderSubtle,
                          backgroundColor: isPresent ? theme.surfaceSubtle : theme.surfaceElevated,
                          flex: isPresent ? 0.9 : 1,
                        },
                      ]}
                      onPress={() => router.push(`/(people)/alert/${alert.alert_id}` as any)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.detailsButtonText, { color: theme.textPrimary }]}>
                        {isPresent ? 'View Safety Plan →' : 'View Archived Details →'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {/* Section separator if viewing all and past alerts exist */}
            {activeTab === 'all' && pastAlerts.length > 0 && (
              <View style={styles.historyFooterNote}>
                <Text style={[styles.historyFooterText, { color: theme.textMuted }]}>
                  Showing {alerts.length} total notifications ({presentAlerts.length} present, {pastAlerts.length} past)
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation with Alerts Tab Active */}
      <BottomNav currentTab="alerts" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 90, // Leave room for BottomNav
  },
  liveBroadcastToast: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  liveBroadcastToastText: {
    color: '#FFFFFF',
    fontFamily: Fonts.bold,
    fontSize: 13,
  },
  headerCard: {
    marginBottom: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTextGroup: {
    flex: 1,
    paddingRight: 12,
  },
  screenTitle: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  totalBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalBadgeCount: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  totalBadgeLabel: {
    fontFamily: Fonts.medium,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  quickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickBarText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
  },
  callBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  callBtnText: {
    color: '#FFFFFF',
    fontFamily: Fonts.bold,
    fontSize: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    marginBottom: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 14,
    padding: 0,
  },
  clearSearchText: {
    fontSize: 14,
    paddingHorizontal: 4,
  },
  segmentedTabsWrap: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginBottom: 12,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  segmentTabActive: {
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  tabIconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabLivePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  segmentLabel: {
    fontFamily: Fonts.medium,
    fontSize: 13,
  },
  segmentLabelActive: {
    fontFamily: Fonts.bold,
  },
  countPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillText: {
    fontFamily: Fonts.bold,
    fontSize: 11,
  },
  typeFilterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  typePillEmoji: {
    fontSize: 12,
  },
  typePillText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIconEmoji: {
    fontSize: 32,
  },
  emptyTitle: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
  alertsList: {
    gap: 14,
  },
  sectionHeader: {
    paddingBottom: 4,
    paddingTop: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  sectionSubtext: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    marginTop: 2,
  },
  alertCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  alertCardPresent: {
    borderWidth: 1.5,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  hazardGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
    gap: 10,
  },
  hazardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hazardIconEmoji: {
    fontSize: 20,
  },
  hazardTitleWrap: {
    flex: 1,
  },
  hazardTitle: {
    fontFamily: Fonts.bold,
    fontSize: 15,
  },
  timeAgo: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  statusLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  severityChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  severityChipText: {
    fontFamily: Fonts.bold,
    fontSize: 11,
  },
  expiresChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  expiresChipText: {
    fontFamily: Fonts.regular,
    fontSize: 11,
  },
  workPlanText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  ackButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ackButtonText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
  },
  detailsButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsButtonText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
  },
  historyFooterNote: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  historyFooterText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
  },
});
