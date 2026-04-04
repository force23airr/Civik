import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAssetUrl } from '../api/client';

const CARD_HEIGHT = 350;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TYPE_COLORS = {
  infrastructure_pothole: '#f97316',
  infrastructure_road_damage: '#ef4444',
  infrastructure_lighting: '#eab308',
  weather_flooding: '#3b82f6',
  weather_debris: '#22c55e',
  traffic_signal_issue: '#a855f7',
};

const TYPE_LABELS = {
  infrastructure_pothole: 'Pothole',
  infrastructure_road_damage: 'Road Damage',
  infrastructure_lighting: 'Lighting',
  weather_flooding: 'Flooding',
  weather_debris: 'Debris',
  traffic_signal_issue: 'Signal Issue',
};

const SEVERITY_COLORS = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
};

const STATUS_COLORS = {
  submitted: '#eab308',
  acknowledged: '#3b82f6',
  in_progress: '#f97316',
  resolved: '#22c55e',
};

const STATUS_LABELS = {
  submitted: 'Submitted',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

function getRelativeTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export default function IncidentDetailCard({ incident, onClose, visible }) {
  const slideAnim = useRef(new Animated.Value(CARD_HEIGHT)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : CARD_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!incident) return null;

  const typeColor = TYPE_COLORS[incident.type] || '#3b82f6';
  const typeLabel = TYPE_LABELS[incident.type] || incident.type || 'Unknown';
  const severityColor = SEVERITY_COLORS[incident.severity] || '#64748b';
  const statusColor = STATUS_COLORS[incident.status] || '#64748b';
  const statusLabel = STATUS_LABELS[incident.status] || incident.status || 'Unknown';
  const thumbnail =
    incident.mediaFiles && incident.mediaFiles.length > 0
      ? getAssetUrl(incident.mediaFiles[0])
      : null;
  const reporter =
    incident.user?.username || incident.user?.name || 'Anonymous';

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* Close button */}
      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <Ionicons name="close" size={22} color="#94a3b8" />
      </TouchableOpacity>

      {/* Badges row */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: typeColor + '22', borderColor: typeColor }]}>
          <Text style={[styles.badgeText, { color: typeColor }]}>{typeLabel}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: severityColor + '22', borderColor: severityColor }]}>
          <Text style={[styles.badgeText, { color: severityColor }]}>
            {incident.severity ? incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1) : 'N/A'}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Content row */}
      <View style={styles.contentRow}>
        <View style={styles.textCol}>
          <Text style={styles.description} numberOfLines={3}>
            {incident.description || 'No description provided.'}
          </Text>

          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={14} color="#64748b" />
            <Text style={styles.metaText}>{getRelativeTime(incident.createdAt)}</Text>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={14} color="#64748b" />
            <Text style={styles.metaText}>{reporter}</Text>
          </View>
        </View>

        {thumbnail && (
          <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
        )}
      </View>

      {/* View Full Report button */}
      <TouchableOpacity style={styles.viewBtn} activeOpacity={0.8}>
        <Text style={styles.viewBtnText}>View Full Report</Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: CARD_HEIGHT,
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 14,
    zIndex: 10,
    padding: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  contentRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  textCol: {
    flex: 1,
    marginRight: 12,
  },
  description: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metaText: {
    color: '#64748b',
    fontSize: 12,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#334155',
  },
  viewBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  viewBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
