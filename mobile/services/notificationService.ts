import Constants from 'expo-constants'
import * as Device from 'expo-device'
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import { Platform } from 'react-native'
import { API_BASE } from '../config/api'

let Notifications: any = null
if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications')
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    })
  } catch (error) {
    Notifications = null
    console.warn('Notifications unavailable:', error)
  }
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web' || !Notifications) return null
  if (!Device.isDevice) return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Emergency alerts',
      importance: Notifications.AndroidImportance.HIGH,
    })
  }
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return null

  let token: string | null = null;
  try {
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId
    if (!projectId) return null
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
  } catch (error) {
    console.warn('Could not fetch Expo push token. Check the EAS project ID and push credentials.');
  }

  const authToken = await AsyncStorage.getItem('token')
  if (authToken && token) {
    try {
      await axios.post(
        `${API_BASE}/api/users/push-token`,
        { push_token: token },
        { headers: { Authorization: `Bearer ${authToken}` } }
      )
    } catch (e) {
      console.warn("Failed to send push token to backend", e);
    }
  }

  return token
}

export function setupNotificationListeners(router: any) {
  if (Platform.OS === 'web' || !Notifications) return () => {}

  const fgSub = Notifications.addNotificationReceivedListener((notif: any) => {
    const data = notif.request.content.data

    console.log('Alert received:', data)
  })

  const tapSub = Notifications.addNotificationResponseReceivedListener((resp: any) => {
    const data = resp.notification.request.content.data
    if (data.alert_id) {
      router.push(`/(people)/alert/${data.alert_id}`)
    }
  })

  return () => {
    fgSub.remove()
    tapSub.remove()
  }
}
