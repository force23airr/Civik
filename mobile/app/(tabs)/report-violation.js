import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, TextInput
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import client from '../../src/api/client';

const VIOLATION_TYPES = [
  { value: 'running_red_light', label: 'Ran Red Light' },
  { value: 'reckless_driving', label: 'Reckless Driving' },
  { value: 'hit_and_run', label: 'Hit and Run' },
  { value: 'speeding', label: 'Speeding' },
  { value: 'road_rage', label: 'Road Rage' },
  { value: 'illegal_lane_change', label: 'Illegal Lane Change' },
  { value: 'dui_suspected', label: 'Suspected DUI' },
  { value: 'distracted_driving', label: 'Distracted Driving' },
  { value: 'tailgating', label: 'Tailgating' },
  { value: 'wrong_way_driving', label: 'Wrong Way' },
  { value: 'other', label: 'Other' }
];

export default function ReportViolationScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [videoUri, setVideoUri] = useState(null);
  const [mode, setMode] = useState('camera'); // 'camera' | 'form'

  const [violationType, setViolationType] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const startRecording = async () => {
    if (!cameraRef.current) return;
    try {
      setIsRecording(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const video = await cameraRef.current.recordAsync({ maxDuration: 30 });
      setVideoUri(video.uri);
      setMode('form');
    } catch (err) {
      console.log('Recording error:', err);
    } finally {
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    cameraRef.current?.stopRecording();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8
    });
    if (!result.canceled) {
      setVideoUri(result.assets[0].uri);
      setMode('form');
    }
  };

  const handleSubmit = async () => {
    if (!violationType) {
      Alert.alert('Select Violation Type', 'Please select the type of driving violation.');
      return;
    }

    setSubmitting(true);
    try {
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      const formData = new FormData();
      if (videoUri) {
        formData.append('media', {
          uri: videoUri,
          name: 'evidence.mp4',
          type: 'video/mp4'
        });
      }

      formData.append('violationType', violationType);
      formData.append('severity', 'severe');
      formData.append('lat', location.coords.latitude.toString());
      formData.append('lng', location.coords.longitude.toString());
      formData.append('address', `${geo?.streetNumber || ''} ${geo?.street || ''}, ${geo?.city || ''}, ${geo?.region || ''}`.trim());
      formData.append('licensePlate', licensePlate.toUpperCase() || 'UNKNOWN');
      formData.append('plateState', geo?.region?.substring(0, 2).toUpperCase() || 'XX');
      formData.append('description', description || 'Reported via DashGuard mobile app');
      formData.append('incidentDateTime', new Date().toISOString());
      formData.append('tosAccepted', 'true');
      formData.append('certifyTruthful', 'true');

      await client.post('/incidents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
    } catch (err) {
      Alert.alert('Submission Failed', err.response?.data?.error || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={72} color="#22c55e" />
          <Text style={styles.successTitle}>Report Submitted!</Text>
          <Text style={styles.successText}>Your driving violation report has been submitted. Thank you for making roads safer.</Text>
          <TouchableOpacity style={styles.newReportBtn} onPress={() => { setSubmitted(false); setMode('camera'); setVideoUri(null); setViolationType(''); }}>
            <Text style={styles.newReportText}>Report Another</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="videocam-outline" size={64} color="#8b5cf6" />
          <Text style={styles.permTitle}>Camera Access Needed</Text>
          <Text style={styles.permText}>Enable camera to record driving violations.</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Allow Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.galleryFallback} onPress={pickFromGallery}>
            <Text style={styles.galleryFallbackText}>Upload from Gallery</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === 'camera') {
    return (
      <View style={{ flex: 1 }}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} mode="video" facing="back">
          <SafeAreaView style={styles.cameraUI}>
            <View style={styles.cameraHeader}>
              <Text style={styles.cameraTitle}>Record Driving Violation</Text>
              <Text style={styles.cameraHint}>Max 30 seconds</Text>
            </View>

            <View style={styles.cameraFooter}>
              <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery}>
                <Ionicons name="folder-open-outline" size={28} color="#fff" />
                <Text style={styles.galleryBtnText}>Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
                onPress={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? (
                  <View style={styles.stopIcon} />
                ) : (
                  <View style={styles.recordIcon} />
                )}
              </TouchableOpacity>

              <View style={{ width: 60 }} />
            </View>
          </SafeAreaView>
        </CameraView>
      </View>
    );
  }

  // Form mode
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
        <View style={styles.videoConfirm}>
          <Ionicons name="videocam" size={24} color="#8b5cf6" />
          <Text style={styles.videoConfirmText}>{videoUri ? 'Video captured' : 'No video — report only'}</Text>
          <TouchableOpacity onPress={() => setMode('camera')}>
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.formTitle}>Violation Details</Text>

        <Text style={styles.fieldLabel}>Type of Violation *</Text>
        <View style={styles.typeList}>
          {VIOLATION_TYPES.map(t => (
            <TouchableOpacity
              key={t.value}
              style={[styles.typeChip, violationType === t.value && styles.typeChipSelected]}
              onPress={() => setViolationType(t.value)}
            >
              <Text style={[styles.typeChipText, violationType === t.value && styles.typeChipTextSelected]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>License Plate (if visible)</Text>
        <TextInput
          style={styles.input}
          placeholder="ABC 1234"
          placeholderTextColor="#475569"
          value={licensePlate}
          onChangeText={t => setLicensePlate(t.toUpperCase())}
          autoCapitalize="characters"
        />

        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Describe what happened..."
          placeholderTextColor="#475569"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />
      </ScrollView>

      <View style={styles.submitRow}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="send" size={18} color="#fff" />
              <Text style={styles.submitText}>Submit Report</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  cameraUI: { flex: 1, justifyContent: 'space-between' },
  cameraHeader: { padding: 20, alignItems: 'center' },
  cameraTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cameraHint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  cameraFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 48,
    paddingHorizontal: 40
  },
  galleryBtn: { alignItems: 'center' },
  galleryBtnText: { color: '#fff', fontSize: 11, marginTop: 4 },
  recordBtn: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 4, borderColor: '#fff',
    justifyContent: 'center', alignItems: 'center'
  },
  recordBtnActive: { borderColor: '#ef4444' },
  recordIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#ef4444' },
  stopIcon: { width: 28, height: 28, borderRadius: 4, backgroundColor: '#ef4444' },
  form: { flex: 1, padding: 20 },
  videoConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20
  },
  videoConfirmText: { flex: 1, color: '#e2e8f0', fontSize: 14 },
  retakeText: { color: '#8b5cf6', fontSize: 13, fontWeight: '600' },
  formTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  fieldLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  typeList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
    borderColor: '#334155', backgroundColor: '#1e293b'
  },
  typeChipSelected: { borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.15)' },
  typeChipText: { color: '#94a3b8', fontSize: 13 },
  typeChipTextSelected: { color: '#c4b5fd', fontWeight: '600' },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1, borderColor: '#334155',
    borderRadius: 10, padding: 13,
    color: '#e2e8f0', fontSize: 15,
    marginBottom: 16
  },
  textArea: {
    backgroundColor: '#1e293b',
    borderWidth: 1, borderColor: '#334155',
    borderRadius: 10, padding: 13,
    color: '#e2e8f0', fontSize: 14,
    height: 100, textAlignVertical: 'top',
    marginBottom: 16
  },
  submitRow: { padding: 16, borderTopWidth: 1, borderTopColor: '#1e293b' },
  submitBtn: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 8,
    backgroundColor: '#8b5cf6',
    borderRadius: 12, padding: 15
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  permTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 16 },
  permText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  permBtn: { backgroundColor: '#8b5cf6', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  galleryFallback: { marginTop: 16 },
  galleryFallbackText: { color: '#64748b', fontSize: 14, textDecorationLine: 'underline' },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  successTitle: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  successText: { color: '#94a3b8', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  newReportBtn: { backgroundColor: '#8b5cf6', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  newReportText: { color: '#fff', fontWeight: '700', fontSize: 16 }
});
