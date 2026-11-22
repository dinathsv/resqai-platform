import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { connectSocket } from '../config/socket';

type RefreshFeed = (isCurrent: () => boolean, fromSocket: boolean, signal: AbortSignal) => Promise<void>;

// Socket events are refresh hints. Only the API decides which requests can be
// published, including removals when a review changes or a request closes.
export function useAlertFeedRefresh(refreshFeed: RefreshFeed) {
  const refreshNow = useRef<(() => Promise<void>) | null>(null);
  useFocusEffect(useCallback(() => {
    let focused = true;
    let fetching = false;
    let pending = false;
    let pendingSocketUpdate = false;
    let currentRequest: AbortController | undefined;
    let removeSocketListeners: (() => void) | undefined;
    const isCurrent = () => focused;
    const foreground = () => !AppState.currentState || AppState.currentState === 'active';

    const refresh = async (fromSocket = false) => {
      if (!focused || !foreground()) return;
      pending = true;
      pendingSocketUpdate ||= fromSocket;
      if (fetching) return;
      fetching = true;
      try {
        while (pending && focused && foreground()) {
          pending = false;
          const liveUpdate = pendingSocketUpdate;
          pendingSocketUpdate = false;
          const controller = new AbortController();
          currentRequest = controller;
          const timeout = setTimeout(() => controller.abort(), 10000);
          try {
            await refreshFeed(isCurrent, liveUpdate, controller.signal);
          } finally {
            clearTimeout(timeout);
            currentRequest = undefined;
          }
        }
      } catch (error) {
        console.warn('Alert feed refresh unavailable:', error);
      } finally {
        fetching = false;
      }
    };

    refreshNow.current = refresh;
    void refresh();
    const interval = setInterval(() => { void refresh(); }, 15000);
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });

    void connectSocket().then(socket => {
      if (!focused || !socket) return;
      const onConnect = () => { void refresh(); };
      const onUpdate = () => { void refresh(true); };
      const events = ['alert_received', 'emergency_alert', 'community_request', 'community_requests_updated'];
      socket.on('connect', onConnect);
      events.forEach(event => socket.on(event, onUpdate));
      removeSocketListeners = () => {
        socket.off('connect', onConnect);
        events.forEach(event => socket.off(event, onUpdate));
      };
    }).catch(error => console.warn('Alert feed socket unavailable:', error));

    return () => {
      focused = false;
      refreshNow.current = null;
      currentRequest?.abort();
      clearInterval(interval);
      appState.remove();
      removeSocketListeners?.();
      // Other screens share this connection; remove only this screen's handlers.
    };
  }, [refreshFeed]));
  return useCallback(() => refreshNow.current?.(), []);
}
