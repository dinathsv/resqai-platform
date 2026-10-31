import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { syncMyRequests } from '../services/requestQueue';

export function useNetworkSync() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const sync = () => { void syncMyRequests().catch(error => console.warn('Request sync unavailable:', error)); };
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online) sync();
    });
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') sync(); });
    return () => { unsubscribe(); foreground.remove(); };
  }, []);
  return { isOnline };
}
