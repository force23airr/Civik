import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Image, Alert, ActivityIndicator, Modal,
  FlatList, SafeAreaView, Platform
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../src/api/client';

const ISSUE_TYPES = [
  { type: 'infrastructure_pothole', label: 'Pothole', icon: 'ellipse-outline', dept: 'Public Works' },
  { type: 'infrastructure_road_damage', label: 'Road Damage', icon: 'construct-outline', dept: 'Public Works' },
  { type: 'infrastructure_lighting', label: 'Broken Light', icon: 'flashlight-outline', dept: 'Public Works' },
  { type: 'infrastructure_signage', label: 'Broken Sign', icon: 'warning-outline', dept: 'Traffic Engineering' },
  { type: 'weather_flooding', label: 'Flooding', icon: 'water-outline', dept: 'Stormwater' },
  { type: 'weather_debris', label: 'Debris', icon: 'leaf-outline', dept: 'Parks & Rec' },
  { type: 'weather_ice', label: 'Ice / Snow', icon: 'snow-outline', dept: 'Public Works' },
  { type: 'traffic_signal_issue', label: 'Signal Issue', icon: 'stopwatch-outline', dept: 'Traffic Engineering' },
  { type: 'traffic_congestion', label: 'Congestion', icon: 'car-outline', dept: 'Traffic Engineering' },
  { type: 'infrastructure_construction', label: 'Construction', icon: 'hammer-outline', dept: 'Public Works' },
];

const STEPS = ['Location', 'County', 'City', 'Issue Type', 'Photos', 'Review'];

export default function ReportInfrastructureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Location
  const [gpsLocation, setGpsLocation] = useState(null);
  const [gpsAddress, setGpsAddress] = useState(null);
  const [usingGPS, setUsingGPS] = useState(true);
  const [locating, setLocating] = useState(false);

  // County / city picker
  const [counties, setCounties] = useState([]);
  const [loadingJurisdictions, setLoadingJurisdictions] = useState(false);
  const [selectedCounty, setSelectedCounty] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [citySearch, setCitySearch] = useState('');

  // Issue
  const [selectedIssue, setSelectedIssue] = useState(null);

  // Photos
  const [photos, setPhotos] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const [description, setDescription] = useState('');
  const cameraRef = useRef(null);

  // Routing preview
  const [routingPreview, setRoutingPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    fetchJurisdictions();
    autoDetectLocation();
  }, []);

  const fetchJurisdictions = async () => {
    setLoadingJurisdictions(true);
    try {
      const res = await api.get('/municipal/jurisdictions?state=FL');
      setCounties(res.data.counties || []);
    } catch (e) {
      if (__DEV__) console.warn('Could not load jurisdictions', e.message);
    } finally {
      setLoadingJurisdictions(false);
    }
  };

  const autoDetectLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocating(false); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGpsLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      const [addr] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (addr) {
        setGpsAddress(addr);
        // Auto-select county + city if they match FL counties
        if (addr.region === 'FL' || addr.region === 'Florida') {
          // We'll let user confirm via picker
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('Location error', e.message);
    } finally {
      setLocating(false);
    }
  };

  const fetchRoutingPreview = async () => {
    if (!selectedIssue) return;
    setLoadingPreview(true);
    try {
      const params = new URLSearchParams({ type: selectedIssue.type });
      if (gpsLocation && usingGPS) {
        params.append('lat', gpsLocation.lat);
        params.append('lng', gpsLocation.lng);
      }
      if (selectedCity) params.append('city', selectedCity);
      if (selectedCounty) params.append('state', 'FL');
      const res = await api.get(`/municipal/lookup?${params.toString()}`);
      setRoutingPreview(res.data);
    } catch (e) {
      setRoutingPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (step === 5) fetchRoutingPreview();
  }, [step]);

  const takePhoto = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    setShowCamera(true);
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      setPhotos(prev => [...prev, photo.uri]);
      setShowCamera(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhotos(prev => [...prev, ...result.assets.map(a => a.uri)]);
    }
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    if (!selectedIssue) return Alert.alert('Missing', 'Select an issue type');
    if (photos.length === 0) return Alert.alert('Missing', 'Add at least one photo');

    setSubmitting(true);
    try {
      const locationObj = {
        address: selectedCity
          ? `${selectedCity}, ${selectedCounty?.name || 'FL'}`
          : gpsAddress
            ? `${gpsAddress.street || ''} ${gpsAddress.city || ''}, ${gpsAddress.region || 'FL'}`
            : 'Unknown',
        lat: gpsLocation?.lat,
        lng: gpsLocation?.lng,
        city: selectedCity || gpsAddress?.city,
        state: 'FL',
        country: 'US',
      };

      const formData = new FormData();
      formData.append('title', `${selectedIssue.label} Report`);
      formData.append('description', description || `${selectedIssue.label} reported via Civik`);
      formData.append('type', selectedIssue.type);
      formData.append('severity', 'medium');
      formData.append('location', JSON.stringify(locationObj));

      photos.forEach((uri, i) => {
        formData.append('media', {
          uri,
          type: 'image/jpeg',
          name: `infra_${i}.jpg`,
        });
      });

      await api.post('/incidents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Report Submitted!',
        routingPreview?.department
          ? `Your report has been sent to ${routingPreview.department.name}. They will investigate and resolve the issue.`
          : 'Your report has been submitted and will be routed to the appropriate department.',
        [{ text: 'Done', onPress: resetForm }]
      );
    } catch (e) {
      const serverMsg = e.response?.data?.message || e.response?.data?.error;
      Alert.alert('Submission Failed', serverMsg || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep(0);
    setSelectedCounty(null);
    setSelectedCity(null);
    setSelectedIssue(null);
    setPhotos([]);
    setDescription('');
    setRoutingPreview(null);
    setCitySearch('');
    autoDetectLocation();
  };

  const canAdvance = () => {
    if (step === 0) return true; // location always available
    if (step === 1) return !!selectedCounty;
    if (step === 2) return !!selectedCity;
    if (step === 3) return !!selectedIssue;
    if (step === 4) return photos.length > 0;
    return true;
  };

  const filteredCities = selectedCounty
    ? selectedCounty.cities.filter(c => c.toLowerCase().includes(citySearch.toLowerCase()))
    : [];

  // ── Camera view ───────────────────────────────────────────────────────────
  if (showCamera) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.cameraCancelBtn} onPress={() => setShowCamera(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={styles.cameraBottomBar}>
              <TouchableOpacity style={styles.shutterBtn} onPress={capturePhoto}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <Text style={styles.headerTitle}>Report Infrastructure Issue</Text>
        {/* Progress bar */}
        <View style={styles.progressBar}>
          {STEPS.map((s, i) => (
            <View key={s} style={styles.progressStep}>
              <View style={[
                styles.progressDot,
                i <= step && styles.progressDotActive,
                i < step && styles.progressDotDone
              ]}>
                {i < step
                  ? <Ionicons name="checkmark" size={10} color="#fff" />
                  : <Text style={styles.progressDotText}>{i + 1}</Text>
                }
              </View>
              {i < STEPS.length - 1 && (
                <View style={[styles.progressLine, i < step && styles.progressLineActive]} />
              )}
            </View>
          ))}
        </View>
        <Text style={styles.stepLabel}>{STEPS[step]}</Text>
      </LinearGradient>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── STEP 0: Location ─────────────────────────────────────────────── */}
        {step === 0 && (
          <View style={styles.stepCard}>
            <Text style={styles.sectionTitle}>Where is the issue?</Text>

            {locating ? (
              <View style={styles.locatingRow}>
                <ActivityIndicator color="#3b82f6" />
                <Text style={styles.locatingText}>Detecting location…</Text>
              </View>
            ) : gpsLocation ? (
              <View style={styles.gpsCard}>
                <Ionicons name="location" size={22} color="#22c55e" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.gpsTitle}>GPS Detected</Text>
                  <Text style={styles.gpsSubtitle}>
                    {gpsAddress
                      ? `${gpsAddress.city || ''}, ${gpsAddress.region || 'FL'}`
                      : `${gpsLocation.lat.toFixed(4)}, ${gpsLocation.lng.toFixed(4)}`}
                  </Text>
                </View>
                <TouchableOpacity onPress={autoDetectLocation}>
                  <Ionicons name="refresh" size={20} color="#3b82f6" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.gpsBtn} onPress={autoDetectLocation}>
                <Ionicons name="locate-outline" size={20} color="#3b82f6" />
                <Text style={styles.gpsBtnText}>Detect My Location</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.orText}>— or select manually below —</Text>
            <Text style={styles.hint}>
              You'll pick county and city in the next steps to make sure your report goes to the right department.
            </Text>
          </View>
        )}

        {/* ── STEP 1: County Picker ─────────────────────────────────────────── */}
        {step === 1 && (
          <View style={styles.stepCard}>
            <Text style={styles.sectionTitle}>Select County</Text>
            <Text style={styles.hint}>Which Florida county is this issue in?</Text>

            {loadingJurisdictions ? (
              <ActivityIndicator color="#3b82f6" style={{ marginTop: 20 }} />
            ) : (
              <View style={styles.pickerList}>
                {counties.map(county => (
                  <TouchableOpacity
                    key={county.code}
                    style={[
                      styles.pickerItem,
                      selectedCounty?.code === county.code && styles.pickerItemSelected
                    ]}
                    onPress={() => {
                      setSelectedCounty(county);
                      setSelectedCity(null);
                      setCitySearch('');
                      Haptics.selectionAsync();
                    }}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      selectedCounty?.code === county.code && styles.pickerItemTextSelected
                    ]}>
                      {county.name}
                    </Text>
                    <Text style={styles.pickerItemCount}>{county.cities.length} cities</Text>
                    {selectedCounty?.code === county.code && (
                      <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── STEP 2: City Picker ───────────────────────────────────────────── */}
        {step === 2 && (
          <View style={styles.stepCard}>
            <Text style={styles.sectionTitle}>Select City / Town</Text>
            <Text style={styles.hint}>{selectedCounty?.name}</Text>

            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color="#64748b" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search city…"
                placeholderTextColor="#64748b"
                value={citySearch}
                onChangeText={setCitySearch}
              />
              {citySearch.length > 0 && (
                <TouchableOpacity onPress={() => setCitySearch('')}>
                  <Ionicons name="close-circle" size={18} color="#64748b" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.pickerList}>
              {filteredCities.map(city => (
                <TouchableOpacity
                  key={city}
                  style={[
                    styles.pickerItem,
                    selectedCity === city && styles.pickerItemSelected
                  ]}
                  onPress={() => {
                    setSelectedCity(city);
                    Haptics.selectionAsync();
                  }}
                >
                  <Ionicons
                    name="location-outline"
                    size={16}
                    color={selectedCity === city ? '#3b82f6' : '#64748b'}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[
                    styles.pickerItemText,
                    selectedCity === city && styles.pickerItemTextSelected
                  ]}>
                    {city}
                  </Text>
                  {selectedCity === city && (
                    <Ionicons name="checkmark-circle" size={20} color="#3b82f6" style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── STEP 3: Issue Type ────────────────────────────────────────────── */}
        {step === 3 && (
          <View style={styles.stepCard}>
            <Text style={styles.sectionTitle}>What's the issue?</Text>
            <View style={styles.issueGrid}>
              {ISSUE_TYPES.map(issue => (
                <TouchableOpacity
                  key={issue.type}
                  style={[
                    styles.issueCard,
                    selectedIssue?.type === issue.type && styles.issueCardSelected
                  ]}
                  onPress={() => {
                    setSelectedIssue(issue);
                    Haptics.selectionAsync();
                  }}
                >
                  <Ionicons
                    name={issue.icon}
                    size={28}
                    color={selectedIssue?.type === issue.type ? '#3b82f6' : '#94a3b8'}
                  />
                  <Text style={[
                    styles.issueLabel,
                    selectedIssue?.type === issue.type && styles.issueLabelSelected
                  ]}>
                    {issue.label}
                  </Text>
                  <Text style={styles.issueDept}>{issue.dept}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── STEP 4: Photos + Description ─────────────────────────────────── */}
        {step === 4 && (
          <View style={styles.stepCard}>
            <Text style={styles.sectionTitle}>Add Photos</Text>
            <Text style={styles.hint}>Clear photos help departments prioritize your report faster.</Text>

            <View style={styles.photoGrid}>
              {photos.map((uri, i) => (
                <View key={i} style={styles.photoThumb}>
                  <Image source={{ uri }} style={styles.photoImg} />
                  <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)}>
                    <Ionicons name="close-circle" size={22} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}

              {photos.length < 5 && (
                <View style={styles.addPhotoRow}>
                  <TouchableOpacity style={styles.addPhotoBtn} onPress={takePhoto}>
                    <Ionicons name="camera-outline" size={28} color="#3b82f6" />
                    <Text style={styles.addPhotoBtnText}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.addPhotoBtn} onPress={pickFromGallery}>
                    <Ionicons name="images-outline" size={28} color="#8b5cf6" />
                    <Text style={styles.addPhotoBtnText}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Description (optional)</Text>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Describe the issue in more detail…"
              placeholderTextColor="#475569"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.charCount}>{description.length}/500</Text>
          </View>
        )}

        {/* ── STEP 5: Review ────────────────────────────────────────────────── */}
        {step === 5 && (
          <View style={styles.stepCard}>
            <Text style={styles.sectionTitle}>Review & Submit</Text>

            <View style={styles.reviewRow}>
              <Ionicons name="location-outline" size={18} color="#64748b" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.reviewLabel}>Location</Text>
                <Text style={styles.reviewValue}>
                  {selectedCity
                    ? `${selectedCity}, ${selectedCounty?.name || 'FL'}`
                    : gpsAddress?.city
                      ? `${gpsAddress.city}, FL`
                      : 'GPS location'}
                </Text>
              </View>
            </View>

            <View style={styles.reviewRow}>
              <Ionicons name={selectedIssue?.icon || 'alert-outline'} size={18} color="#64748b" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.reviewLabel}>Issue Type</Text>
                <Text style={styles.reviewValue}>{selectedIssue?.label}</Text>
              </View>
            </View>

            <View style={styles.reviewRow}>
              <Ionicons name="images-outline" size={18} color="#64748b" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.reviewLabel}>Photos</Text>
                <Text style={styles.reviewValue}>{photos.length} photo{photos.length !== 1 ? 's' : ''}</Text>
              </View>
            </View>

            {/* Routing Preview */}
            <View style={styles.routingCard}>
              <Text style={styles.routingTitle}>Will be sent to:</Text>
              {loadingPreview ? (
                <ActivityIndicator color="#3b82f6" />
              ) : routingPreview?.department ? (
                <>
                  <Text style={styles.routingDeptName}>{routingPreview.department.name}</Text>
                  <Text style={styles.routingDeptCity}>
                    {routingPreview.department.municipality?.city}, {routingPreview.department.municipality?.state}
                  </Text>
                  <View style={styles.protocolBadge}>
                    <Ionicons
                      name={routingPreview.department.protocol === 'open311' ? 'flash-outline' : 'mail-outline'}
                      size={13}
                      color="#22c55e"
                    />
                    <Text style={styles.protocolText}>
                      {routingPreview.department.protocol === 'open311' ? 'Direct 311 API' : 'Email submission'}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={styles.routingUnknown}>
                  Your report will be queued and routed to the appropriate department.
                </Text>
              )}
            </View>

            {/* Photo preview strip */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              {photos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.reviewPhoto} />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Bottom navigation buttons */}
      <View style={styles.bottomBar}>
        {step > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
            <Ionicons name="chevron-back" size={20} color="#94a3b8" />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}

        {step < STEPS.length - 1 ? (
          <TouchableOpacity
            style={[styles.nextBtn, !canAdvance() && styles.nextBtnDisabled]}
            onPress={() => canAdvance() && setStep(s => s + 1)}
            disabled={!canAdvance()}
          >
            <Text style={styles.nextBtnText}>Next</Text>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={submit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send-outline" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>Submit Report</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },

  header: {
    paddingTop: Platform.OS === 'android' ? 40 : 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '700', marginBottom: 12 },

  progressBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  progressStep: { flexDirection: 'row', alignItems: 'center' },
  progressDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#1e293b', borderWidth: 1.5, borderColor: '#334155',
    alignItems: 'center', justifyContent: 'center',
  },
  progressDotActive: { borderColor: '#3b82f6', backgroundColor: '#1d4ed8' },
  progressDotDone: { borderColor: '#22c55e', backgroundColor: '#16a34a' },
  progressDotText: { color: '#64748b', fontSize: 9, fontWeight: '700' },
  progressLine: { width: 18, height: 2, backgroundColor: '#1e293b', marginHorizontal: 1 },
  progressLineActive: { backgroundColor: '#22c55e' },
  stepLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },

  body: { flex: 1 },
  stepCard: { margin: 16, padding: 16, backgroundColor: '#1e293b', borderRadius: 12 },
  sectionTitle: { color: '#f1f5f9', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  hint: { color: '#64748b', fontSize: 13, marginBottom: 16 },

  locatingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  locatingText: { color: '#94a3b8', fontSize: 13 },

  gpsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0f172a', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#22c55e33',
  },
  gpsTitle: { color: '#22c55e', fontSize: 13, fontWeight: '700' },
  gpsSubtitle: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  gpsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0f172a', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#3b82f6',
  },
  gpsBtnText: { color: '#3b82f6', fontWeight: '600' },
  orText: { color: '#475569', fontSize: 12, textAlign: 'center', marginVertical: 12 },

  pickerList: { gap: 8, marginTop: 4 },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0f172a', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#334155',
  },
  pickerItemSelected: { borderColor: '#3b82f6', backgroundColor: '#1d4ed820' },
  pickerItemText: { flex: 1, color: '#cbd5e1', fontSize: 14, fontWeight: '500' },
  pickerItemTextSelected: { color: '#3b82f6', fontWeight: '700' },
  pickerItemCount: { color: '#475569', fontSize: 11, marginRight: 8 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0f172a', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#334155', marginBottom: 12,
  },
  searchInput: { flex: 1, color: '#f1f5f9', fontSize: 14 },

  issueGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  issueCard: {
    width: '47%', alignItems: 'center', padding: 16,
    backgroundColor: '#0f172a', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#334155',
  },
  issueCardSelected: { borderColor: '#3b82f6', backgroundColor: '#1d4ed815' },
  issueLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginTop: 8 },
  issueLabelSelected: { color: '#3b82f6' },
  issueDept: { color: '#475569', fontSize: 10, marginTop: 3 },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoThumb: { width: 90, height: 90, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 2, right: 2 },
  addPhotoRow: { flexDirection: 'row', gap: 10 },
  addPhotoBtn: {
    width: 90, height: 90, borderRadius: 10,
    backgroundColor: '#0f172a', borderWidth: 1.5, borderColor: '#334155', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  addPhotoBtnText: { color: '#64748b', fontSize: 11, marginTop: 4 },

  descriptionInput: {
    backgroundColor: '#0f172a', borderRadius: 10, padding: 14,
    color: '#f1f5f9', fontSize: 14, borderWidth: 1, borderColor: '#334155',
    minHeight: 100, textAlignVertical: 'top',
  },
  charCount: { color: '#475569', fontSize: 11, textAlign: 'right', marginTop: 4 },

  reviewRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#0f172a', borderRadius: 10, padding: 14,
    marginBottom: 10,
  },
  reviewLabel: { color: '#64748b', fontSize: 11, fontWeight: '600' },
  reviewValue: { color: '#f1f5f9', fontSize: 14, fontWeight: '600', marginTop: 2 },

  routingCard: {
    backgroundColor: '#0f172a', borderRadius: 12, padding: 16,
    borderWidth: 1.5, borderColor: '#3b82f633', marginTop: 6,
  },
  routingTitle: { color: '#64748b', fontSize: 11, fontWeight: '700', marginBottom: 6 },
  routingDeptName: { color: '#3b82f6', fontSize: 15, fontWeight: '700' },
  routingDeptCity: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  protocolBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 8, backgroundColor: '#16a34a20', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, alignSelf: 'flex-start',
  },
  protocolText: { color: '#22c55e', fontSize: 11, fontWeight: '600' },
  routingUnknown: { color: '#64748b', fontSize: 13 },
  reviewPhoto: { width: 80, height: 80, borderRadius: 8, marginRight: 8 },

  bottomBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#0f172a', borderTopWidth: 1, borderTopColor: '#1e293b',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 12 },
  backBtnText: { color: '#94a3b8', fontWeight: '600' },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#3b82f6', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14,
    marginLeft: 'auto',
  },
  nextBtnDisabled: { backgroundColor: '#1e293b' },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#22c55e', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14,
    marginLeft: 'auto',
  },
  submitBtnDisabled: { backgroundColor: '#166534' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  cameraOverlay: { flex: 1, justifyContent: 'space-between' },
  cameraCancelBtn: { margin: 16, alignSelf: 'flex-start' },
  cameraBottomBar: { alignItems: 'center', paddingBottom: 40 },
  shutterBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)', borderWidth: 3, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
});
