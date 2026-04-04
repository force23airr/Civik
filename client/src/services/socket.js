import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

const getSocketOptions = () => ({
  autoConnect: false,
  withCredentials: true,
  auth: {
    token: localStorage.getItem('token') || undefined
  }
});

const socket = io(SOCKET_URL, getSocketOptions());

export const createSocketConnection = () => io(SOCKET_URL, getSocketOptions());

export const connectSocket = () => {
  if (!socket.connected) {
    socket.auth = { token: localStorage.getItem('token') || undefined };
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

export default socket;
