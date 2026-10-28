

import { io, Socket } from 'socket.io-client';
import { SOCKET_URL, getToken } from './api';

let socket: Socket | null = null;
let connectionWarningShown = false;

export async function connectSocket(): Promise<Socket | null> {
  if (socket?.connected) {
    return socket;
  }

  const token = (await getToken()) || 'anonymous';

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 3,
    reconnectionDelay: 2000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    connectionWarningShown = false;
    console.log('Socket.IO connected to', SOCKET_URL);
  });

  socket.on('connect_error', (err) => {
    if (!connectionWarningShown) {
      connectionWarningShown = true;
      console.warn(
        `Socket.IO unavailable at ${SOCKET_URL}. Live alerts will retry in the background.`,
      );
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket.IO disconnected:', reason);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  connectionWarningShown = false;
}

export function getSocket(): Socket | null {
  return socket;
}
