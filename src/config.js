import { Platform } from 'react-native';

// Simple global for runtime updates without AsyncStorage for now
const getInitialUrl = () => {
  // If we have a production URL defined in env (e.g. via Vercel/Expo), use it.
  // Otherwise, default to localhost behavior.
  const prodUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (prodUrl) return prodUrl;

  if (Platform.OS === 'web') {
    return (typeof window !== 'undefined' && window.location.hostname) 
      ? `http://${window.location.hostname}:3000` 
      : 'http://localhost:3000';
  }
  if (Platform.OS === 'android') {
    return 'http://localhost:3000'; // Default for Termux on phone
  }
  return 'http://192.0.0.2:3000'; // Fallback
};

global.CUSTOM_BACKEND_URL = getInitialUrl();

export const getBackendUrl = () => {
  return global.CUSTOM_BACKEND_URL;
};

// Map existing usage to the dynamic getter
export const getEffectiveBackendUrl = () => getBackendUrl();

export const setBackendUrl = (url) => {
    global.CUSTOM_BACKEND_URL = url;
};

// Legacy support
export const BACKEND_URL = getBackendUrl();
