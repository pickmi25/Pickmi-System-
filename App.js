import 'react-native-gesture-handler';
import * as React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider, DefaultTheme as PaperDefaultTheme } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Home, Briefcase, Smartphone, Settings, MessageCircle } from 'lucide-react-native';
import WhatsAppWebScreen from './src/screens/WhatsAppWebScreen';

import WhatsAppConnectScreen from './src/screens/WhatsAppConnectScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ConfirmedTripsScreen from './src/screens/ConfirmedTripsScreen';
import KeywordSettingsScreen from './src/screens/KeywordSettingsScreen';
import ChatSelectionScreen from './src/screens/ChatSelectionScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const theme = {
  ...PaperDefaultTheme,
  colors: {
    ...PaperDefaultTheme.colors,
    primary: '#5d10e3',
    background: '#ffffff',
    surface: '#ffffff',
    text: '#1a1a1a',
    outline: '#dddddd',
    onSurface: '#1a1a1a',
  },
};

const navigationTheme = {
  ...NavigationDefaultTheme,
  colors: {
    ...NavigationDefaultTheme.colors,
    primary: '#5d10e3',
    background: '#ffffff',
    card: '#ffffff',
    text: '#1a1a1a',
    border: '#eeeeee',
    notification: '#ff4081',
  },
};

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#5d10e3',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: {
          height: 70,
          paddingBottom: 12,
          paddingTop: 8,
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f0f0f0',
          elevation: 10,
        },
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Home') return <Home size={size} color={color} />;
          if (route.name === 'Trips') return <Briefcase size={size} color={color} />;
          if (route.name === 'Chats') return <MessageCircle size={size} color={color} />;
          if (route.name === 'WhatsApp') return <Smartphone size={size} color={color} />;
          if (route.name === 'Settings') return <Settings size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ tabBarLabel: 'Detections' }} />
      <Tab.Screen name="Trips" component={ConfirmedTripsScreen} options={{ tabBarLabel: 'My Trips' }} />
      <Tab.Screen name="WhatsApp" component={WhatsAppConnectScreen} options={{ tabBarLabel: 'WhatsApp' }} />
      <Tab.Screen name="Settings" component={KeywordSettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <NavigationContainer theme={navigationTheme}>
            <StatusBar style="dark" />
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Main" component={TabNavigator} />
              <Stack.Screen name="KeywordSettings" component={KeywordSettingsScreen} />
              <Stack.Screen name="ChatSelection" component={ChatSelectionScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
