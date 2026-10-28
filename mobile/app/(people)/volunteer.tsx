import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import { BASE_URL } from '../../constants/api'
import MinimalButton from '../../components/MinimalButton'
import { Colors, Fonts, Glass } from '../../constants/theme'
import { useLanguage } from '../../context/LanguageContext'

interface Mission {
  mission_id: string
  title: string
  description: string
  district: string
  volunteers_needed: number
}

interface Assignment {
  assignment_id: string
  mission_id: string
  mission_title: string
  status: 'active' | 'completed' | 'cancelled'
  hours_logged: number
}

type Tab = 'available' | 'mine'

export default function VolunteerScreen() {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<Tab>('available')
  const [missions, setMissions] = useState<Mission[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (activeTab === 'available') {
      fetchMissions()
    } else {
      fetchAssignments()
    }
  }, [activeTab])

  async function getAuthHeaders() {
    const token = await AsyncStorage.getItem('token')
    return { Authorization: `Bearer ${token}` }
  }

  async function fetchMissions() {
    setLoading(true)
    setError('')
    try {
      const headers = await getAuthHeaders()
      const res = await axios.get(`${BASE_URL}/api/missions?status=active`, {
        headers,
      })
      setMissions(res.data)
    } catch (e) {
      setError(t('volunteer.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }

  async function fetchAssignments() {
    setLoading(true)
    setError('')
    try {
      const headers = await getAuthHeaders()
      const res = await axios.get(`${BASE_URL}/api/volunteer-assignments`, {
        headers,
      })
      setAssignments(res.data)
    } catch (e) {
      setError(t('volunteer.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }

  async function joinMission(missionId: string) {
    try {
      const headers = await getAuthHeaders()
      await axios.post(
        `${BASE_URL}/api/volunteer-assignments`,
        { mission_id: missionId },
        { headers }
      )
      fetchMissions()
    } catch (e) {
      setError(t('volunteer.failedToJoin'))
    }
  }

  function confirmJoin(mission: Mission) {
    Alert.alert(t('volunteer.joinConfirmTitle'), mission.title, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('volunteer.join'), onPress: () => joinMission(mission.mission_id) },
    ])
  }

  async function markComplete(assignmentId: string) {
    try {
      const headers = await getAuthHeaders()
      await axios.patch(
        `${BASE_URL}/api/volunteer-assignments/${assignmentId}/complete`,
        {},
        { headers }
      )
      fetchAssignments()
    } catch (e) {
      setError(t('volunteer.failedToComplete'))
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'active':
        return Colors.accent
      case 'completed':
        return Colors.cta
      case 'cancelled':
        return Colors.textMuted
      default:
        return Colors.textPrimary
    }
  }

  function renderMission({ item }: { item: Mission }) {
    return (
      <View style={styles.itemCard}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemDistrict}>{item.district}</Text>
          <Text style={styles.itemDescription} numberOfLines={2}>
            {item.description}
          </Text>
          <Text style={styles.volunteerCount}>
            {t('volunteer.volunteersNeeded', { count: item.volunteers_needed })}
          </Text>
        </View>
        <MinimalButton
          title={t('volunteer.join')}
          variant="cta"
          small
          onPress={() => confirmJoin(item)}
        />
      </View>
    )
  }

  function renderAssignment({ item }: { item: Assignment }) {
    return (
      <View style={styles.itemCard}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle}>{item.mission_title}</Text>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
          <Text style={styles.hoursText}>
            {t('volunteer.hoursLogged', { hours: item.hours_logged })}
          </Text>
        </View>
        {item.status === 'active' && (
          <MinimalButton
            title={t('volunteer.complete')}
            variant="cta"
            small
            onPress={() => markComplete(item.assignment_id)}
          />
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>

      <View style={styles.tabRow}>
        <TouchableOpacity
          onPress={() => setActiveTab('available')}
          style={[styles.tab, activeTab === 'available' && styles.tabActive]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'available' ? styles.tabTextActive : styles.tabTextInactive,
            ]}
          >
            {t('volunteer.availableMissions')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('mine')}
          style={[styles.tab, activeTab === 'mine' && styles.tabActive]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'mine' ? styles.tabTextActive : styles.tabTextInactive,
            ]}
          >
            {t('volunteer.myMissions')}
          </Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      ) : activeTab === 'available' ? (
        <FlatList
          data={missions}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item: Mission) => item.mission_id}
          renderItem={renderMission}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('volunteer.noMissionsAvailable')}</Text>
          }
        />
      ) : (
        <FlatList
          data={assignments}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item: Assignment) => item.assignment_id}
          renderItem={renderAssignment}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('volunteer.noMissionsAvailable')}</Text>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tab: {
    marginRight: 24,
    paddingBottom: 12,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.accent,
  },
  tabText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
  },
  tabTextActive: {
    color: Colors.accent,
  },
  tabTextInactive: {
    color: Colors.textMuted,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  itemDistrict: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  itemDescription: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  volunteerCount: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  statusText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    marginTop: 4,
  },
  hoursText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  loadingText: {
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  emptyText: {
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  errorText: {
    color: Colors.error,
    fontFamily: Fonts.medium,
    fontSize: 13,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
})
