

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiFetch } from '../../../config/api';
import { Fonts, ThemeTokens } from '../../../constants/theme';
import { useTheme } from '../../../context/ThemeContext';
import TopBar from '../../../components/TopBar';

interface AlertDetail {
  alert_id: string;
  disaster_type: string;
  severity: number;
  district: string;
  zone_description: string;
  work_plan: string[];
  is_active: boolean;
  created_at: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
}

export default function AlertDetailScreen() {
  const { id } = useLocalSearchParams() as { id: string };
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const [alert, setAlert] = useState<AlertDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    async function fetchAlert() {
      try {
        const res = await apiFetch(`/api/alerts/${id}`);
        if (res.ok) {
          const data = await res.json();
          setAlert(data.alert);
          setAcknowledged(data.alert.acknowledged || false);
        }
      } catch (err) {
        console.error('Fetch alert error:', err);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchAlert();
    } else {
      setLoading(false);
    }
  }, [id]);

  const handleAcknowledge = async () => {
    if (!id || acknowledging || acknowledged) return;
    setAcknowledging(true);
    try {
      const res = await apiFetch(`/api/alerts/${id}/acknowledge`, {
        method: 'PATCH',
      });
      if (res.ok) {
        setAcknowledged(true);
      }
    } catch (err) {
      console.error('Acknowledge error:', err);
    } finally {
      setAcknowledging(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(people)/dashboard');
    }
  };

  if (!alert) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Alert not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isCritical = alert.severity >= 4;

  return (
    <SafeAreaView style={styles.container}>

      <TopBar title="Alert Details" showBack onBack={handleBack} />

      <ScrollView style={styles.content}>

        {isCritical && (
          <View style={styles.criticalBar}>
            <Text style={styles.criticalBarText}>⚠ Critical Emergency</Text>
          </View>
        )}

        <View style={styles.titleCard}>
          <Text style={styles.title}>
            {alert.disaster_type.charAt(0).toUpperCase() +
              alert.disaster_type.slice(1)}{' '}
            Alert
          </Text>


        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>What To Do:</Text>
          {Array.isArray(alert.work_plan) && alert.work_plan.length > 0 ? (
            alert.work_plan.map((step: string, index: number) => (
              <View key={index} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.workPlanStep}>{step}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noContent}>No instructions available</Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Affected Area:</Text>
          <Text style={styles.zoneDescription}>
            {alert.zone_description || alert.district || 'Not specified'}
          </Text>
        </View>

        <Text style={styles.issuedTime}>
          Issued: {formatTime(alert.created_at)}
        </Text>

        <TouchableOpacity
          style={[
            styles.acknowledgeButton,
            acknowledged && styles.acknowledgedButton,
          ]}
          onPress={handleAcknowledge}
          disabled={acknowledged || acknowledging}
          activeOpacity={0.7}
        >
          {acknowledging ? (
            <ActivityIndicator size="small" color={theme.white} />
          ) : (
            <Text style={styles.acknowledgeText}>
              {acknowledged ? 'Acknowledged ✓' : 'Acknowledge'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: theme.accent,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: theme.textMuted,
  },
  criticalBar: {
    backgroundColor: theme.accent,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  criticalBarText: {
    color: theme.white,
    fontSize: 16,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  titleCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontFamily: Fonts.bold,
    color: theme.textPrimary,
    marginBottom: 8,
  },
  severityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: theme.accentLight,
  },
  severityText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: theme.textPrimary,
  },
  severityCritical: {
    color: theme.accent,
  },
  sectionCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: theme.accent,
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: theme.white,
  },
  workPlanStep: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: theme.textPrimary,
    lineHeight: 24,
  },
  noContent: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: theme.textMuted,
  },
  zoneDescription: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: theme.textPrimary,
    lineHeight: 22,
  },
  issuedTime: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: theme.textMuted,
    marginTop: 8,
    marginBottom: 16,
  },
  acknowledgeButton: {
    backgroundColor: theme.accent,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 32,
    borderRadius: 12,
  },
  acknowledgedButton: {
    backgroundColor: theme.textMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  acknowledgeText: {
    color: theme.white,
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
});
