

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
import { Colors, Fonts, Glass } from '../../../constants/theme';

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
          <ActivityIndicator size="large" color={Colors.accent} />
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

      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
      </View>

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

          <View style={styles.severityBadge}>
            <Text
              style={[
                styles.severityText,
                isCritical && styles.severityCritical,
              ]}
            >
              Severity: {alert.severity}/5
            </Text>
          </View>
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
            <ActivityIndicator size="small" color={Colors.white} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: Colors.accent,
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
    color: Colors.textMuted,
  },
  criticalBar: {
    backgroundColor: Colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  criticalBarText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  titleCard: {
    ...Glass.card,
    padding: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  severityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.accentLight,
  },
  severityText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
  },
  severityCritical: {
    color: Colors.accent,
  },
  sectionCard: {
    ...Glass.card,
    padding: 16,
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: Colors.accent,
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
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  workPlanStep: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  noContent: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  zoneDescription: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  issuedTime: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginTop: 8,
    marginBottom: 16,
  },
  acknowledgeButton: {
    backgroundColor: Colors.cta,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 32,
    borderRadius: 14,
    shadowColor: Colors.cta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  acknowledgedButton: {
    backgroundColor: Colors.textMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  acknowledgeText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
});
