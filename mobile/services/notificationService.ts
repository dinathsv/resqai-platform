import * as Device from 'expo-device'
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import { Platform } from 'react-native'
import { BASE_URL } from '../constants/api'

let Notifications: any = null
if (Platform.OS !== 'web') {
  Notifications = require('expo-notifications')
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  })
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web' || !Notifications) return null
  if (!Device.isDevice) return null

  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return null

  let token: string | null = null;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId: '00000000-0000-0000-0000-000000000000' })).data
  } catch (error) {
    console.warn("Could not fetch Expo push token (ensure EAS projectId is valid). Using dummy token.");
    token = "dummy-expo-push-token";
  }

  const authToken = await AsyncStorage.getItem('token')
  if (authToken && token) {
    try {
      await axios.post(
        `${BASE_URL}/api/users/push-token`,
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
