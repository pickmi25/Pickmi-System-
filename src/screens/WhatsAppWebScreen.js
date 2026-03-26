import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, Avatar, IconButton, Divider, ActivityIndicator, Searchbar, Badge } from 'react-native-paper';
import axios from 'axios';
import { Send, Users, User, ArrowLeft, MessageCircle, Mic } from 'lucide-react-native';


import { BACKEND_URL } from '../config'; 

const WhatsAppWebScreen = ({ route }) => {
    const { targetChatId, initialMsg, originalMsg, msgId: highlightId } = route.params || {};
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msgLoading, setMsgLoading] = useState(false);
    const [inputText, setInputText] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const scrollViewRef = useRef();

    const fetchChats = async () => {
        try {
            const response = await axios.get(`${BACKEND_URL}/chats`);
            setChats(response.data);
            setLoading(false);
        } catch (e) {
            console.error("Fetch Chats Error:", e);
            setLoading(false);
        }
    };

    const fetchMessages = async (chatId) => {
        try {
            setMsgLoading(true);
            const response = await axios.get(`${BACKEND_URL}/chats/${chatId}/messages`);
            setMessages(response.data);
            setMsgLoading(false);
            // Mark as read in backend
            axios.post(`${BACKEND_URL}/chats/${chatId}/read`).catch(() => {});
            // Clear unread count locally for instant UI response
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
        fetchChats();
        const interval = setInterval(fetchChats, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (targetChatId) {
            // Find in current list
            const chat = chats.find(c => c.id === targetChatId);
            if (chat) {
                setSelectedChat(chat);
                fetchMessages(chat.id);
            } else if (chats.length > 0) {
                // If not found but chats are loaded, try to create a placeholder chat object
                // so we can still attempt to load messages for it
                const placeholder = { id: targetChatId, name: "Loading Chat...", isGroup: targetChatId.includes('@g.us') };
                setSelectedChat(placeholder);
                fetchMessages(targetChatId);
            }
        }
    }, [targetChatId, chats.length]); // Specifically watch chats.length

    const filteredChats = chats.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
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

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color="#5d10e3" />
                <Text style={styles.loadingText}>Fetching your chats...</Text>
            </View>
        );
    }

    if (selectedChat) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.chatRoomHeader}>
                    <IconButton icon={() => <ArrowLeft size={24} />} onPress={() => setSelectedChat(null)} />
                    <Title style={styles.headerTitle} numberOfLines={1}>{selectedChat?.name || "Loading chat..."}</Title>
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
                            // Professional-grade matching: 
                            // 1. Direct ID match (fastest)
                            // 2. Original message text match (fallback for reliability)
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
                                    {!m.fromMe && <Text style={[styles.msgSender, isHighlight && styles.highlightedMsgSender]}>{m.senderName.split('@')[0]}</Text>}
                                    {m.type === 'ptt' || m.type === 'audio' || (m.body && m.body.startsWith('[Voice Message]')) ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 4 }}>
                                            <Mic size={16} color={m.fromMe ? "#eee" : "#5d10e3"} />
                                            <Text style={[styles.msgText, !m.fromMe && styles.theirMsgText, { fontStyle: 'italic' }]}>Voice Message</Text>
                                        </View>
                                    ) : (
                                        <Text style={[
                                            styles.msgText, 
                                            !m.fromMe && styles.theirMsgText,
                                            isHighlight && styles.highlightedMsgText
                                        ]}>{m.body}</Text>
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
                            style={styles.input}
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

    return (
        <SafeAreaView style={styles.container}>
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
        </SafeAreaView>
    );
};

const Title = ({ children, style, ...props }) => <Text style={[style, { fontSize: 18, fontWeight: 'bold' }]} {...props}>{children}</Text>;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: '#666' },
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
    headerTitle: { flex: 1, marginLeft: 8 },
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
    input: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, maxHeight: 100 },
    sendBtn: { backgroundColor: '#5d10e3', marginLeft: 10 },
});

export default WhatsAppWebScreen;
