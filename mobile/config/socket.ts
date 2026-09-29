

import { io, Socket } from 'socket.io-client';
import { SOCKET_URL, getToken } from './api';

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket | null> {
  if (socket?.connected) {
    return socket;
  }

  const token = await getToken();
  if (!token) {
    console.log('No auth token available for Socket.IO connection');
    return null;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('Socket.IO connected to', SOCKET_URL);
  });

  socket.on('connect_error', (err) => {
    console.warn('Socket.IO connection notice:', err.message);
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
}

export function getSocket(): Socket | null {
  return socket;
}
