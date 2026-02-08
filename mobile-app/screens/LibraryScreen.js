import { StyleSheet, Text, View, TextInput, FlatList, TouchableOpacity, Modal, Alert, Animated, Platform } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { Swipeable } from 'react-native-gesture-handler';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

const BACKEND_UPLOAD_URL = 'https://listed-transaction-screw-phantom.trycloudflare.com/upload-data';

const INITIAL_LECTURES = [
  { id: '1', title: 'Computer Science Lecture I', date: 'Feb. 4th, 2026', duration: '1 hr 32 mins 24 secs', icon: '💻', color: '#4CBBFF', transcript: 'TBD' },
  { id: '2', title: 'English Lit. Lecture I', date: 'Feb. 4th, 2026', duration: '1 hr 32 mins 24 secs', icon: '📚', color: '#4CBBFF', transcript: 'TBD' },
  { id: '3', title: 'Physics I', date: 'Feb. 3rd, 2026', duration: '2 hr 4 mins 32 secs', icon: '🔬', color: '#4CBBFF', transcript: 'TBD' },
];

export default function LibraryScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [lectures, setLectures] = useState(INITIAL_LECTURES);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [isEditingLecture, setIsEditingLecture] = useState(false);
  const [editingLecture, setEditingLecture] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [uploading, setUploading] = useState(false);
  const audioLevel = useRef(new Animated.Value(0)).current;
  const shapeAnimation = useRef(new Animated.Value(0)).current;
  const waveformHeights = useRef([...Array(30)].map(() => 0.3 + Math.random() * 0.7)).current;

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, [recording]);

  useEffect(() => {
    Animated.timing(shapeAnimation, {
      toValue: isRecording ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isRecording]);

  const uploadFileToServer = async (uri, name) => {
    setUploading(true);
    const formData = new FormData();
    const cleanUri = Platform.OS === 'ios' ? uri.replace('file://', '') : uri;
    formData.append('audio', {
      uri: cleanUri,
      name: name || 'audio.m4a',
      type: 'audio/m4a',
    });
    try {
      const response = await fetch(BACKEND_UPLOAD_URL, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = await response.json();
      if (data.joinCode) {
        return { joinCode: data.joinCode };
      }
      throw new Error('No code returned');
    } catch (error) {
      console.log('Upload Error:', error);
      Alert.alert('Error', 'Server unreachable or file format invalid.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const { uri, name } = result.assets[0];
      const result_1 = await uploadFileToServer(uri, name);
      if (result_1 && result_1.joinCode) {
        const now = new Date();
        const dateText = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', 'th,');
        const newLecture = {
          id: Date.now().toString(),
          title: 'Uploaded from Voice Memos',
          date: dateText,
          duration: '—',
          icon: '📁',
          color: '#4CBBFF',
          transcript: 'Uploaded',
          joinCode: result_1.joinCode,
        };
        setLectures((prev) => [newLecture, ...prev]);
        navigation.navigate('LectureDetail', {
          lecture: newLecture,
          updateDescription: updateLectureDescription,
          openEditLecture: openEditLecture,
        });
      }
    } catch (err) {
      console.log('Picker Error:', err);
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const startRecording = async () => {
    try {
      setIsRecording(true);
      setRecordingStartTime(Date.now());
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Permission to access microphone is required!');
        setIsRecording(false);
        setRecordingStartTime(null);
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      rec.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording && status.metering !== undefined) {
          const normalized = Math.max(0, Math.min(1, (status.metering + 35) / 35));
          Animated.spring(audioLevel, {
            toValue: normalized,
            useNativeDriver: false,
            friction: 3,
            tension: 120,
          }).start();
        }
      });
      setRecording(rec);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording: ' + (err.message || err));
      setIsRecording(false);
      setRecordingStartTime(null);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    const startTime = recordingStartTime || Date.now();
    const uri = recording.getURI();
    setIsRecording(false);
    audioLevel.setValue(0);
    await recording.stopAndUnloadAsync();
    setRecording(null);
    setRecordingStartTime(null);

    const durationMs = Date.now() - startTime;
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const durationText =
      hours > 0
        ? `${hours} hr ${minutes % 60} mins ${seconds % 60} secs`
        : minutes > 0
          ? `${minutes} mins ${seconds % 60} secs`
          : `${seconds} secs`;

    const now = new Date();
    const dateText = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', 'th,');
    const icons = ['🎤', '📝', '🎓', '💭', '📢', '🗣️'];
    const randomIcon = icons[Math.floor(Math.random() * icons.length)];

    const uploadResult = await uploadFileToServer(uri, 'recorded_lecture.m4a');
    const newLecture = {
      id: Date.now().toString(),
      title: `Recording ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
      date: dateText,
      duration: durationText,
      icon: randomIcon,
      color: '#4CBBFF',
      transcript: 'TBD',
      audioUri: uri,
      ...(uploadResult && uploadResult.joinCode ? { joinCode: uploadResult.joinCode } : {}),
    };
    setLectures((prev) => [newLecture, ...prev]);
  };

  const deleteLecture = async (lectureId, audioUri) => {
    Alert.alert(
      'Delete Recording',
      'Are you sure you want to delete this recording?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLectures((prev) => prev.filter((l) => l.id !== lectureId));
            if (audioUri) {
              try {
                const fileInfo = await FileSystem.getInfoAsync(audioUri);
                if (fileInfo.exists) await FileSystem.deleteAsync(audioUri);
              } catch (e) {
                console.error('Error deleting audio file:', e);
              }
            }
          },
        },
      ]
    );
  };

  const updateLectureDescription = (lectureId, description) => {
    setLectures((prev) =>
      prev.map((l) => (l.id === lectureId ? { ...l, description } : l))
    );
  };

  const openEditLecture = (lecture) => {
    setEditingLecture(lecture);
    setEditTitle(lecture.title);
    setEditIcon(lecture.icon);
    setIsEditingLecture(true);
  };

  const saveEditLecture = () => {
    if (editingLecture) {
      setLectures((prev) =>
        prev.map((l) =>
          l.id === editingLecture.id ? { ...l, title: editTitle, icon: editIcon } : l
        )
      );
      setIsEditingLecture(false);
      setEditingLecture(null);
    }
  };

  const emojiOptions = ['💻', '📚', '🔬', '🎤', '📝', '🎓', '💭', '📢', '🗣️', '✏️', '📖', '🪪', '🎨', '🎵', '⚙️', '🚀'];

  const renderRightActions = (progress, dragX, lectureId, audioUri) => (
    <Animated.View style={styles.deleteAction}>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteLecture(lectureId, audioUri)}
        activeOpacity={0.85}
      >
        <Ionicons name="trash-outline" size={22} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );

  const renderLectureItem = ({ item }) => (
    <Swipeable
      renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item.id, item.audioUri)}
      friction={1.2}
      rightThreshold={80}
    >
      <TouchableOpacity
        style={styles.lectureCard}
        onPress={() =>
          navigation.navigate('LectureDetail', {
            lecture: item,
            updateDescription: updateLectureDescription,
            openEditLecture: openEditLecture,
          })
        }
      >
        <View style={styles.lectureIcon}>
          <Text style={styles.iconText}>{item.icon}</Text>
        </View>
        <View style={styles.lectureInfo}>
          <Text style={styles.lectureTitle}>{item.title}</Text>
          <Text style={styles.lectureDate}>{item.date}</Text>
          <Text style={styles.lectureDuration}>{item.duration}</Text>
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={(e) => {
            e.stopPropagation();
            openEditLecture(item);
          }}
        >
          <Ionicons name="create-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Swipeable>
  );

  const filteredLectures = searchQuery
    ? lectures.filter(
        (l) =>
          l.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : lectures;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
      </View>

      <TextInput
        style={styles.searchBar}
        placeholder="Search..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <TouchableOpacity style={styles.uploadLink} onPress={pickDocument} disabled={uploading}>
        <Text style={styles.uploadText}>
          {uploading ? '⏳ Uploading...' : '📁 Upload from Voice Memos'}
        </Text>
      </TouchableOpacity>

      <FlatList
        data={filteredLectures}
        renderItem={renderLectureItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
      />

      <TouchableOpacity style={styles.recordButton} onPress={startRecording} disabled={uploading}>
        <View style={styles.recordButtonInner} />
      </TouchableOpacity>

      <Modal visible={isRecording} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.recordingPanel}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
            <View style={styles.waveformContainer}>
              {[...Array(30)].map((_, i) => {
                const baseHeight = waveformHeights[i];
                const sensitivity = 0.6 + Math.sin(i * 0.5) * 0.4;
                const animatedHeight = audioLevel.interpolate({
                  inputRange: [0, 1],
                  outputRange: [6, 6 + baseHeight * sensitivity * 140],
                  extrapolate: 'clamp',
                });
                return (
                  <Animated.View
                    key={i}
                    style={[styles.waveformBar, { height: animatedHeight, opacity: 0.6 + baseHeight * 0.4 }]}
                  />
                );
              })}
            </View>
            <TouchableOpacity style={styles.stopButton} onPress={stopRecording}>
              <Animated.View
                style={[
                  styles.stopIcon,
                  {
                    borderRadius: shapeAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [25, 4],
                    }),
                  },
                ]}
              />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isEditingLecture} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.editPanel}>
            <Text style={styles.editTitle}>Edit Entry</Text>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.editInput}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Enter title..."
            />
            <Text style={styles.fieldLabel}>Icon</Text>
            <View style={styles.emojiGrid}>
              {emojiOptions.map((emoji, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.emojiOption, editIcon === emoji && styles.emojiOptionSelected]}
                  onPress={() => setEditIcon(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.editButtonRow}>
              <TouchableOpacity
                style={[styles.editActionButton, styles.editCancelButton]}
                onPress={() => {
                  setIsEditingLecture(false);
                  setEditingLecture(null);
                }}
              >
                <Text style={styles.editCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editActionButton, styles.editSaveButton]}
                onPress={saveEditLecture}
              >
                <Text style={styles.editSaveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
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
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#007AFF',
    marginLeft: 10,
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  searchBar: {
    backgroundColor: '#E5E5EA',
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 10,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  uploadLink: {
    alignSelf: 'center',
    marginBottom: 15,
  },
  uploadText: {
    color: '#666',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  deleteButton: {
    backgroundColor: '#E53B34',
    justifyContent: 'center',
    alignItems: 'center',
    height: 44,
    width: 66,
    borderRadius: 22,
  },
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 18,
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FF3B30',
  },
  lectureCard: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lectureIcon: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: { fontSize: 24 },
  lectureInfo: { flex: 1, marginLeft: 15 },
  lectureTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  lectureDate: {
    color: '#fff',
    fontSize: 13,
    opacity: 0.9,
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  lectureDuration: {
    color: '#fff',
    fontSize: 13,
    opacity: 0.9,
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  editButton: { padding: 8 },
  recordButton: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    borderWidth: 4,
    borderColor: '#FF3B30',
  },
  recordButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF3B30',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  recordingPanel: {
    backgroundColor: '#fff',
    paddingVertical: 30,
    paddingHorizontal: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    marginRight: 8,
  },
  liveText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    marginBottom: 30,
    gap: 3,
  },
  waveformBar: {
    width: 3,
    backgroundColor: '#4CBBFF',
    borderRadius: 2,
  },
  stopButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FF3B30',
  },
  stopIcon: {
    width: 30,
    height: 30,
    backgroundColor: '#FF3B30',
    borderRadius: 4,
  },
  editPanel: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  editTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  editInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  emojiOption: {
    width: 50,
    height: 50,
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FF',
  },
  emojiText: { fontSize: 24 },
  editButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  editActionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  editCancelButton: { backgroundColor: '#F2F2F7' },
  editSaveButton: { backgroundColor: '#007AFF' },
  editCancelButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  editSaveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
});
