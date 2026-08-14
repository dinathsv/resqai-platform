import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import { BASE_URL } from '../constants/api'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null

  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return null

  const token = (await Notifications.getExpoPushTokenAsync()).data

  const authToken = await AsyncStorage.getItem('token')
  if (authToken) {
    await axios.post(
      `${BASE_URL}/api/users/push-token`,
      { push_token: token },
      { headers: { Authorization: `Bearer ${authToken}` } }
    )
  }

  return token
}

export function setupNotificationListeners(router: any) {
  // Foreground handler — show in-app banner instead of system notification
  const fgSub = Notifications.addNotificationReceivedListener((notif) => {
    const data = notif.request.content.data
    // Show plain in-app banner (implemented in _layout.tsx)
    // Emit event to state manager with alert data
    console.log('Alert received:', data)
  })

  // Tap handler — navigate to alert screen
  const tapSub = Notifications.addNotificationResponseReceivedListener((resp) => {
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
