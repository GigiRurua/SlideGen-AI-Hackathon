import { StyleSheet, Text, View, TextInput, FlatList, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

const MOCK_LECTURES = [
  { id: '1', title: 'Computer Science Lecture I', date: 'Feb. 4th, 2026', duration: '1 hr 32 mins 24 secs', icon: '💻' },
  { id: '2', title: 'English Lit. Lecture I', date: 'Feb. 4th, 2026', duration: '1 hr 32 mins 24 secs', icon: '📚' },
  { id: '3', title: 'Physics I', date: 'Feb. 3rd, 2026', duration: '2 hr 4 mins 32 secs', icon: '🔬' },
];

export default function RecordingScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, [recording]);

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    if (recording) {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      console.log('Recording stopped and stored at', uri);
    }
  };

  const renderLectureItem = ({ item }) => (
    <TouchableOpacity
      style={styles.lectureCard}
      onPress={() => navigation.navigate('LectureDetail', { lecture: item })}
    >
      <View style={styles.lectureIcon}>
        <Text style={styles.iconText}>{item.icon}</Text>
      </View>
      <View style={styles.lectureInfo}>
        <Text style={styles.lectureTitle}>{item.title}</Text>
        <Text style={styles.lectureDate}>{item.date}</Text>
        <Text style={styles.lectureDuration}>{item.duration}</Text>
      </View>
      <TouchableOpacity style={styles.editButton}>
        <Ionicons name="create-outline" size={24} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Ionicons name="menu" size={28} color="#4CBBFF" />
        <Text style={styles.headerTitle}>Library</Text>
      </View>

      <TextInput
        style={styles.searchBar}
        placeholder="Search..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <FlatList
        data={MOCK_LECTURES}
        renderItem={renderLectureItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
      />

      <View style={styles.recordingPanel}>
        {isRecording && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        )}
        {isRecording && (
          <View style={styles.waveformContainer}>
            {[...Array(30)].map((_, i) => (
              <View key={i} style={[styles.waveformBar, { height: Math.random() * 40 + 10 }]} />
            ))}
          </View>
        )}
        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.recordingActive]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          {isRecording ? (
            <View style={styles.stopIcon} />
          ) : (
            <View style={styles.recordIcon} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E5E5E5',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CBBFF',
    marginLeft: 10,
  },
  searchBar: {
    backgroundColor: '#D0D0D0',
    marginHorizontal: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  lectureCard: {
    backgroundColor: '#4CBBFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lectureIcon: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 24,
  },
  lectureInfo: {
    flex: 1,
    marginLeft: 15,
  },
  lectureTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  lectureDate: {
    color: '#fff',
    fontSize: 13,
    opacity: 0.9,
  },
  lectureDuration: {
    color: '#fff',
    fontSize: 13,
    opacity: 0.9,
  },
  editButton: {
    padding: 8,
  },
  recordingPanel: {
    backgroundColor: '#fff',
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
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
  recordButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FF3B30',
  },
  recordingActive: {
    backgroundColor: '#FF3B30',
  },
  recordIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF3B30',
  },
  stopIcon: {
    width: 30,
    height: 30,
    backgroundColor: '#fff',
    borderRadius: 4,
  },
});
