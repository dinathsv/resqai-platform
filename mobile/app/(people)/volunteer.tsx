import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SafeAreaView,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import { BASE_URL } from '../../constants/api'
import MinimalButton from '../../components/MinimalButton'

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
      setError('Failed to load missions')
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
      setError('Failed to load assignments')
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
      setError('Failed to join mission')
    }
  }

  function confirmJoin(mission: Mission) {
    Alert.alert('Join Mission?', mission.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Join', onPress: () => joinMission(mission.mission_id) },
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
      setError('Failed to complete assignment')
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'active':
        return '#000'
      case 'completed':
        return '#888'
      case 'cancelled':
        return 'red'
      default:
        return '#000'
    }
  }

  function renderMission({ item }: { item: Mission }) {
    return (
      <View style={styles.itemRow}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemDistrict}>{item.district}</Text>
          <Text style={styles.itemDescription} numberOfLines={2}>
            {item.description}
          </Text>
          <Text style={styles.volunteerCount}>
            Volunteers: {item.volunteers_needed}
          </Text>
        </View>
        <MinimalButton
          title="Join"
          variant="outline"
          small
          onPress={() => confirmJoin(item)}
        />
      </View>
    )
  }

  function renderAssignment({ item }: { item: Assignment }) {
    return (
      <View style={styles.itemRow}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle}>{item.mission_title}</Text>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status}
          </Text>
          <Text style={styles.hoursText}>Hours logged: {item.hours_logged}</Text>
        </View>
        {item.status === 'active' && (
          <MinimalButton
            title="Mark Complete"
            variant="outline"
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
            Available Missions
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
            My Missions
          </Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <Text style={styles.loadingText}>Loading...</Text>
      ) : activeTab === 'available' ? (
        <FlatList
          data={missions}
          keyExtractor={(item) => item.mission_id}
          renderItem={renderMission}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No missions available</Text>
          }
        />
      ) : (
        <FlatList
          data={assignments}
          keyExtractor={(item) => item.assignment_id}
          renderItem={renderAssignment}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No missions available</Text>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  tab: {
    marginRight: 24,
    paddingBottom: 12,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#000',
  },
  tabTextInactive: {
    color: '#888',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  itemDistrict: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  itemDescription: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
    lineHeight: 18,
  },
  volunteerCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },
  statusText: {
    fontSize: 14,
    marginTop: 4,
  },
  hoursText: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  loadingText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  errorText: {
    color: 'red',
    fontSize: 13,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
})
