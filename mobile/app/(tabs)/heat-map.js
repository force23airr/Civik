import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../src/api/client';
import IncidentDetailCard from '../../src/components/IncidentDetailCard';

const MIAMI_REGION = {
  latitude: 25.7617,
  longitude: -80.1918,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

const TYPE_PIN_COLORS = {
  infrastructure_pothole: 'orange',
  infrastructure_road_damage: 'red',
  infrastructure_lighting: 'yellow',
  weather_flooding: 'blue',
  weather_debris: 'green',
  traffic_signal_issue: 'purple',
};

const FILTER_CHIPS = [
  { key: 'all', label: 'All', icon: 'layers-outline' },
  { key: 'infrastructure_pothole', label: 'Potholes', icon: 'alert-circle-outline' },
  { key: 'infrastructure_road_damage', label: 'Road Damage', icon: 'construct-outline' },
  { key: 'infrastructure_lighting', label: 'Lighting', icon: 'flashlight-outline' },
  { key: 'weather_flooding', label: 'Flooding', icon: 'water-outline' },
  { key: 'weather_debris', label: 'Debris', icon: 'leaf-outline' },
  { key: 'traffic_signal_issue', label: 'Signals', icon: 'git-network-outline' },
];

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#64779e' }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#334e87' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#023e58' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
  { featureType: 'poi', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#023e58' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#3C7680' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#b0d5ce' }] },
  { featureType: 'road.highway', elementType: 'labels.text.stroke', stylers: [{ color: '#023e58' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'transit', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'transit.line', elementType: 'geometry.fill', stylers: [{ color: '#283d6a' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#3a4762' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] },
];

export default function HeatMapScreen() {
  const router = useRouter();
  const mapRef = useRef(null);
  const debounceTimer = useRef(null);

  const [region, setRegion] = useState(MIAMI_REGION);
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [cardVisible, setCardVisible] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [reportCount, setReportCount] = useState(0);

  // Request location permission and get initial position
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setUserLocation(coords);
      mapRef.current?.animateToRegion(
        { ...coords, latitudeDelta: 0.05, longitudeDelta: 0.05 },
        800
      );
    })();
  }, []);

  // Fetch heatmap data
  const fetchMarkers = useCallback(
    async (visibleRegion) => {
      try {
        setLoading(true);
        const { latitude, longitude, latitudeDelta, longitudeDelta } = visibleRegion;
        const bounds = {
          north: latitude + latitudeDelta / 2,
          south: latitude - latitudeDelta / 2,
          east: longitude + longitudeDelta / 2,
          west: longitude - longitudeDelta / 2,
        };

        const params = {
          north: bounds.north,
          south: bounds.south,
          east: bounds.east,
          west: bounds.west,
        };

        if (activeFilter !== 'all') {
          params.type = activeFilter;
        }

        const res = await api.get('/analytics/heatmap', { params });
        const data = res.data?.data || res.data || [];
        setMarkers(Array.isArray(data) ? data : []);
        setReportCount(Array.isArray(data) ? data.length : 0);
      } catch (err) {
        console.warn('Heatmap fetch error:', err.message);
      } finally {
        setLoading(false);
      }
    },
    [activeFilter]
  );

  // Fetch on mount + filter change
  useEffect(() => {
    fetchMarkers(region);
  }, [activeFilter]);

  // Debounced region change
  const onRegionChangeComplete = useCallback(
    (newRegion) => {
      setRegion(newRegion);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        fetchMarkers(newRegion);
      }, 500);
    },
    [fetchMarkers]
  );

  const handleMarkerPress = (item) => {
    setSelectedIncident(item);
    setCardVisible(true);
  };

  const handleCloseCard = () => {
    setCardVisible(false);
    setTimeout(() => setSelectedIncident(null), 300);
  };

  const goToMyLocation = () => {
    if (!userLocation) return;
    mapRef.current?.animateToRegion(
      { ...userLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 },
      800
    );
  };

  const handleFilterPress = (key) => {
    setActiveFilter(key);
    setCardVisible(false);
    setSelectedIncident(null);
  };

  const getMarkerCoords = (item) => {
    if (item.latitude != null && item.longitude != null) {
      return { latitude: item.latitude, longitude: item.longitude };
    }
    if (item.location?.coordinates) {
      return {
        latitude: item.location.coordinates[1],
        longitude: item.location.coordinates[0],
      };
    }
    return null;
  };

  const getPinColor = (item) => {
    const type = item.dominantType || item.type || '';
    return TYPE_PIN_COLORS[type] || '#3b82f6';
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={MIAMI_REGION}
        customMapStyle={DARK_MAP_STYLE}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {markers.map((item, index) => {
          const coords = getMarkerCoords(item);
          if (!coords) return null;
          return (
            <Marker
              key={item._id || `marker-${index}`}
              coordinate={coords}
              pinColor={getPinColor(item)}
              onPress={() => handleMarkerPress(item)}
            />
          );
        })}
      </MapView>

      {/* Filter chips */}
      <View style={styles.chipBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScroll}
        >
          {FILTER_CHIPS.map((chip) => {
            const isActive = activeFilter === chip.key;
            return (
              <TouchableOpacity
                key={chip.key}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => handleFilterPress(chip.key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={chip.icon}
                  size={14}
                  color={isActive ? '#fff' : '#94a3b8'}
                />
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Report count badge */}
      <View style={styles.countBadge}>
        <Ionicons name="location" size={14} color="#3b82f6" />
        <Text style={styles.countText}>
          {reportCount} report{reportCount !== 1 ? 's' : ''} in view
        </Text>
      </View>

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#3b82f6" />
        </View>
      )}

      {/* My Location button */}
      <TouchableOpacity
        style={styles.myLocationBtn}
        onPress={goToMyLocation}
        activeOpacity={0.8}
      >
        <Ionicons name="navigate" size={20} color="#3b82f6" />
      </TouchableOpacity>

      {/* Report Here FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/report-infrastructure')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Incident detail card */}
      <IncidentDetailCard
        incident={selectedIncident}
        visible={cardVisible}
        onClose={handleCloseCard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  map: {
    flex: 1,
  },
  chipBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  chipScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
  countBadge: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 90,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1e293bdd',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    zIndex: 10,
  },
  countText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 90,
    right: 60,
    backgroundColor: '#1e293bdd',
    padding: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  myLocationBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 90,
    right: 12,
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 16,
    backgroundColor: '#22c55e',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
});
