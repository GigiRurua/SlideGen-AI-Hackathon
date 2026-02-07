import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Platform, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';

export default function App() {
  const [recording, setRecording] = useState();
  const [sound, setSound] = useState(); 
  const [loading, setLoading] = useState(false);
  const [joinCode, setJoinCode] = useState(null);
  const [lastRecordingUri, setLastRecordingUri] = useState(null);

  useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  async function startRecording() {
    try {
      setJoinCode(null);
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'We need microphone access to record.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
    } catch (err) { Alert.alert('Error', 'Failed to start recording'); }
  }

  async function playLastRecording() {
    if (!lastRecordingUri) return;
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: lastRecordingUri });
      setSound(sound);
      await sound.playAsync();
    } catch (err) { Alert.alert('Error', 'Could not play back audio'); }
  }

  // FIXED: Removed the reference to 'recordingUri' and used the passed 'uri'
  const uploadFileToServer = async (uri, name) => {
    setLoading(true);
    const formData = new FormData();
    
    // Formatting the URI for the server (especially for iOS)
    const cleanUri = Platform.OS === 'ios' ? uri.replace('file://', '') : uri;

    formData.append('audio', {
      uri: cleanUri,
      name: name || 'audio.m4a',
      type: 'audio/m4a',
    });

    try {
      const response = await fetch('https://listed-transaction-screw-phantom.trycloudflare.com/upload-data', {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const data = await response.json();
      if (data.joinCode) {
        setJoinCode(data.joinCode);
      } else {
        throw new Error("No code returned");
      }
    } catch (error) {
      console.log("Upload Error:", error);
      Alert.alert("Error", "Server unreachable or file format invalid.");
    } finally {
      setLoading(false);
    }
  };

  async function stopAndSend() {
    try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setLastRecordingUri(uri);
        setRecording(undefined);
        await uploadFileToServer(uri, 'recorded_lecture.m4a');
    } catch (err) {
        Alert.alert("Error", "Could not stop recording.");
    }
  }

  async function pickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ 
        type: 'audio/*',
        copyToCacheDirectory: true 
      });

      if (!result.canceled) {
        const { uri, name } = result.assets[0];
        console.log("Picked file:", uri);
        await uploadFileToServer(uri, name);
      }
    } catch (err) { 
        console.log("Picker Error:", err);
        Alert.alert('Error', 'Failed to pick file'); 
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SlideGen AI</Text>
      
      <TouchableOpacity 
        style={[styles.button, recording ? styles.stopBtn : styles.startBtn]} 
        onPress={recording ? stopAndSend : startRecording}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
            {loading ? "Processing..." : (recording ? "✨ Generate Slides" : "🎙️ Record Lecture")}
        </Text>
      </TouchableOpacity>

      {!recording && lastRecordingUri && !loading && (
        <TouchableOpacity style={styles.secondaryButton} onPress={playLastRecording}>
          <Text style={styles.secondaryText}>▶️ Listen Back</Text>
        </TouchableOpacity>
      )}

      {!recording && !loading && (
        <TouchableOpacity style={styles.uploadLink} onPress={pickDocument}>
          <Text style={styles.uploadText}>📁 Upload from Voice Memos</Text>
        </TouchableOpacity>
      )}

      {loading && <ActivityIndicator size="large" color="#007AFF" style={{marginTop: 30}} />}

      {joinCode && !loading && (
        <View style={styles.codeContainer}>
          <Text style={styles.codeLabel}>PowerPoint Sync Code:</Text>
          <Text style={styles.code}>{joinCode}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 32, fontWeight: '800', color: '#1A1A1A', marginBottom: 60 },
  button: { paddingVertical: 20, paddingHorizontal: 40, borderRadius: 100, width: '90%', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 },
  startBtn: { backgroundColor: '#007AFF' },
  stopBtn: { backgroundColor: '#FF3B30' },
  buttonText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  secondaryButton: { marginTop: 20, padding: 15 },
  secondaryText: { color: '#007AFF', fontSize: 18, fontWeight: '600' },
  uploadLink: { marginTop: 40 },
  uploadText: { color: '#666', fontSize: 16, textDecorationLine: 'underline' },
  codeContainer: { marginTop: 50, padding: 30, backgroundColor: 'white', borderRadius: 20, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#E1E4E8' },
  codeLabel: { fontSize: 14, color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  code: { fontSize: 56, fontWeight: '900', color: '#007AFF', letterSpacing: 8, marginTop: 10 }
});