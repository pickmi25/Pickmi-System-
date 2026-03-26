import React, { useState } from 'react';
import { View, StyleSheet, Image, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { Text, TextInput, Button, Card, Title, Paragraph, List, IconButton } from 'react-native-paper';
import { ShieldCheck, Lock, User, ArrowRight } from 'lucide-react-native';

const LoginScreen = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (username === 'Pickmi_Admin' && password === 'Pickmi_25') {
      onLogin();
    } else {
      setError('Invalid ID or Password');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.backgroundAccent} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Card style={styles.loginCard}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <ShieldCheck size={40} color="#5d10e3" />
            </View>
            <Title style={styles.title}>Pickmi Admin</Title>
            <Paragraph style={styles.subtitle}>Enter your credentials to access the system</Paragraph>
          </View>

          <Card.Content style={styles.form}>
            <TextInput
              label="Admin ID"
              value={username}
              onChangeText={setUsername}
              mode="outlined"
              style={styles.input}
              outlineColor="#eee"
              activeOutlineColor="#5d10e3"
              left={<TextInput.Icon icon={() => <User size={20} color="#666" />} />}
            />
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              mode="outlined"
              style={styles.input}
              outlineColor="#eee"
              activeOutlineColor="#5d10e3"
              left={<TextInput.Icon icon={() => <Lock size={20} color="#666" />} />}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Button 
              mode="contained" 
              onPress={handleLogin}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
            >
              Sign In
            </Button>
          </Card.Content>
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>Pickmi System v2.0 • Web Only Edition</Text>
          </View>
        </Card>
      </KeyboardAvoidingView>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: '#5d10e3',
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
  },
  keyboardView: {
    width: Platform.OS === 'web' ? 450 : '90%',
    maxWidth: 500,
  },
  loginCard: {
    padding: 20,
    borderRadius: 24,
    elevation: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 10,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 25,
    backgroundColor: '#f0e6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1a1a1a',
  },
  subtitle: {
    color: '#666',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 4,
  },
  form: {
    paddingBottom: 20,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  button: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: '#5d10e3',
    height: 54,
    justifyContent: 'center',
  },
  buttonContent: {
    height: 54,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  errorText: {
    color: '#ff5252',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 20,
  },
  footerText: {
    color: '#999',
    fontSize: 12,
  }
});

export default LoginScreen;
