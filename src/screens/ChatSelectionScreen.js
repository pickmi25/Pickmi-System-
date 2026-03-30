import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, SafeAreaView, TouchableOpacity } from 'react-native';
import { Text, Title, Searchbar, Checkbox, List, Avatar, Button, IconButton } from 'react-native-paper';
import axios from 'axios';
import { Users, User, ArrowLeft, Search, Filter } from 'lucide-react-native';

import { getBackendUrl } from '../config'; 

const ChatSelectionScreen = ({ navigation }) => {
  const [chats, setChats] = useState([]);
  const [monitoredIds, setMonitoredIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'groups', 'contacts'

  const fetchData = async () => {
    try {
      setLoading(true);
      const [chatsRes, monitoredRes] = await Promise.all([
        axios.get(`${getBackendUrl()}/chats`),
        axios.get(`${getBackendUrl()}/monitored-chats`)
      ]);
      setChats(chatsRes.data);
      setMonitoredIds(monitoredRes.data.map(m => m.id));
    } catch (error) {
      console.error('Fetch Chats Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleMonitoring = async (chat) => {
    const isMonitored = monitoredIds.includes(chat.id);
    try {
      if (isMonitored) {
        await axios.delete(`${getBackendUrl()}/monitored-chats/${chat.id}`);
        setMonitoredIds(prev => prev.filter(id => id !== chat.id));
      } else {
        await axios.post(`${getBackendUrl()}/monitored-chats`, {
          id: chat.id,
          name: chat.name,
          isGroup: chat.isGroup
        });
        setMonitoredIds(prev => [...prev, chat.id]);
      }
    } catch (error) {
      console.error('Toggle Monitoring Error:', error);
    }
  };

  const filteredChats = chats.filter(chat => {
    const matchesSearch = chat.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterMode === 'all' || 
                         (filterMode === 'groups' && chat.isGroup) || 
                         (filterMode === 'contacts' && !chat.isGroup);
    return matchesSearch && matchesFilter;
  });

  const renderChatItem = ({ item }) => {
    const isMonitored = monitoredIds.includes(item.id);
    return (
      <List.Item
        title={item.name}
        titleStyle={{ fontWeight: 'bold' }}
        description={item.isGroup ? 'Group Chat' : 'Contact'}
        left={props => (
          <View style={styles.avatarContainer}>
             {item.picture ? (
               <Avatar.Image size={40} source={{ uri: item.picture }} />
             ) : (
               <Avatar.Icon size={40} icon={item.isGroup ? 'account-group' : 'account'} backgroundColor="#f0e6ff" color="#5d10e3" />
             )}
          </View>
        )}
        right={props => (
          <Checkbox
            status={isMonitored ? 'checked' : 'unchecked'}
            onPress={() => toggleMonitoring(item)}
            color="#5d10e3"
          />
        )}
        onPress={() => toggleMonitoring(item)}
        style={[styles.listItem, isMonitored && styles.selectedItem]}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
            <Title style={styles.title}>Scan Selection</Title>
            <Text style={styles.subtitle}>{monitoredIds.length} chats monitored</Text>
        </View>
        <Button mode="text" onPress={fetchData} textColor="#5d10e3">Refresh</Button>
      </View>

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search groups or contacts..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          iconColor="#5d10e3"
        />
        <View style={styles.filterRow}>
            <TouchableOpacity 
                style={[styles.filterChip, filterMode === 'all' && styles.activeChip]}
                onPress={() => setFilterMode('all')}
            >
                <Text style={[styles.filterText, filterMode === 'all' && styles.activeFilterText]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.filterChip, filterMode === 'groups' && styles.activeChip]}
                onPress={() => setFilterMode('groups')}
            >
                <Users size={14} color={filterMode === 'groups' ? '#fff' : '#666'} />
                <Text style={[styles.filterText, filterMode === 'groups' && styles.activeFilterText]}>Groups</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.filterChip, filterMode === 'contacts' && styles.activeChip]}
                onPress={() => setFilterMode('contacts')}
            >
                <User size={14} color={filterMode === 'contacts' ? '#fff' : '#666'} />
                <Text style={[styles.filterText, filterMode === 'contacts' && styles.activeFilterText]}>Contacts</Text>
            </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredChats}
        keyExtractor={item => item.id}
        renderItem={renderChatItem}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} tintColor="#5d10e3" />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {loading ? 'Fetching chats...' : 'No chats found matching your search.'}
            </Text>
          </View>
        }
      />
      
      <View style={styles.footer}>
        <Text style={styles.footerInfo}>Only selected chats will be scanned for trip details.</Text>
        <Button mode="contained" onPress={() => navigation.goBack()} style={styles.doneButton}>
            Done
        </Button>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 20, fontWeight: 'bold' },
  subtitle: { fontSize: 12, color: '#888' },
  searchContainer: { padding: 15, backgroundColor: '#f9f9f9' },
  searchBar: { elevation: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', borderRadius: 12 },
  filterRow: { flexDirection: 'row', gap: 10, marginTop: 15 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' },
  activeChip: { backgroundColor: '#5d10e3', borderColor: '#5d10e3' },
  filterText: { fontSize: 13, color: '#666', fontWeight: 'bold' },
  activeFilterText: { color: '#fff' },
  list: { paddingBottom: 100 },
  listItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
  selectedItem: { backgroundColor: '#f0e6ff20' },
  avatarContainer: { marginLeft: 10, marginRight: 5 },
  emptyContainer: { marginTop: 100, alignItems: 'center' },
  emptyText: { color: '#888' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 20, borderTopWidth: 1, borderTopColor: '#eee', elevation: 10 },
  footerInfo: { fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 15 },
  doneButton: { borderRadius: 12, backgroundColor: '#5d10e3' }
});

export default ChatSelectionScreen;
