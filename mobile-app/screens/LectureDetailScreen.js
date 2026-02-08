import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform, TextInput, Keyboard } from 'react-native';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

export default function LectureDetailScreen({ route, navigation }) {
  const { lecture, updateDescription, openEditLecture } = route.params;
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [description, setDescription] = useState(lecture.description || '');
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const togglePlayback = async () => {
    try {
      if (!sound) {
        if (lecture.audioUri) {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
          });

          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: lecture.audioUri },
            { shouldPlay: true }
          );

          newSound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded) {
              setIsPlaying(status.isPlaying);
              if (status.didJustFinish) {
                setSound(null);
                setIsPlaying(false);
              }
            }
          });

          setSound(newSound);
          setIsPlaying(true);
        }
      } else {
        const status = await sound.getStatusAsync();
        if (status.isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const shareCode = lecture.joinCode || lecture.shareCode || '—';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={32} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {
          if (openEditLecture) {
            navigation.goBack();
            setTimeout(() => openEditLecture(lecture), 100);
          }
        }}>
          <Ionicons name="create-outline" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.playSection}>
        <TouchableOpacity
          style={styles.playButton}
          onPress={togglePlayback}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={80}
            color="#fff"
            style={!isPlaying && { marginLeft: 8 }}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.titleSection}>
          <Text style={styles.title}>{lecture.title}</Text>
          <Text style={styles.date}>{lecture.date}</Text>
          <Text style={styles.duration}>{lecture.duration}</Text>
        </View>

        <ScrollView style={styles.scrollableSection} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionLabel}>Description</Text>
          {isEditingDescription ? (
            <View>
              <TextInput
                style={styles.descriptionInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Enter description..."
                multiline
                autoFocus
                textAlignVertical="top"
              />
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() => {
                    setDescription(lecture.description || '');
                    setIsEditingDescription(false);
                    Keyboard.dismiss();
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={() => {
                    if (updateDescription) {
                      updateDescription(lecture.id, description);
                    }
                    setIsEditingDescription(false);
                    Keyboard.dismiss();
                  }}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.descriptionBox}
              onPress={() => setIsEditingDescription(true)}
              activeOpacity={0.7}
            >
              <Text style={description ? styles.descriptionText : styles.placeholderText}>
                {description || 'Click to Set Description...'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={styles.shareCodeSection}>
          <Text style={styles.shareCodeLabel}>PowerPoint Sync Code</Text>
          <Text style={styles.shareCode}>{shareCode}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#007AFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  playSection: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  playButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 5,
  },
  titleSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 25,
    paddingTop: 25,
    paddingBottom: 15,
  },
  scrollableSection: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingVertical: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  descriptionBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  descriptionText: {
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  placeholderText: {
    fontSize: 15,
    color: '#C7C7CC',
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  descriptionInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
    borderWidth: 2,
    borderColor: '#007AFF',
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 10,
  },
  actionButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 5,
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  date: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  duration: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  shareCodeSection: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 30,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  shareCodeLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  shareCode: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#007AFF',
    letterSpacing: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
});
