import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, SafeAreaView, Linking } from 'react-native';
import { Text, Card, Title, IconButton, Button, Badge } from 'react-native-paper';
import axios from 'axios';
import { MapPin, Clock, Users, Send, CheckCircle2, MessageCircle, XCircle, Trash2, Smartphone } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import io from 'socket.io-client';

import { getBackendUrl, getEffectiveBackendUrl } from '../config'; 

const ConfirmedTripsScreen = () => {
  const [trips, setTrips] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConfirmedTrips = async () => {
    try {
      setRefreshing(true);
      const response = await axios.get(`${getBackendUrl()}/confirmed-trips`);
      setTrips(response.data);
    } catch (error) {
       console.error('Fetch Confirmed Error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const moveTripToManagement = async (id) => {
    try {
      await axios.post(`${getBackendUrl()}/confirmed-trips/${id}/move`);
      fetchConfirmedTrips();
    } catch (error) {
       console.error('Move Error:', error);
    }
  };

  const passTrip = async (id) => {
    try {
      await axios.post(`${getBackendUrl()}/confirmed-trips/${id}/pass`);
      fetchConfirmedTrips();
    } catch (error) {
       console.error('Pass Error:', error);
    }
  };

  const deleteTrip = async (id) => {
    try {
      await axios.delete(`${getBackendUrl()}/confirmed-trips/${id}`);
      fetchConfirmedTrips();
    } catch (error) {
       console.error('Delete Trip Error:', error);
    }
  };

  const deleteHistory = async () => {
    try {
      await axios.delete(`${getBackendUrl()}/confirmed-trips`);
      fetchConfirmedTrips();
    } catch (error) {
       console.error('Delete History Error:', error);
    }
  };

  const navigation = useNavigation();

  useEffect(() => {
    fetchConfirmedTrips();
    
    // Setup Socket.io for instant updates
    const socket = io(getEffectiveBackendUrl(), {
        transports: ['websocket'],
        reconnection: true,
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

  const openChat = (item) => {
    navigation.navigate('WhatsApp', { 
        targetChatId: item.chatId, 
        originalMsg: item.message,
        msgId: item.msgId 
    });
  };

  const renderTrip = ({ item }) => {
    const isPassed = item.status === 'Passed';
    let details = {};
    try {
        details = typeof item.details === 'string' ? JSON.parse(item.details) : (item.details || {});
    } catch (e) {
        details = {};
    }

    const pickup = details.pickup || "Manual Entry";
    const drop = details.drop || "Manual Entry";
    const vehicle = details.vehicle || "Taxi";
    const time = details.time || "Immediate";
    const date = details.date || "Today";
    const customerName = details.customerName || null;
    const customerMobile = details.customerMobile || null;

    return (
    <Card style={[styles.tripCard, isPassed && styles.blockedCard]}>
        {isPassed && (
            <View style={styles.blockedOverlay}>
                <Badge style={styles.passedBadge}>PASSED / DUTY PASS SENT</Badge>
            </View>
        )}
        <View style={styles.cardHeader}>
            <View style={styles.groupBadge}>
                <Users size={16} color={isPassed ? "#888" : "#5d10e3"} />
                <Text style={[styles.groupText, isPassed && styles.blockedText]}>{item.groupName}</Text>
            </View>
            <View style={styles.timeBadge}>
                <Clock size={16} color="#666" />
                <Text style={styles.timeText}>
                    {item.timestamp ? new Date(item.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A'} IST
                </Text>
            </View>
        </View>

        <View style={styles.contentContainer}>
            {/* Structured Trip Details */}
            <View style={styles.detailsBox}>
                <View style={styles.locationRow}>
                    <MapPin size={16} color="#4CAF50" />
                    <Text style={styles.locationText}>{pickup.toUpperCase()} → {drop.toUpperCase()}</Text>
                </View>
                <View style={styles.infoRow}>
                    <View style={styles.infoPill}>
                         <Smartphone size={14} color="#666" />
                         <Text style={styles.pillText}>{vehicle}</Text>
                    </View>
                    <View style={styles.infoPill}>
                         <Clock size={14} color="#666" />
                         <Text style={styles.pillText}>{time}</Text>
                    </View>
                    <View style={styles.infoPill}>
                         <Text style={styles.pillText}>{date}</Text>
                    </View>
                </View>

                {/* Customer Details */}
                {(customerName || customerMobile) && (
                    <View style={styles.customerBox}>
                         <Text style={styles.customerLabel}>CUSTOMER: <Text style={styles.customerValue}>{customerName || 'N/A'}</Text></Text>
                         {customerMobile && <Text style={styles.customerLabel}>MOBILE: <Text style={styles.customerValue}>{customerMobile}</Text></Text>}
                    </View>
                )}
            </View>

            <Text style={[styles.messageText, isPassed && styles.blockedText, {marginTop: 10, fontStyle: 'italic', fontSize: 12, opacity: 0.7}]} numberOfLines={2}>
                "{item.message}"
            </Text>
            
            {!isPassed ? (
                <View style={styles.actionButtonsRow}>
                    <Button 
                        mode="contained" 
                        onPress={() => moveTripToManagement(item.id)}
                        style={styles.moveButton}
                        icon={() => <CheckCircle2 size={16} color="#fff" />}
                    >
                        Success
                    </Button>
                    <Button 
                        mode="outlined" 
                        onPress={() => passTrip(item.id)}
                        style={styles.passButton}
                        textColor="#ff5252"
                        icon={() => <XCircle size={16} color="#ff5252" />}
                    >
                        Duty Pass
                    </Button>
                    <IconButton 
                        icon={() => <MessageCircle size={24} color="#5d10e3" />} 
                        onPress={() => openChat(item)}
                        style={styles.chatIconBtn}
                    />
                    <IconButton 
                        icon={() => <Trash2 size={24} color="#ff5252" />} 
                        onPress={() => deleteTrip(item.id)}
                        style={styles.deleteIconBtn}
                    />
                </View>
            ) : (
                <View style={styles.actionButtonsRow}>
                    <View style={styles.statusBox}>
                        <Text style={styles.statusLabelText}>STATUS:</Text>
                        <Text style={styles.statusValueText}>{item.status.toUpperCase()}</Text>
                    </View>
                    <IconButton 
                        icon={() => <Trash2 size={24} color="#ff5252" />} 
                        onPress={() => deleteTrip(item.id)}
                        style={styles.deleteIconBtn}
                    />
                </View>
            )}
        </View>
    </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
          <View style={{ flex: 1 }}>
              <Title style={styles.headerTitle}>Confirmed Trips</Title>
              <Text style={styles.headerSubtitle}>{trips.length} active duties</Text>
          </View>
          <Button 
            mode="text" 
            onPress={deleteHistory} 
            textColor="#ff5252"
            labelStyle={{ fontWeight: 'bold' }}
          >
            Clear All
          </Button>
      </View>

      <FlatList
        data={trips}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderTrip}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchConfirmedTrips} tintColor="#5d10e3" />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Title style={styles.emptyTitle}>No confirmed trips</Title>
            <Text style={styles.emptySubText}>Move detections from the Home dashboard to see them here.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  headerBar: { padding: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: '#1a1a1a', fontWeight: 'bold', fontSize: 20 },
  headerSubtitle: { color: '#888', fontSize: 11 },
  list: { padding: 16 },
  tripCard: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 16, padding: 16, elevation: 3, borderWidth: 1, borderColor: '#eee', position: 'relative' },
  blockedCard: { 
    backgroundColor: '#f5f5f5', 
    borderColor: '#ddd', 
  },
  blockedOverlay: {
    position: 'absolute',
    top: 55,
    right: 15,
    zIndex: 10,
  },
  passedBadge: {
    backgroundColor: '#ff5252',
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    height: 24,
    paddingHorizontal: 10,
  },
  blockedText: { color: '#888' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  groupBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0e6ff', padding: 8, borderRadius: 10 },
  groupText: { color: '#5d10e3', fontWeight: 'bold', fontSize: 12 },
  timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { color: '#666', fontSize: 11 },
  cardBody: { flexDirection: 'row', gap: 12 },
  iconContainer: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f0e6ff', justifyContent: 'center', alignItems: 'center' },
  contentContainer: { flex: 1 },
  detailsBox: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  locationText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#eee',
  },
  pillText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  customerBox: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  customerLabel: {
    fontSize: 10,
    color: '#888',
    marginBottom: 2,
    fontWeight: 'bold',
  },
  customerValue: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 12,
  },
  messageText: { color: '#333', fontSize: 14, marginBottom: 16 },
  actionButtonsRow: { flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' },
  moveButton: { flex: 2, borderRadius: 10, backgroundColor: '#4CAF50' },
  passButton: { flex: 2, borderRadius: 10, borderColor: '#ff5252' },
  chatIconBtn: { backgroundColor: '#f0e6ff', marginHorizontal: 2 },
  deleteIconBtn: { backgroundColor: '#fff5f5' },
  statusBox: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#ffebee', 
    padding: 10, 
    borderRadius: 8,
    gap: 8
  },
  statusLabelText: { color: '#ff5252', fontSize: 10, fontWeight: 'bold' },
  statusValueText: { color: '#d32f2f', fontSize: 16, fontWeight: '900' },
  emptyContainer: { marginTop: 80, alignItems: 'center', padding: 40 },
  emptyTitle: { color: '#1a1a1a', fontWeight: 'bold' },
  emptySubText: { color: '#888', textAlign: 'center', marginTop: 8 }
});

export default ConfirmedTripsScreen;
