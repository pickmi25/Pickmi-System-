import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Animated, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, Chip, Title, Paragraph, IconButton, SegmentedButtons, Divider } from 'react-native-paper';
import axios from 'axios';
import { ArrowLeft, Info, Search, ShieldAlert, Plus, Trash2, LogOut, Server, Globe } from 'lucide-react-native';

import { setBackendUrl, getEffectiveBackendUrl } from '../config'; 

const KeywordSettingsScreen = ({ navigation, onLogout }) => {
  const [activeTab, setActiveTab] = useState('match');
  const [matchKeywords, setMatchKeywords] = useState([]);
  const [avoidKeywords, setAvoidKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [backendUrlInput, setBackendUrlInput] = useState(getEffectiveBackendUrl());
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    const currentUrl = getEffectiveBackendUrl();
    try {
      const matchResp = await axios.get(`${currentUrl}/keywords?ts=${Date.now()}`);
      const avoidResp = await axios.get(`${currentUrl}/avoid-keywords?ts=${Date.now()}`);
      setMatchKeywords(matchResp.data);
      setAvoidKeywords(avoidResp.data);
    } catch (error) {
      console.error('Fetch Error:', error);
    }
  };

  const updateServerUrl = () => {
      setBackendUrl(backendUrlInput);
      fetchData();
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addKeyword = async () => {
    if (!newKeyword.trim()) return;
    const endpoint = activeTab === 'match' ? '/keywords' : '/avoid-keywords';
    try {
      setLoading(true);
      await axios.post(`${getBackendUrl()}${endpoint}`, { word: newKeyword.trim() });
      setNewKeyword('');
      fetchData();
      setLoading(false);
    } catch (error) {
      console.error('Add Error:', error);
      setLoading(false);
    }
  };

  const removeKeyword = async (word) => {
    const endpoint = activeTab === 'match' ? '/keywords' : '/avoid-keywords';
    try {
      await axios.delete(`${getBackendUrl()}${endpoint}/${word}`);
      fetchData();
    } catch (error) {
      console.error('Remove Error:', error);
    }
  };

  const currentKeywords = activeTab === 'match' ? matchKeywords : avoidKeywords;

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
          <IconButton 
            icon={() => <ArrowLeft size={24} color="#1a1a1a" />} 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          />
          <Title style={styles.headerTitle}>Keyword Management</Title>
          <View style={{ width: 44 }} />
      </View>

      <View style={styles.tabContainer}>
        <SegmentedButtons
            value={activeTab}
            onValueChange={setActiveTab}
            buttons={[
            {
                value: 'match',
                label: 'Trigger Words',
                icon: () => <Search size={16} color={activeTab === 'match' ? '#5d10e3' : '#666'} />,
            },
            {
                value: 'avoid',
                label: 'Avoid Words',
                icon: () => <ShieldAlert size={16} color={activeTab === 'avoid' ? '#5d10e3' : '#666'} />,
            },
            ]}
            style={styles.segmented}
            theme={{ colors: { secondaryContainer: '#f0e6ff' }}}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={activeTab === 'match' ? styles.infoBoxMatch : styles.infoBoxAvoid}>
            {activeTab === 'match' ? <Search size={20} color="#5d10e3" /> : <ShieldAlert size={20} color="#d32f2f" />}
            <Text style={[styles.infoText, { color: activeTab === 'match' ? '#5d10e3' : '#d32f2f' }]}>
                {activeTab === 'match' 
                    ? "If ANY of these words appear in a message, it will be added to your trip list."
                    : "If ANY of these words appear, the message will be IGNORED even if it matches trigger words."}
            </Text>
        </View>

        <View style={styles.inputCard}>
          <TextInput
            mode="outlined"
            label={activeTab === 'match' ? "Add Trigger Word" : "Add Avoid Word"}
            placeholder={activeTab === 'match' ? "e.g. pickup" : "e.g. status update"}
            value={newKeyword}
            onChangeText={setNewKeyword}
            style={styles.input}
            outlineColor="#ddd"
            activeOutlineColor={activeTab === 'match' ? "#5d10e3" : "#d32f2f"}
            textColor="#1a1a1a"
            theme={{ colors: { primary: activeTab === 'match' ? '#5d10e3' : '#d32f2f' }}}
          />
          <Button 
              mode="contained" 
              onPress={addKeyword} 
              style={[styles.addButton, { backgroundColor: activeTab === 'match' ? '#5d10e3' : '#d32f2f' }]}
              loading={loading}
              disabled={loading}
              contentStyle={{ height: 50 }}
          >
            {activeTab === 'match' ? 'Add Trigger' : 'Add Avoid Word'}
          </Button>
        </View>

        <View style={styles.keywordSection}>
          <Title style={styles.sectionTitle}>
            {activeTab === 'match' ? 'Active Triggers' : 'Ignored Words'}
          </Title>
          <View style={styles.chipContainer}>
            {currentKeywords.map((word, index) => (
              <Chip 
                key={index}
                onClose={() => removeKeyword(word)}
                style={styles.chip}
                textStyle={styles.chipText}
                closeIcon={() => <Trash2 size={16} color="#666" />}
              >
                {word}
              </Chip>
            ))}
          </View>
        </View>

        <Divider style={[styles.divider, { marginVertical: 32 }]} />
        
        <View style={styles.serverSection}>
           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
               <Server size={22} color="#5d10e3" />
               <Title style={[styles.sectionTitle, { marginBottom: 0 }]}>Local Server Settings</Title>
           </View>
           <Paragraph style={{ color: '#666', marginBottom: 16 }}>
               Set the IP address of your local server (e.g. your Mac's IP or localhost if running in Termux).
           </Paragraph>
           <TextInput
             mode="outlined"
             label="Backend Server URL"
             value={backendUrlInput}
             onChangeText={setBackendUrlInput}
             style={styles.input}
             placeholder="http://192.168.1.10:3000"
             activeOutlineColor="#5d10e3"
           />
           <Button mode="contained" onPress={updateServerUrl} buttonColor="#5d10e3" icon={() => <Globe size={18} color="#fff" />}>
               Switch Server Address
           </Button>
        </View>

        <View style={styles.logoutSection}>
          <Divider style={styles.divider} />
          <Button 
            mode="outlined" 
            onPress={onLogout} 
            style={styles.logoutButton}
            textColor="#ff5252"
            icon={() => <LogOut size={18} color="#ff5252" />}
          >
            Sign Out from Admin
          </Button>
          <Text style={styles.versionText}>Pickmi System v2.0 (Web Only)</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    color: '#1a1a1a',
    fontSize: 20,
    fontWeight: 'bold',
  },
  backButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  tabContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  segmented: {
    borderRadius: 12,
  },
  content: {
    padding: 24,
  },
  infoBoxMatch: {
    flexDirection: 'row',
    backgroundColor: '#f0e6ff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    gap: 12,
    alignItems: 'center',
  },
  infoBoxAvoid: {
    flexDirection: 'row',
    backgroundColor: '#ffebee',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    gap: 12,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  inputCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 4,
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  addButton: {
    borderRadius: 12,
    justifyContent: 'center',
  },
  keywordSection: {
    marginTop: 8,
  },
  sectionTitle: {
    color: '#1a1a1a',
    fontSize: 18,
    marginBottom: 16,
    fontWeight: 'bold',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    backgroundColor: '#f0f0f0',
    marginBottom: 4,
    borderColor: '#ddd',
    borderWidth: 1,
  },
  chipText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 13,
  },
  logoutSection: {
    marginTop: 40,
    alignItems: 'center',
    paddingBottom: 40,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#eee',
    marginBottom: 24,
  },
  logoutButton: {
    width: '100%',
    borderRadius: 12,
    borderColor: '#ff5252',
    borderWidth: 1.5,
  },
  versionText: {
    marginTop: 16,
    color: '#aaa',
    fontSize: 11,
  }
});

export default KeywordSettingsScreen;
