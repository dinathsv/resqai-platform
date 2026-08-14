import { useEffect, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import { BASE_URL } from '../constants/api'
import { getPendingRequests, markSynced } from '../services/offlineStorage'

export function useNetworkSync() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected && state.isInternetReachable
      setIsOnline(!!online)
      if (online) syncPending()
    })

    return unsubscribe
  }, [])

  async function syncPending() {
    const pending = getPendingRequests() as any[]
    for (const req of pending) {
      try {
        const token = await AsyncStorage.getItem(
          req.is_guest ? 'guest_token' : 'token'
        )
        await axios.post(
          `${BASE_URL}/api/requests`,
          { message: req.message, lat: req.lat, lng: req.lng },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        markSynced(req.id)
      } catch (e) {
        console.log('Sync failed for', req.id)
      }
    }
  }

  return { isOnline }
}
