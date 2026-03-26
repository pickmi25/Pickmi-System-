import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, IconButton, ProgressBar } from 'react-native-paper';
import { Audio } from 'expo-av';
import { Play, Pause, Mic } from 'lucide-react-native';

const AudioMessage = ({ uri, transcription, isDark = false }) => {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setDuration(status.durationMillis);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
        sound.setPositionAsync(0);
      }
    }
  };

  const playPause = async () => {
    if (sound === null) {
      setLoading(true);
      try {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: uri },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        setSound(newSound);
        setIsPlaying(true);
      } catch (error) {
        console.error('Error loading sound', error);
      }
      setLoading(false);
    } else {
      if (isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        await sound.playAsync();
        setIsPlaying(true);
      }
    }
  };

  const getProgress = () => {
    if (duration > 0) return position / duration;
    return 0;
  };

  const formatTime = (millis) => {
    const totalSeconds = millis / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      {transcription ? (
        <View style={styles.transcriptionBox}>
          <View style={styles.transcriptionHeader}>
             <Mic size={14} color="#5d10e3" />
             <Text style={styles.transcriptionTitle}>Transcription</Text>
          </View>
          <Text style={styles.transcriptionText}>{transcription}</Text>
        </View>
      ) : (
        <View style={styles.voiceHeader}>
            <Mic size={16} color="#5810e3" />
            <Text style={styles.voiceTitle}>Voice Message</Text>
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity style={styles.playButton} onPress={playPause} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            isPlaying ? <Pause size={20} color="#fff" /> : <Play size={20} color="#fff" fill="#fff" />
          )}
        </TouchableOpacity>
        
        <View style={styles.progressContainer}>
          <ProgressBar progress={getProgress()} color="#5d10e3" style={styles.progressBar} />
          <View style={styles.timeInfo}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Text style={styles.timeText}>{formatTime(duration || 0)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f4ff',
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e0d5f5',
  },
  darkContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  voiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  voiceTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#5d10e3',
  },
  transcriptionBox: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#5d10e3',
  },
  transcriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  transcriptionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#5d10e3',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transcriptionText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5d10e3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  progressContainer: {
    flex: 1,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e0d5f5',
  },
  timeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
    color: '#888',
  },
});

export default AudioMessage;
