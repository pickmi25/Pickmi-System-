import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, SafeAreaView, TouchableOpacity, Linking, Alert } from 'react-native';
import { Text, Card, Title, Paragraph, FAB, Badge, IconButton, Button } from 'react-native-paper';
import axios from 'axios';
import { Trash2, Plus, Search, RefreshCw, RefreshCcw, X, MessageCircle, MessageSquare, MoreVertical, Smartphone, Clock, MapPin, Users, Mic, User, Filter, Settings } from 'lucide-react-native';
import AudioMessage from '../components/AudioMessage';
import io from 'socket.io-client';
import { BACKEND_URL } from '../config'; 

const DashboardScreen = ({ navigation }) => {
  const [trips, setTrips] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [status, setStatus] = useState('Checking...');

  const fetchTrips = async () => {
    try {
      setRefreshing(true);
      const response = await axios.get(`${BACKEND_URL}/trips`);
      setTrips(response.data);
      setRefreshing(false);
    } catch (error) {
      console.error('Fetch Trips Error:', error);
      setRefreshing(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/status`);
      setStatus(response.data.status);
    } catch (error) {
      console.error('Fetch Status Error:', error);
      setStatus('Disconnected');
    }
  };

  useEffect(() => {
    fetchTrips();
    fetchStatus();

    // Setup Socket.io
    const socket = io(BACKEND_URL, {
        transports: ['websocket'],
        reconnection: true,
        timeout: 10000 
    });
    
    socket.on('connect', () => console.log('Connected to real-time updates'));
    socket.on('connect_error', (err) => console.log('Socket Connection Error:', err.message));
    
    socket.on('status', (newStatus) => {
        setStatus(newStatus);
    });

    socket.on('trip', (newTrip) => {
        if (newTrip) {
            setTrips(prev => [newTrip, ...prev]);
        }
    });

    socket.on('trip_removed', (data) => {
        if (data && data.msgId) {
            setTrips(prev => prev.filter(t => t.msgId !== data.msgId));
        }
    });

    return () => {
        socket.disconnect();
    };
  }, []);

  const onRefresh = React.useCallback(() => {
    fetchTrips();
  }, []);

  const openInternalChat = (item) => {
    const cleanNumber = item.sender.split('@')[0].replace(/[^0-9]/g, '');
    navigation.navigate('WhatsApp', { 
        targetChatId: `${cleanNumber}@c.us`,
        initialMsg: `Hi ${item.senderName || 'there'}, regarding your trip in ${item.groupName}:\n\n"${item.message.substring(0, 100)}..."`,
        originalMsg: item.message,
        msgId: item.msgId
    });
  };

  const confirmTrip = async (id) => {
    try {
      await axios.post(`${BACKEND_URL}/trips/${id}/confirm`);
      fetchTrips();
    } catch (error) {
       console.error('Confirm Trip Error:', error);
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
        await axios.post(`${BACKEND_URL}/trips/bulk-delete`, { ids: selectedIds });
        setSelectedIds([]);
        setSelectionMode(false);
        fetchTrips();
    } catch (e) {
        console.error("Bulk Delete Error:", e);
    }
  };

  const bulkConvert = async () => {
    if (selectedIds.length === 0) return;
    try {
        await axios.post(`${BACKEND_URL}/trips/bulk-confirm`, { ids: selectedIds });
        setSelectedIds([]);
        setSelectionMode(false);
        fetchTrips();
    } catch (e) {
        console.error("Bulk Convert Error:", e);
    }
  };

  const deleteHistory = async () => {
    try {
      await axios.delete(`${BACKEND_URL}/trips`);
      fetchTrips();
    } catch (error) {
       console.error('Clear History Error:', error);
    }
  };

  const toggleSelection = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

    const renderTrip = ({ item }) => {
    const isSelected = selectedIds.includes(item.id);
    let details = {};
    try {
        details = typeof item.details === 'string' ? JSON.parse(item.details) : (item.details || {});
    } catch (e) {
        details = {};
    }

    // Use flattened fields if available, otherwise fallback to parsed details
    const pickup = item.pickup_location || details.pickup || "Not detected";
    const drop = item.drop_location || details.drop || "Not detected";
    const vehicle = item.vehicle_type || details.vehicle || "Any";
    const date = item.trip_date || details.date || "Today";
    const time = item.trip_time || details.time || "Immediate";
    const tariff = item.total_amount || details.tariff || null;
    const commission = item.commission || details.commission || null;
    const toll = item.toll || details.toll || null;
    const customerName = item.customerName || details.customerName || null;
    const customerMobile = item.customerMobile || details.customerMobile || null;

    return (
    <Card 
        style={[styles.tripCard, isSelected && styles.selectedCard]}
        onLongPress={() => {
            setSelectionMode(true);
            toggleSelection(item.id);
        }}
        onPress={() => selectionMode ? toggleSelection(item.id) : null}
    >
        {selectionMode && (
            <View style={styles.selectionOverlay}>
                <IconButton 
                    icon={isSelected ? "check-circle" : "circle-outline"} 
                    iconColor={isSelected ? "#5d10e3" : "#ccc"} 
                    size={24}
                />
            </View>
        )}
        <View style={styles.cardHeader}>
            <TouchableOpacity 
                style={styles.groupBadge}
                onPress={() => {
                   if (item.chatId) {
                       navigation.navigate('WhatsApp', { targetChatId: item.chatId, originalMsg: item.message, msgId: item.msgId });
                   } else {
                       openInternalChat(item);
                   }
                }}
            >
                <Users size={14} color="#5d10e3" />
                <Text style={styles.groupText} numberOfLines={1}>{item.groupName}</Text>
            </TouchableOpacity>
            <View style={styles.headerRight}>
                <Text style={styles.timeText}>
                    {new Date(item.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </Text>
                {!selectionMode && (
                    <Button 
                        mode="contained" 
                        onPress={() => confirmTrip(item.id)}
                        style={styles.convertHeaderButton}
                        labelStyle={styles.convertLabel}
                    >
                        Convert
                    </Button>
                )}
            </View>
        </View>

        <View style={styles.cardBody}>
            <View style={styles.contentContainer}>
                {/* Raw Message Text (Requested by user) */}
                <View style={styles.rawMessageContainer}>
                    {item.mediaUrl?.includes('audio') ? (
                        <AudioMessage 
                            uri={`${BACKEND_URL}${item.mediaUrl}`} 
                            transcription={item.transcription} 
                        />
                    ) : item.message?.includes('[Voice Message]') ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Mic size={20} color="#5d10e3" />
                            <Text style={[styles.messageText, { color: '#5d10e3', fontStyle: 'italic' }]}>Voice Message Received</Text>
                        </View>
                    ) : (
                        <Text style={styles.messageText}>{item.message}</Text>
                    )}
                </View>

                {/* Important Info Grid */}
                <View style={styles.infoGrid}>
                    <View style={styles.infoItem}>
                        <Smartphone size={14} color="#555" />
                        <Text style={styles.infoValue}>{vehicle}</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Clock size={14} color="#555" />
                        <Text style={styles.infoValue}>{time}</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.infoValue}>{date}</Text>
                    </View>
                </View>

                {/* Price and Commission Row */}
                {(tariff || commission) && (
                    <View style={styles.priceRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={styles.tariffText}>{tariff || "N/A"}</Text>
                            {toll && <Badge style={{ backgroundColor: '#ff9800', color: '#fff' }}>Toll {toll}</Badge>}
                        </View>
                        {commission && (
                            <Badge style={styles.commBadge}>Comm: {commission}</Badge>
                        )}
                    </View>
                )}

                {/* Customer Details */}
                {(customerName || customerMobile) && (
                    <View style={[styles.infoGrid, { marginBottom: 12, backgroundColor: '#f0f0f0', padding: 8, borderRadius: 10 }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 9, color: '#888', fontWeight: 'bold' }}>CUSTOMER</Text>
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#333' }}>{customerName || "No name"}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 9, color: '#888', fontWeight: 'bold' }}>MOBILE</Text>
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#5d10e3' }}>{customerMobile || "No mobile"}</Text>
                        </View>
                    </View>
                )}

                <TouchableOpacity 
                    onPress={() => openInternalChat(item)}
                    style={styles.waChatButton}
                >
                    <MessageSquare size={18} color="#25D366" />
                    <Text style={styles.waChatText}>Reply on WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={() => {}} // Could show full sender info
                    style={styles.senderSection}
                >
                    <View style={styles.senderInfoRow}>
                        <View style={styles.avatarLabel}>
                            <Text style={styles.avatarText}>
                                {(item.senderName || 'U').substring(0, 1).toUpperCase()}
                            </Text>
                        </View>
                        <View>
                            <Text style={styles.senderNameText}>{item.senderName || 'User'}</Text>
                            <Text style={styles.senderNumberText}>
                                +{item.sender.split('@')[0]}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity 
                        style={styles.waBadge}
                        onPress={() => {
                            if (item.chatId) {
                                navigation.navigate('WhatsApp', { targetChatId: item.chatId, originalMsg: item.message, msgId: item.msgId });
                            } else {
                                openInternalChat(item);
                            }
                        }}
                    >
                         <MessageCircle size={12} color="#fff" />
                         <Text style={styles.waBadgeText}>See in Chat</Text>
                    </TouchableOpacity>
                </TouchableOpacity>
            </View>
        </View>
    </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
    <View style={styles.headerBar}>
          <View>
              <View style={styles.titleRow}>
                  <Title style={styles.headerTitle}>Detections</Title>
                  <Badge style={[styles.statusBadge, { backgroundColor: status === 'Connected' ? '#4CAF50' : '#FF9800' }]}>
                      {status}
                  </Badge>
              </View>
              <View style={styles.syncRow}>
                <View style={styles.syncDot} />
                <Text style={styles.headerSubtitle}>
                    {trips.filter(t => {
                        const date = new Date(t.timestamp);
                        const now = new Date();
                        return date.getDate() === now.getDate() && 
                               date.getMonth() === now.getMonth() && 
                               date.getFullYear() === now.getFullYear();
                    }).length} messages found today
                </Text>
              </View>
          </View>
          
          <View style={styles.headerRightButtons}>
            {selectionMode ? (
                <>
                <IconButton icon="close" onPress={() => { setSelectionMode(false); setSelectedIds([]); }} />
                <IconButton icon="trash-can" iconColor="#ff5252" onPress={bulkDelete} />
                <IconButton icon="check-all" iconColor="#5d10e3" onPress={bulkConvert} />
                </>
            ) : (
                <>
                <IconButton 
                    icon={() => <RefreshCcw size={22} color="#5d10e3" />} 
                    onPress={fetchTrips}
                    style={[styles.headerIcon, { backgroundColor: '#f0e6ff' }]}
                />
                <IconButton 
                    icon={() => <Trash2 size={24} color="#ff5252" />} 
                    onPress={() => setSelectionMode(true)}
                    style={styles.deleteIcon}
                />
                <IconButton 
                    icon={() => <Settings size={22} color="#1a1a1a" />} 
                    onPress={() => navigation.navigate('KeywordSettings')}
                    style={styles.headerIcon}
                />
                <IconButton 
                    icon={() => <Filter size={22} color="#1a1a1a" />} 
                    onPress={() => navigation.navigate('ChatSelection')}
                    style={styles.headerIcon}
                />
                </>
            )}
          </View>
      </View>

      <FlatList
        data={trips}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderTrip}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchTrips} tintColor="#5d10e3" />
        }
        contentContainerStyle={styles.list}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Title style={styles.emptyTitle}>No trips found yet</Title>
            <Text style={styles.emptySubText}>I'm scanning your WhatsApp groups for trip details based on your keywords...</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  headerTitle: {
    color: '#1a1a1a',
    fontSize: 22,
    fontWeight: 'bold',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  headerSubtitle: {
    color: '#888',
    fontSize: 12,
  },
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
  },
  headerIcon: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
  },
  deleteIcon: {
    backgroundColor: '#ffebee',
    borderRadius: 12,
  },
  list: {
    padding: 16,
    paddingBottom: 20,
  },
  tripCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginBottom: 16,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    position: 'relative',
  },
  selectedCard: {
    borderColor: '#5d10e3',
    backgroundColor: '#fbf9ff',
    borderWidth: 2,
  },
  selectionOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0e6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 10,
  },
  groupText: {
    color: '#5d10e3',
    fontWeight: 'bold',
    fontSize: 12,
  },
  seeInChatText: {
    color: '#5d10e3',
    fontSize: 10,
    marginLeft: 4,
    opacity: 0.7,
  },
  headerRight: {
     flexDirection: 'row',
     alignItems: 'center',
     gap: 8,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    color: '#888',
    fontSize: 12,
  },
  sendIcon: {
     backgroundColor: '#25D36620',
     borderRadius: 10,
     margin: 0,
  },
  cardBody: {
    flexDirection: 'row',
    gap: 16,
  },
  contentContainer: {
    flex: 1,
  },
  detailsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
  },
  priorityBadge: {
    backgroundColor: '#fff1f0',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ffa39e',
  },
  priorityText: {
    color: '#cf1322',
    fontSize: 10,
    fontWeight: 'bold',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  routePoint: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 9,
    color: '#888',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  routeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  routeLine: {
    width: 20,
    height: 1,
    backgroundColor: '#ddd',
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  infoValue: {
    fontSize: 12,
    color: '#444',
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0e6ff',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  tariffText: {
    color: '#5d10e3',
    fontWeight: 'bold',
    fontSize: 13,
  },
  commBadge: {
    backgroundColor: '#5d10e3',
    color: '#fff',
  },
  rawMessageToggle: {
    borderLeftWidth: 3,
    borderLeftColor: '#f0f0f0',
    paddingLeft: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  rawText: {
    fontSize: 12,
    color: '#aaa',
    fontStyle: 'italic',
  },
  senderSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    marginTop: 8,
  },
  senderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarLabel: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0e6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#5d10e3',
    fontWeight: 'bold',
    fontSize: 14,
  },
  senderNameText: {
    color: '#1a1a1a',
    fontSize: 13,
    fontWeight: 'bold',
  },
  senderNumberText: {
    color: '#888',
    fontSize: 11,
  },
  waBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#25D366',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  waBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    marginTop: 8,
  },
  convertButton: {
    flex: 2,
    borderRadius: 12,
    backgroundColor: '#5d10e3',
  },
  convertHeaderButton: {
    borderRadius: 8,
    backgroundColor: '#5d10e3',
    paddingHorizontal: 0,
    marginRight: 4,
  },
  convertLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
    marginHorizontal: 8,
  },
  waChatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D36615',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#25D36630',
  },
  waChatText: {
    color: '#128C7E',
    fontWeight: 'bold',
    fontSize: 14,
  },
  rawMessageContainer: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    marginBottom: 16,
  },
  messageText: {
    color: '#333',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  emptyContainer: {
    marginTop: 100,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#1a1a1a',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  emptySubText: {
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default DashboardScreen;
