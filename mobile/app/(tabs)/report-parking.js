import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
  Image, TextInput, ActivityIndicator, Modal, FlatList, Platform
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import client from '../../src/api/client';

const VIOLATION_TYPES = [
  { value: 'fire_hydrant', label: 'Fire Hydrant', icon: '🚒', bounty: '$5.00' },
  { value: 'handicap_zone', label: 'Handicap Zone', icon: '♿', bounty: '$7.50' },
  { value: 'fire_lane', label: 'Fire Lane', icon: '🔥', bounty: '$7.50' },
  { value: 'blocking_driveway', label: 'Blocking Driveway', icon: '🚗', bounty: '$4.00' },
  { value: 'blocking_crosswalk', label: 'Blocking Crosswalk', icon: '🚶', bounty: '$5.00' },
  { value: 'double_parked', label: 'Double Parked', icon: '🚦', bounty: '$3.00' },
  { value: 'no_parking_zone', label: 'No Parking', icon: '🚫', bounty: '$2.50' },
  { value: 'bus_stop', label: 'Bus Stop', icon: '🚌', bounty: '$4.00' },
  { value: 'blocking_bike_lane', label: 'Bike Lane', icon: '🚲', bounty: '$3.00' },
  { value: 'blocking_sidewalk', label: 'Sidewalk', icon: '🚶‍♂️', bounty: '$3.00' },
  { value: 'expired_meter', label: 'Expired Meter', icon: '⏱️', bounty: '$1.00' },
  { value: 'red_curb', label: 'Red Curb', icon: '🔴', bounty: '$2.50' },
  { value: 'abandoned_vehicle', label: 'Abandoned', icon: '🏚️', bounty: '$5.00' },
  { value: 'other', label: 'Other', icon: '⚠️', bounty: '$2.00' }
];

const STEPS = ['Photo', 'Violation', 'Vehicle', 'Submit'];

export default function ReportParkingScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState(null);
  const cameraRef = useRef(null);

  // Step control
  const [step, setStep] = useState(0); // 0=camera, 1=violation, 2=vehicle, 3=review

  // Photo
  const [photos, setPhotos] = useState([]);
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraFacing, setCameraFacing] = useState('back');

  // Location
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [nearestStation, setNearestStation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Form
  const [violationType, setViolationType] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [color, setColor] = useState('');
  const [make, setMake] = useState('');
  const [description, setDescription] = useState('');

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === 'granted');
    if (status === 'granted') {
      detectLocation();
    }
  };

  const detectLocation = async () => {
    setLocationLoading(true);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });

      // Reverse geocode
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude
      });
      if (geo) {
        setAddress(`${geo.streetNumber || ''} ${geo.street || ''}, ${geo.city || ''}, ${geo.region || ''} ${geo.postalCode || ''}`.trim());
      }

      // Find nearest station
      const stationRes = await client.get(`/parking-violations/nearest-station?lat=${loc.coords.latitude}&lng=${loc.coords.longitude}`);
      if (stationRes.data.station) {
        setNearestStation(stationRes.data.station);
      }
    } catch (err) {
      console.log('Location error:', err.message);
    } finally {
      setLocationLoading(false);
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current || photos.length >= 5) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: false });
      setPhotos(prev => [...prev, photo]);
      setCameraActive(false);
      setStep(1);
    } catch (err) {
      Alert.alert('Camera Error', 'Failed to take photo. Please try again.');
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5 - photos.length,
      quality: 0.8
    });

    if (!result.canceled) {
      setPhotos(prev => [...prev, ...result.assets]);
      setCameraActive(false);
      if (step === 0) setStep(1);
    }
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    if (photos.length === 1) {
      setCameraActive(true);
      setStep(0);
    }
  };

  const handleSubmit = async () => {
    if (photos.length === 0) {
      Alert.alert('Photo Required', 'Please take at least one photo of the violation.');
      return;
    }
    if (!violationType) {
      Alert.alert('Violation Type Required', 'Please select the type of parking violation.');
      return;
    }
    if (!location) {
      Alert.alert('Location Required', 'Unable to get your location. Please enable GPS.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      photos.forEach((photo, i) => {
        formData.append('photos', {
          uri: photo.uri,
          name: `evidence_${i}.jpg`,
          type: 'image/jpeg'
        });
      });

      formData.append('violationType', violationType);
      formData.append('severity', getSeverity(violationType));
      formData.append('lat', location.lat.toString());
      formData.append('lng', location.lng.toString());
      formData.append('address', address);
      if (licensePlate) formData.append('licensePlate', licensePlate.toUpperCase());
      if (color) formData.append('color', color);
      if (make) formData.append('make', make);
      if (description) formData.append('description', description);

      const res = await client.post('/parking-violations', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(res.data);
    } catch (err) {
      Alert.alert('Submission Failed', err.response?.data?.error || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setPhotos([]);
    setViolationType('');
    setLicensePlate('');
    setColor('');
    setMake('');
    setDescription('');
    setStep(0);
    setCameraActive(true);
    setSubmitted(null);
    detectLocation();
  };

  const getSeverity = (type) => {
    const critical = ['handicap_zone', 'fire_lane'];
    const severe = ['fire_hydrant', 'blocking_driveway', 'blocking_crosswalk', 'abandoned_vehicle'];
    if (critical.includes(type)) return 'critical';
    if (severe.includes(type)) return 'severe';
    return 'moderate';
  };

  const selectedViolation = VIOLATION_TYPES.find(v => v.value === violationType);

  // ─── Success Screen ───────────────────────────────────────────────────────
  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={40} color="#fff" />
          </View>
          <Text style={styles.successTitle}>Report Submitted!</Text>
          <Text style={styles.successNumber}>{submitted.reportNumber}</Text>

          {submitted.assignedStation && (
            <View style={styles.successStation}>
              <Ionicons name="business-outline" size={16} color="#93c5fd" />
              <Text style={styles.successStationText}>
                Sent to {submitted.assignedStation.name}
              </Text>
            </View>
          )}

          <View style={styles.bountyCard}>
            <Ionicons name="cash-outline" size={24} color="#22c55e" />
            <Text style={styles.bountyCardTitle}>Potential Reward</Text>
            <Text style={styles.bountyCardText}>
              You'll earn a bounty if the police approve your report!
            </Text>
          </View>

          <TouchableOpacity style={styles.reportAnotherBtn} onPress={resetForm}>
            <Text style={styles.reportAnotherText}>Report Another Violation</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Step Progress ────────────────────────────────────────────────────────
  const renderStepBar = () => (
    <View style={styles.stepBar}>
      {STEPS.map((s, i) => (
        <View key={s} style={styles.stepItem}>
          <View style={[styles.stepDot, i <= step && styles.stepDotActive, i < step && styles.stepDotDone]}>
            {i < step ? (
              <Ionicons name="checkmark" size={12} color="#fff" />
            ) : (
              <Text style={[styles.stepNum, i === step && styles.stepNumActive]}>{i + 1}</Text>
            )}
          </View>
          <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>{s}</Text>
        </View>
      ))}
    </View>
  );

  // ─── Step 0: Camera ───────────────────────────────────────────────────────
  if (step === 0) {
    if (!cameraPermission?.granted) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={64} color="#3b82f6" />
            <Text style={styles.permissionTitle}>Camera Access Needed</Text>
            <Text style={styles.permissionText}>
              Civik needs your camera to capture parking violations.
            </Text>
            <TouchableOpacity style={styles.permissionBtn} onPress={requestCameraPermission}>
              <Text style={styles.permissionBtnText}>Allow Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.galleryAltBtn} onPress={pickFromGallery}>
              <Text style={styles.galleryAltText}>Choose from Gallery Instead</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={cameraFacing}>
          {/* Top overlay */}
          <SafeAreaView style={styles.cameraTop}>
            <View style={styles.cameraTopRow}>
              <View style={styles.locationBadge}>
                {locationLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="location" size={14} color={location ? '#22c55e' : '#f59e0b'} />
                )}
                <Text style={styles.locationBadgeText} numberOfLines={1}>
                  {location ? (nearestStation ? nearestStation.name : 'GPS found') : 'Getting location...'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.flipBtn}
                onPress={() => setCameraFacing(f => f === 'back' ? 'front' : 'back')}
              >
                <Ionicons name="camera-reverse-outline" size={26} color="#fff" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Crosshair guide */}
          <View style={styles.crosshairContainer}>
            <View style={styles.crosshairCornerTL} />
            <View style={styles.crosshairCornerTR} />
            <View style={styles.crosshairCornerBL} />
            <View style={styles.crosshairCornerBR} />
          </View>

          {/* Bottom controls */}
          <View style={styles.cameraBottom}>
            <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery}>
              <Ionicons name="images-outline" size={28} color="#fff" />
              <Text style={styles.galleryBtnText}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.captureBtn} onPress={takePicture} activeOpacity={0.8}>
              <View style={styles.captureBtnInner} />
            </TouchableOpacity>

            <View style={styles.photoCount}>
              <Text style={styles.photoCountText}>{photos.length}/5</Text>
              <Text style={styles.photoCountLabel}>Photos</Text>
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  // ─── Step 1: Violation Type ───────────────────────────────────────────────
  if (step === 1) {
    return (
      <SafeAreaView style={styles.container}>
        {renderStepBar()}
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
          {/* Photo preview strip */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
            {photos.map((photo, i) => (
              <View key={i} style={styles.photoThumb}>
                <Image source={{ uri: photo.uri }} style={styles.thumbImg} />
                <TouchableOpacity style={styles.thumbRemove} onPress={() => removePhoto(i)}>
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 && (
              <TouchableOpacity style={styles.addMorePhoto} onPress={() => setStep(0)}>
                <Ionicons name="add" size={28} color="#94a3b8" />
                <Text style={styles.addMoreText}>Add</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          <Text style={styles.stepTitle}>What's the violation?</Text>

          <View style={styles.violationGrid}>
            {VIOLATION_TYPES.map(type => (
              <TouchableOpacity
                key={type.value}
                style={[styles.violationCard, violationType === type.value && styles.violationCardSelected]}
                onPress={() => {
                  setViolationType(type.value);
                  Haptics.selectionAsync();
                }}
              >
                <Text style={styles.violationIcon}>{type.icon}</Text>
                <Text style={styles.violationLabel}>{type.label}</Text>
                <Text style={styles.violationBounty}>{type.bounty}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.descField}>
            <Text style={styles.fieldLabel}>Additional Notes (optional)</Text>
            <TextInput
              style={styles.textArea}
              placeholder="e.g. Car has been here for 2 hours..."
              placeholderTextColor="#475569"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>
        </ScrollView>

        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(0)}>
            <Ionicons name="arrow-back" size={20} color="#94a3b8" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.nextBtn, !violationType && styles.nextBtnDisabled]}
            onPress={() => violationType && setStep(2)}
            disabled={!violationType}
          >
            <Text style={styles.nextBtnText}>Next</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Step 2: Vehicle Info ─────────────────────────────────────────────────
  if (step === 2) {
    return (
      <SafeAreaView style={styles.container}>
        {renderStepBar()}
        <ScrollView style={styles.stepContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepTitle}>Vehicle Info</Text>
          <Text style={styles.stepSubtitle}>Add what you can see — license plate is most important</Text>

          <View style={styles.plateRow}>
            <View style={[styles.formField, { flex: 2 }]}>
              <Text style={styles.fieldLabel}>License Plate</Text>
              <TextInput
                style={[styles.input, styles.plateInput]}
                placeholder="ABC 1234"
                placeholderTextColor="#475569"
                value={licensePlate}
                onChangeText={t => setLicensePlate(t.toUpperCase())}
                autoCapitalize="characters"
                returnKeyType="next"
              />
            </View>
            <View style={[styles.formField, { flex: 1, marginLeft: 12 }]}>
              <Text style={styles.fieldLabel}>State</Text>
              <TextInput
                style={styles.input}
                placeholder="CA"
                placeholderTextColor="#475569"
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formField, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Color</Text>
              <TextInput
                style={styles.input}
                placeholder="Red"
                placeholderTextColor="#475569"
                value={color}
                onChangeText={setColor}
              />
            </View>
            <View style={[styles.formField, { flex: 1, marginLeft: 12 }]}>
              <Text style={styles.fieldLabel}>Make</Text>
              <TextInput
                style={styles.input}
                placeholder="Toyota"
                placeholderTextColor="#475569"
                value={make}
                onChangeText={setMake}
              />
            </View>
          </View>

          <View style={styles.skipNote}>
            <Ionicons name="information-circle-outline" size={16} color="#64748b" />
            <Text style={styles.skipNoteText}>Vehicle info is optional but helps police take faster action.</Text>
          </View>
        </ScrollView>

        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
            <Ionicons name="arrow-back" size={20} color="#94a3b8" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(3)}>
            <Text style={styles.nextBtnText}>Review</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Step 3: Review & Submit ──────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {renderStepBar()}
      <ScrollView style={styles.stepContent}>
        <Text style={styles.stepTitle}>Ready to Submit</Text>

        {/* Photos */}
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>PHOTOS ({photos.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {photos.map((photo, i) => (
              <Image key={i} source={{ uri: photo.uri }} style={styles.reviewThumb} />
            ))}
          </ScrollView>
        </View>

        {/* Violation */}
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>VIOLATION</Text>
          <Text style={styles.reviewValue}>
            {selectedViolation?.icon} {selectedViolation?.label}
          </Text>
        </View>

        {/* Location */}
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>LOCATION</Text>
          <Text style={styles.reviewValue}>{address || 'GPS coordinates attached'}</Text>
          {nearestStation && (
            <View style={styles.stationRow}>
              <Ionicons name="business-outline" size={14} color="#93c5fd" />
              <Text style={styles.stationName}>Sending to: {nearestStation.name}</Text>
            </View>
          )}
        </View>

        {/* Vehicle */}
        {(licensePlate || color || make) && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewLabel}>VEHICLE</Text>
            {licensePlate && <Text style={styles.reviewValue}>Plate: {licensePlate}</Text>}
            {(color || make) && <Text style={styles.reviewValueSub}>{color} {make}</Text>}
          </View>
        )}

        {/* Bounty */}
        <View style={styles.bountyPreview}>
          <Ionicons name="cash-outline" size={20} color="#22c55e" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.bountyPreviewTitle}>Potential Bounty: {selectedViolation?.bounty}</Text>
            <Text style={styles.bountyPreviewSub}>Paid if police approve your report</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.navRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setStep(2)}>
          <Ionicons name="arrow-back" size={20} color="#94a3b8" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send-outline" size={18} color="#fff" />
              <Text style={styles.submitBtnText}>Submit Report</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },

  // Step bar
  stepBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  stepItem: { alignItems: 'center', flex: 1 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4
  },
  stepDotActive: { backgroundColor: '#3b82f6' },
  stepDotDone: { backgroundColor: '#22c55e' },
  stepNum: { color: '#64748b', fontSize: 12, fontWeight: '700' },
  stepNumActive: { color: '#fff' },
  stepLabel: { color: '#475569', fontSize: 10, fontWeight: '600', textAlign: 'center' },
  stepLabelActive: { color: '#e2e8f0' },

  // Step content
  stepContent: { flex: 1, padding: 16 },
  stepTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 4, marginTop: 8 },
  stepSubtitle: { color: '#94a3b8', fontSize: 13, marginBottom: 16 },

  // Camera screen
  cameraTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  cameraTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 220,
    gap: 6
  },
  locationBadgeText: { color: '#fff', fontSize: 12 },
  flipBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  crosshairContainer: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    right: '10%',
    bottom: '25%',
    justifyContent: 'space-between'
  },
  crosshairCornerTL: { position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderTopWidth: 3, borderLeftWidth: 3, borderColor: 'rgba(255,255,255,0.7)', borderTopLeftRadius: 4 },
  crosshairCornerTR: { position: 'absolute', top: 0, right: 0, width: 30, height: 30, borderTopWidth: 3, borderRightWidth: 3, borderColor: 'rgba(255,255,255,0.7)', borderTopRightRadius: 4 },
  crosshairCornerBL: { position: 'absolute', bottom: 0, left: 0, width: 30, height: 30, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: 'rgba(255,255,255,0.7)', borderBottomLeftRadius: 4 },
  crosshairCornerBR: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderBottomWidth: 3, borderRightWidth: 3, borderColor: 'rgba(255,255,255,0.7)', borderBottomRightRadius: 4 },
  cameraBottom: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40
  },
  galleryBtn: { alignItems: 'center' },
  galleryBtnText: { color: '#fff', fontSize: 11, marginTop: 4 },
  captureBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center'
  },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  photoCount: { alignItems: 'center' },
  photoCountText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  photoCountLabel: { color: '#94a3b8', fontSize: 11 },

  // Photo strip
  photoStrip: { marginBottom: 16 },
  photoThumb: { width: 80, height: 80, borderRadius: 8, marginRight: 8, position: 'relative' },
  thumbImg: { width: 80, height: 80, borderRadius: 8 },
  thumbRemove: { position: 'absolute', top: -6, right: -6 },
  addMorePhoto: {
    width: 80, height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center'
  },
  addMoreText: { color: '#64748b', fontSize: 11 },

  // Violation grid
  violationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16
  },
  violationCard: {
    width: '30%',
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center'
  },
  violationCardSelected: { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.15)' },
  violationIcon: { fontSize: 24, marginBottom: 4 },
  violationLabel: { color: '#e2e8f0', fontSize: 11, fontWeight: '600', textAlign: 'center', marginBottom: 2 },
  violationBounty: { color: '#22c55e', fontSize: 10, fontWeight: '700' },

  // Form fields
  formField: { marginBottom: 14 },
  formRow: { flexDirection: 'row', marginBottom: 14 },
  plateRow: { flexDirection: 'row', marginBottom: 14 },
  fieldLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 12,
    color: '#e2e8f0',
    fontSize: 15
  },
  plateInput: { fontSize: 18, fontWeight: '700', letterSpacing: 2 },
  textArea: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 12,
    color: '#e2e8f0',
    fontSize: 14,
    height: 80,
    textAlignVertical: 'top'
  },
  descField: { marginTop: 8 },
  skipNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 4,
    padding: 12,
    backgroundColor: 'rgba(51,65,85,0.3)',
    borderRadius: 8
  },
  skipNoteText: { color: '#64748b', fontSize: 12, flex: 1 },

  // Review
  reviewSection: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10
  },
  reviewLabel: { color: '#475569', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  reviewValue: { color: '#e2e8f0', fontSize: 15, fontWeight: '500' },
  reviewValueSub: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  reviewThumb: { width: 70, height: 70, borderRadius: 8, marginRight: 8 },
  stationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  stationName: { color: '#93c5fd', fontSize: 13 },
  bountyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16
  },
  bountyPreviewTitle: { color: '#22c55e', fontWeight: '700', fontSize: 15 },
  bountyPreviewSub: { color: '#86efac', fontSize: 12, marginTop: 2 },

  // Nav
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    gap: 12
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center'
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 14,
    gap: 6
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  submitBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 14,
    gap: 8
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Permissions
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  permissionTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  permissionText: { color: '#94a3b8', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  permissionBtn: { backgroundColor: '#3b82f6', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  permissionBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  galleryAltBtn: { marginTop: 16 },
  galleryAltText: { color: '#64748b', fontSize: 14, textDecorationLine: 'underline' },

  // Success
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  successIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#22c55e',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16
  },
  successTitle: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 8 },
  successNumber: { color: '#3b82f6', fontSize: 18, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '700', marginBottom: 16 },
  successStation: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  successStationText: { color: '#93c5fd', fontSize: 14 },
  bountyCard: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
    width: '100%'
  },
  bountyCardTitle: { color: '#22c55e', fontWeight: '700', fontSize: 16, marginTop: 8 },
  bountyCardText: { color: '#86efac', fontSize: 13, textAlign: 'center', marginTop: 4 },
  reportAnotherBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center'
  },
  reportAnotherText: { color: '#fff', fontWeight: '700', fontSize: 16 }
});
