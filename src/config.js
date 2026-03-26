import { Platform } from 'react-native';

const getBackendUrl = () => {
  if (Platform.OS === 'web') {
    // If we're on web, always use the current domain (localhost or server IP)
    const host = (typeof window !== 'undefined' && window.location.hostname) 
      ? window.location.hostname 
      : 'localhost';
    return `http://${host}:3000`;
  }
  // For mobile devices, use the hardcoded IP of your computer
  return 'http://192.0.0.2:3000';
};

export const BACKEND_URL = getBackendUrl();
