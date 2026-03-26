import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Image, ActivityIndicator, SafeAreaView, ScrollView, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Button, Card, Title, Paragraph, Avatar, Divider, List, IconButton, Searchbar, Badge, Menu } from 'react-native-paper';
import axios from 'axios';
import { Smartphone, CheckCircle, AlertCircle, LogOut, ChevronRight, MessageSquare, RefreshCw, Users, User, ArrowLeft, Send, Mic, MoreVertical } from 'lucide-react-native';
import AudioMessage from '../components/AudioMessage';
import { BACKEND_URL } from '../config'; 

const WhatsAppConnectScreen = ({ navigation, route }) => {
  const { targetChatId, initialMsg, originalMsg, msgId: highlightId } = route.params || {};
  
  const [qr, setQr] = useState('');
  const [status, setStatus] = useState('Disconnected');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);

  // Chat-related state
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const scrollViewRef = useRef();

  const fetchData = async () => {
    try {
      const resp = await axios.get(`${BACKEND_URL}/qr?ts=${Date.now()}`);
      const newStatus = resp.data.status;
      setQr(resp.data.qr);
      setStatus(newStatus);
      
      if (newStatus === 'Connected' && !profile) {
          const profResp = await axios.get(`${BACKEND_URL}/profile?ts=${Date.now()}`);
          setProfile(profResp.data);
          fetchChats();
      }
      setLoading(false);
    } catch (error) {
      console.error('Fetch Data Error:', error);
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      setLoading(true);
      setQr('');
      setProfile(null);
      setMenuVisible(false);
      await axios.post(`${BACKEND_URL}/reset`);
      fetchData();
    } catch (error) {
      console.error('Reset Error:', error);
      setLoading(false);
    }
  };

  const fetchChats = async () => {
    if (status !== 'Connected') return;
    try {
        const response = await axios.get(`${BACKEND_URL}/chats?ts=${Date.now()}`);
        setChats(response.data);
    } catch (e) {
        console.error("Fetch Chats Error:", e);
    }
  };

  const fetchMessages = async (chatId) => {
    try {
        setMsgLoading(true);
        const response = await axios.get(`${BACKEND_URL}/chats/${chatId}/messages`);
        setMessages(response.data);
        setMsgLoading(false);
        axios.post(`${BACKEND_URL}/chats/${chatId}/read`).catch(() => {});
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, unreadCount: 0 } : c));
    } catch (e) {
        console.error("Fetch Messages Error:", e);
        setMsgLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !selectedChat) return;
    const msgToSend = inputText;
    setInputText('');
    try {
        await axios.post(`${BACKEND_URL}/chats/send`, {
            chatId: selectedChat.id,
            message: msgToSend
        });
        fetchMessages(selectedChat.id);
    } catch (e) {
        console.error("Send Error:", e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [profile]);

  useEffect(() => {
    if (status === 'Connected') {
        const chatInterval = setInterval(fetchChats, 7000);
        return () => clearInterval(chatInterval);
    }
  }, [status]);

  // Handle deep link (targetChatId) from Dashboard
  useEffect(() => {
    if (targetChatId && chats.length > 0) {
        const chat = chats.find(c => c.id === targetChatId);
        if (chat) {
            setSelectedChat(chat);
            fetchMessages(chat.id);
        } else {
            const placeholder = { id: targetChatId, name: "Loading Chat...", isGroup: targetChatId.includes('@g.us') };
            setSelectedChat(placeholder);
            fetchMessages(targetChatId);
        }
        // Once navigated via link, we should clear the param so they can navigate back normally
        navigation.setParams({ targetChatId: null });
    }
  }, [targetChatId, chats.length]);

  const filteredChats = chats.filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderChatItem = ({ item }) => (
    <TouchableOpacity 
        style={styles.chatItem} 
        onPress={() => {
            setSelectedChat(item);
            fetchMessages(item.id);
        }}
    >
        <View style={styles.avatarContainer}>
            {item.picture ? (
                <Avatar.Image size={50} source={{ uri: item.picture }} />
            ) : (
                item.isGroup ? <Users color="#5d10e3" /> : <User color="#5d10e3" />
            )}
        </View>
        <View style={styles.chatInfo}>
            <View style={styles.chatHeader}>
                <Text style={styles.chatName} numberOfLines={1}>{item.name}</Text>
                {item.unreadCount > 0 && <Badge style={styles.unreadBadge}>{item.unreadCount}</Badge>}
            </View>
            <Text style={styles.lastMsg} numberOfLines={1}>{item.lastMessage || "No messages"}</Text>
        </View>
        <Divider />
    </TouchableOpacity>
  );

  const renderConnectedView = () => {
    // If a chat is selected, show the chat room
    if (selectedChat) {
      return (
        <SafeAreaView style={styles.listContainer}>
            <View style={styles.chatRoomHeader}>
                <IconButton icon={() => <ArrowLeft size={24} />} onPress={() => setSelectedChat(null)} />
                <Title style={styles.roomHeaderTitle} numberOfLines={1}>{selectedChat?.name || "Loading..."}</Title>
            </View>
            
            <ScrollView 
                style={styles.msgList} 
                ref={scrollViewRef}
                onContentSizeChange={() => scrollViewRef.current.scrollToEnd({ animated: true })}
            >
                {msgLoading ? (
                    <ActivityIndicator style={{ marginTop: 20 }} color="#5d10e3" />
                ) : (
                    messages.map((m, idx) => {
                        const isHighlight = (m.id === highlightId) || 
                                          (originalMsg && m.body && originalMsg.includes(m.body)) ||
                                          (originalMsg && m.body && m.body.includes(originalMsg));
                        
                        return (
                            <View 
                                key={idx} 
                                style={[
                                    styles.msgBubble, 
                                    m.fromMe ? styles.myMsg : styles.theirMsg,
                                    isHighlight && styles.highlightedBubble
                                ]}
                            >
                                {!m.fromMe && <Text style={[styles.msgSender, isHighlight && styles.highlightedMsgSender]}>{m.senderName?.split('@')[0]}</Text>}
                                {m.type === 'ptt' || m.type === 'audio' ? (
                                    <AudioMessage 
                                        uri={m.mediaUrl ? `${BACKEND_URL}${m.mediaUrl}` : `${BACKEND_URL}/messages/${m.id}/media`} 
                                        isDark={m.fromMe} 
                                    />
                                ) : (
                                    <View>
                                        {m.body && m.body.startsWith('[Voice Message]') && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 4 }}>
                                                <Mic size={16} color={m.fromMe ? "#eee" : "#5d10e3"} />
                                                <Text style={[styles.msgText, !m.fromMe && styles.theirMsgText, { fontStyle: 'italic' }]}>Voice Message</Text>
                                            </View>
                                        )}
                                        <Text style={[
                                            styles.msgText, 
                                            !m.fromMe && styles.theirMsgText,
                                            isHighlight && styles.highlightedMsgText
                                        ]}>{m.body}</Text>
                                    </View>
                                )}
                                <View style={styles.msgFooter}>
                                    <Text style={[
                                        styles.msgTime, 
                                        !m.fromMe && styles.theirMsgTime,
                                        isHighlight && styles.highlightedMsgTime
                                    ]}>
                                        {new Date(m.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                    {isHighlight && <Badge style={styles.highlightBadge}>SELECTED</Badge>}
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={styles.inputArea}>
                    <TextInput 
                        style={styles.chatInput}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Type a message..."
                        multiline
                    />
                    <IconButton 
                        icon={() => <Send color="#fff" size={20} />} 
                        style={styles.sendBtn} 
                        onPress={sendMessage}
                        disabled={!inputText.trim()}
                    />
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
      );
    }

    // Default: Show chat list and Header
    return (
      <View style={styles.listContainer}>
          <View style={styles.headerBar}>
              <View style={styles.profileBox}>
                   {profile?.picture ? (
                       <Avatar.Image size={40} source={{ uri: profile.picture }} />
                   ) : (
                       <Avatar.Text size={40} label={profile?.name?.substring(0, 1) || 'U'} />
                   )}
                   <View style={styles.profileText}>
                        <Title style={styles.profileNameHeader}>{profile?.name || 'User'}</Title>
                        <Text style={styles.profileNumberHeader}>+{profile?.number}</Text>
                   </View>
              </View>
              <Menu
                visible={menuVisible}
                onDismiss={() => setMenuVisible(false)}
                anchor={<IconButton icon={() => <MoreVertical size={24} color="#1a1a1a" />} onPress={() => setMenuVisible(true)} />}
              >
                  <Menu.Item onPress={handleReset} title="Log Out Account" leadingIcon="logout" />
              </Menu>
          </View>

          <View style={styles.searchContainer}>
                <Searchbar
                    placeholder="Search chats..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchBar}
                />
          </View>

          <FlatList 
                data={filteredChats}
                renderItem={renderChatItem}
                keyExtractor={item => item.id}
                style={styles.list}
          />
      </View>
    );
  };

  const renderDisconnectedView = () => (
    <ScrollView contentContainerStyle={styles.disconnectedContent}>
        <View style={styles.header}>
            <Smartphone size={40} color="#5d10e3" />
            <Title style={styles.title}>WhatsApp Account</Title>
            <Paragraph style={styles.subtitle}>
              Link your device to start detecting trips from your WhatsApp groups.
            </Paragraph>
        </View>
        
        <Card style={styles.qrCard}>
            <View style={styles.qrContainer}>
                {loading ? (
                <ActivityIndicator size="large" color="#5d10e3" />
                ) : qr ? (
                <Image 
                    source={{ uri: qr }} 
                    style={styles.qrImage}
                    resizeMode="contain"
                />
                ) : (
                <View style={styles.emptyBox}>
                    <AlertCircle size={48} color="#ccc" />
                    <Text style={styles.emptyText}>Generating fresh QR...</Text>
                    <Button 
                        mode="text" 
                        onPress={handleReset}
                        textColor="#5d10e3"
                        icon={() => <RefreshCw size={16} color="#5d10e3" />}
                    >
                        Retry Now
                    </Button>
                </View>
                )}
            </View>
        </Card>

        <View style={styles.instructionBox}>
            <Text style={styles.instructionStep}>1. Open WhatsApp Settings</Text>
            <Text style={styles.instructionStep}>2. Tap on "Linked Devices"</Text>
            <Text style={styles.instructionStep}>3. Scan this QR code to login</Text>
        </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
        {status === 'Connected' ? renderConnectedView() : renderDisconnectedView()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  listContainer: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  profileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileText: {
    justifyContent: 'center',
  },
  profileNameHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: -4,
  },
  profileNumberHeader: {
    fontSize: 12,
    color: '#888',
  },
  disconnectedContent: {
    padding: 24,
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 16,
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22,
  },
  qrCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    elevation: 8,
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
  },
  qrContainer: {
    aspectRatio: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrImage: {
    width: '100%',
    height: '100%',
  },
  instructionBox: {
    marginTop: 32,
    width: '100%',
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  instructionStep: {
    color: '#666',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  emptyBox: {
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    color: '#888',
    fontWeight: '600',
  },
  searchContainer: { padding: 10, backgroundColor: '#fff' },
  searchBar: { borderRadius: 10, backgroundColor: '#f0f0f0', elevation: 0 },
  list: { backgroundColor: '#fff' },
  chatItem: { flexDirection: 'row', padding: 15, alignItems: 'center' },
  avatarContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#f0e6ff', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  chatInfo: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatName: { fontWeight: 'bold', fontSize: 16, color: '#1a1a1a' },
  lastMsg: { color: '#888', fontSize: 13, marginTop: 4 },
  unreadBadge: { backgroundColor: '#5d10e3' },
  chatRoomHeader: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  roomHeaderTitle: { flex: 1, marginLeft: 8 },
  msgList: { flex: 1, padding: 15 },
  msgBubble: { maxWidth: '80%', padding: 12, borderRadius: 15, marginBottom: 8 },
  myMsg: { alignSelf: 'flex-end', backgroundColor: '#5d10e3', borderBottomRightRadius: 2 },
  theirMsg: { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 2, elevation: 1 },
  highlightedBubble: {
      backgroundColor: '#ffffcc',
      borderColor: '#ffd700',
      borderWidth: 1,
      borderStyle: 'dashed',
  },
  msgSender: { fontSize: 10, color: '#5d10e3', fontWeight: 'bold', marginBottom: 4 },
  highlightedMsgSender: { color: '#8b8000' },
  msgText: { fontSize: 14, color: '#fff' },
  theirMsgText: { color: '#333' },
  highlightedMsgText: { color: '#333' },
  msgFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 4 },
  msgTime: { fontSize: 9, color: 'rgba(255,255,255,0.7)' },
  theirMsgTime: { color: '#888' },
  highlightedMsgTime: { color: '#666' },
  highlightBadge: { backgroundColor: '#ffd700', fontSize: 8, height: 14, minWidth: 50 },
  inputArea: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', alignItems: 'center' },
  chatInput: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, maxHeight: 100 },
  sendBtn: { backgroundColor: '#5d10e3', marginLeft: 10 },
});

export default WhatsAppConnectScreen;
