import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Change this to your production server URL before App Store submission
// For local dev with Expo Go: use your machine's local IP (not localhost)
const BASE_URL = __DEV__
  ? 'http://YOUR_LOCAL_IP:5001/api'   // e.g. 'http://192.168.1.100:5001/api'
  : 'https://api.dashguard.com/api';  // your production API

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// Attach JWT token to every request
client.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('dashguard_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — clear token, navigation handled by AuthContext
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('dashguard_token');
    }
    return Promise.reject(error);
  }
);

export default client;
