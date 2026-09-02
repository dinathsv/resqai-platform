/**
 * ResQAI — Alert Detail Screen
 *
 * Displays full details of an alert including severity,
 * work plan, affected area, and acknowledge action.
 */

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
  const { id } = useLocalSearchParams<{ id: string }>();
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
          <ActivityIndicator size="large" color="#000000" />
        </View>
      </SafeAreaView>
    );
  }

  if (!alert) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
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
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {isCritical && (
          <View style={styles.criticalBar}>
            <Text style={styles.criticalBarText}>⚠ Critical Emergency</Text>
          </View>
        )}

        <Text style={styles.title}>
          {alert.disaster_type.charAt(0).toUpperCase() +
            alert.disaster_type.slice(1)}{' '}
          Alert
        </Text>

        <Text
          style={[
            styles.severity,
            isCritical && styles.severityCritical,
          ]}
        >
          Severity: {alert.severity}/5
        </Text>

        <Text style={styles.sectionHeading}>What To Do:</Text>
        {Array.isArray(alert.work_plan) && alert.work_plan.length > 0 ? (
          alert.work_plan.map((step: string, index: number) => (
            <Text key={index} style={styles.workPlanStep}>
              {index + 1}. {step}
            </Text>
          ))
        ) : (
          <Text style={styles.noContent}>No instructions available</Text>
        )}

        <Text style={styles.sectionHeading}>Affected Area:</Text>
        <Text style={styles.zoneDescription}>
          {alert.zone_description || alert.district || 'Not specified'}
        </Text>

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
            <ActivityIndicator size="small" color="#FFFFFF" />
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
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    fontSize: 16,
    color: '#000000',
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
    color: '#888888',
  },
  criticalBar: {
    backgroundColor: '#FF0000',
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
    marginBottom: 16,
  },
  criticalBarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  severity: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 20,
  },
  severityCritical: {
    color: '#FF0000',
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  workPlanStep: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 24,
    paddingLeft: 4,
    marginBottom: 4,
  },
  noContent: {
    fontSize: 14,
    color: '#888888',
  },
  zoneDescription: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 22,
  },
  issuedTime: {
    fontSize: 13,
    color: '#888888',
    marginTop: 24,
    marginBottom: 16,
  },
  acknowledgeButton: {
    backgroundColor: '#000000',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 32,
  },
  acknowledgedButton: {
    backgroundColor: '#444444',
  },
  acknowledgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
