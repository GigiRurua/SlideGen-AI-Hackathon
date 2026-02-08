// VERSION 2.0 - TESTING SYNC
// Workspace: Notes for AI, unified playback (recorded + picked), manual Generate Slides
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import Slider from '@react-native-community/slider';
import { BACKEND_URL } from '../config';

const SEEK_STEP_MS = 10000; // 10 seconds
const POLL_INTERVAL_MS = 2000;
const STATUS_LABELS = {
  transcribing: 'Transcribing audio...',
  architecting: 'AI is designing slides...',
  generating_code: 'Building presentation...',
  ready: 'Done!',
  error: 'Something went wrong',
};

function formatTime(ms) {
  if (ms == null || isNaN(ms)) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function RecordingScreen({ navigation }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [currentAudioUri, setCurrentAudioUri] = useState(null);
  const [notes, setNotes] = useState('');
  const [sound, setSound] = useState(null);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [joinCode, setJoinCode] = useState(null);
  const [pollStatus, setPollStatus] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const pollTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (recording) recording.stopAndUnloadAsync();
    };
  }, [recording]);

  useEffect(() => {
    return () => {
      if (sound) sound.unloadAsync();
    };
  }, [sound]);

  useEffect(() => {
    if (!sound) return;
    const interval = setInterval(async () => {
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          setPositionMs(status.positionMillis);
          setDurationMs(status.durationMillis ?? 0);
          setIsPlaying(status.isPlaying);
        }
      } catch (_) {}
    }, 500);
    return () => clearInterval(interval);
  }, [sound]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const ensurePlayableUri = (uri) => {
    if (!uri) return null;
    if (Platform.OS === 'ios' && !uri.startsWith('file://') && !uri.startsWith('content://')) {
      return uri.startsWith('/') ? `file://${uri}` : uri;
    }
    return uri;
  };

  const loadSound = async (uri) => {
    const playableUri = ensurePlayableUri(uri);
    if (!playableUri) return;
    try {
      if (sound) await sound.unloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: playableUri },
        { progressUpdateIntervalMillis: 500 }
      );
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setPositionMs(status.positionMillis);
          setDurationMs(status.durationMillis ?? 0);
          setIsPlaying(status.isPlaying);
        }
      });
      setSound(newSound);
      setPositionMs(0);
      const status = await newSound.getStatusAsync();
      if (status.isLoaded) setDurationMs(status.durationMillis ?? 0);
    } catch (e) {
      console.warn('Load sound failed:', e);
      if (Platform.OS === 'ios') {
        const cacheUri = `${FileSystem.cacheDirectory}${(uri.split('/').pop() || 'audio').replace(/\?.*$/, '')}`;
        try {
          await FileSystem.copyAsync({ from: uri.replace('file://', ''), to: cacheUri });
          await loadSound(cacheUri);
        } catch (copyErr) {
          console.warn('Copy to cache failed:', copyErr);
        }
      }
    }
  };

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setIsRecording(true);
      setCurrentAudioUri(null);
    } catch (err) {
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    const uri = recording.getURI();
    await recording.stopAndUnloadAsync();
    setRecording(null);
    if (uri) {
      setCurrentAudioUri(uri);
      await loadSound(uri);
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const { uri } = result.assets[0];
      const uriToUse = Platform.OS === 'ios' ? (uri.startsWith('file://') ? uri : `file://${uri}`) : uri;
      setCurrentAudioUri(uriToUse);
      await loadSound(uriToUse);
    } catch (err) {
      Alert.alert('Error', 'Could not pick file.');
    }
  };

  const togglePlayPause = async () => {
    if (!sound) return;
    const status = await sound.getStatusAsync();
    if (status.isLoaded) {
      if (status.isPlaying) await sound.pauseAsync();
      else await sound.playAsync();
    }
  };

  const seekBy = async (deltaMs) => {
    if (!sound) return;
    const status = await sound.getStatusAsync();
    if (!status.isLoaded) return;
    const newPos = Math.max(0, Math.min((status.durationMillis ?? 0), status.positionMillis + deltaMs));
    await sound.setPositionAsync(newPos);
    setPositionMs(newPos);
  };

  const seekTo = async (value) => {
    if (!sound) return;
    const ms = Math.round(value);
    await sound.setPositionAsync(ms);
    setPositionMs(ms);
  };

  const canGenerate = !!currentAudioUri && !isRecording && !isGenerating;

  const onGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setJoinCode(null);
    setPollStatus(null);
    try {
      const formData = new FormData();
      const uri = Platform.OS === 'ios' ? currentAudioUri.replace('file://', '') : currentAudioUri;
      formData.append('audio', {
        uri,
        type: 'audio/m4a',
        name: 'lecture.m4a',
      });
      formData.append('notes', notes);

      const response = await fetch(`${BACKEND_URL}/upload-data`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.joinCode) {
        throw new Error(data.error || `Server error ${response.status}`);
      }
      setJoinCode(data.joinCode);
      pollStatusEndpoint(data.joinCode);
    } catch (err) {
      Alert.alert('Upload failed', err.message || 'Server unreachable.');
      setIsGenerating(false);
    }
  };

  const pollStatusEndpoint = (code) => {
    const poll = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/status/${code}`);
        const data = await res.json().catch(() => ({}));
        setPollStatus({
          ready: data.ready,
          status: data.status,
          percent: data.percent ?? 0,
        });
        if (data.ready) {
          if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
          setIsGenerating(false);
          setShowSuccess(true);
          return;
        }
        if (data.status === 'error') {
          if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
          setIsGenerating(false);
          Alert.alert('Generation failed', 'Something went wrong on the server.');
          return;
        }
      } catch (_) {}
      pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    };
    poll();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#4CBBFF" />
        </TouchableOpacity>
        <Ionicons name="mic" size={28} color="#4CBBFF" />
        <Text style={styles.headerTitle}>Recording</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.workspace}>
          <Text style={styles.workspaceTitle}>Workspace</Text>

          <Text style={styles.label}>Notes for AI</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Optional: Add context, style, or key points for the AI..."
            placeholderTextColor="#999"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          {currentAudioUri ? (
            <View style={styles.playbackSection}>
              <Text style={styles.label}>Playback</Text>
              <View style={styles.seekRow}>
                <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={durationMs || 1}
                  value={positionMs}
                  onSlidingComplete={(v) => seekTo(v)}
                  minimumTrackTintColor="#4CBBFF"
                  maximumTrackTintColor="#ddd"
                  thumbTintColor="#4CBBFF"
                />
                <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
              </View>
              <View style={styles.playbackControls}>
                <TouchableOpacity style={styles.playbackBtn} onPress={() => seekBy(-SEEK_STEP_MS)}>
                  <Ionicons name="play-skip-back" size={32} color="#4CBBFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.playPauseBtn} onPress={togglePlayPause}>
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={40} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.playbackBtn} onPress={() => seekBy(SEEK_STEP_MS)}>
                  <Ionicons name="play-skip-forward" size={32} color="#4CBBFF" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.placeholderText}>Record or pick a file to get started.</Text>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.recordButton, isRecording && styles.recordingActive]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={isGenerating}
          >
            {isRecording ? (
              <View style={styles.stopIcon} />
            ) : (
              <Ionicons name="mic" size={36} color="#FF3B30" />
            )}
          </TouchableOpacity>
          <Text style={styles.recordLabel}>{isRecording ? 'Stop' : 'Record'}</Text>

          <TouchableOpacity style={styles.pickButton} onPress={pickFile} disabled={isGenerating}>
            <Ionicons name="folder-open" size={24} color="#4CBBFF" />
            <Text style={styles.pickButtonText}>Pick from library</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.generateButton, canGenerate && styles.generateButtonActive]}
            onPress={onGenerate}
            disabled={!canGenerate}
          >
            <Text style={styles.generateButtonText}>Generate Slides</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={isGenerating && joinCode != null} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.progressCard}>
            <ActivityIndicator size="large" color="#4CBBFF" />
            <Text style={styles.progressTitle}>
              {pollStatus ? STATUS_LABELS[pollStatus.status] || pollStatus.status : 'Starting...'}
            </Text>
            <Text style={styles.progressPercent}>{pollStatus?.percent ?? 0}%</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${pollStatus?.percent ?? 0}%` }]} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.successCard}>
            <View style={styles.successCheck}>
              <Ionicons name="checkmark" size={48} color="#fff" />
            </View>
            <Text style={styles.successTitle}>Success!</Text>
            <Text style={styles.successCode}>{joinCode}</Text>
            <Text style={styles.successHint}>Enter this code in the PowerPoint add-in to download your presentation.</Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => {
                setShowSuccess(false);
                setJoinCode(null);
                setPollStatus(null);
              }}
            >
              <Text style={styles.successButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingTop: Platform.OS === 'ios' ? 56 : 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  backButton: {
    marginRight: 8,
    padding: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#4CBBFF',
    marginLeft: 10,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  workspace: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  workspaceTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#000',
    minHeight: 88,
    textAlignVertical: 'top',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  playbackSection: { marginTop: 8 },
  seekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeText: {
    fontSize: 12,
    color: '#8E8E93',
    width: 40,
    textAlign: 'center',
  },
  slider: { flex: 1, height: 40 },
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  playbackBtn: { padding: 8 },
  playPauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4CBBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 15,
    color: '#8E8E93',
    fontStyle: 'italic',
    marginTop: 8,
  },
  actions: {
    alignItems: 'center',
    gap: 12,
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FF3B30',
  },
  recordingActive: { backgroundColor: '#FF3B30' },
  stopIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  recordLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  pickButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CBBFF',
  },
  generateButton: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 14,
    backgroundColor: '#C7C7CC',
    alignItems: 'center',
    marginTop: 12,
  },
  generateButtonActive: {
    backgroundColor: '#4CBBFF',
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 16,
  },
  progressPercent: {
    fontSize: 28,
    fontWeight: '700',
    color: '#4CBBFF',
    marginTop: 8,
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CBBFF',
    borderRadius: 4,
  },
  successCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  successCheck: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 20,
  },
  successCode: {
    fontSize: 42,
    fontWeight: '800',
    color: '#4CBBFF',
    letterSpacing: 8,
    marginTop: 12,
  },
  successHint: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  successButton: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: '#4CBBFF',
    borderRadius: 12,
  },
  successButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
});
