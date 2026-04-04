import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client, { getAssetUrl } from '../../src/api/client';

const STATUS_FILTERS = ['all', 'submitted', 'approved', 'denied'];

const statusColor = {
  submitted: '#f59e0b',
  assigned: '#3b82f6',
  under_review: '#8b5cf6',
  approved: '#22c55e',
  denied: '#ef4444',
  closed: '#64748b'
};

export default function MyReportsScreen() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    setReports([]);
    setPage(1);
    setHasMore(true);
    fetchReports(1, true);
  }, [filter]);

  const fetchReports = async (pageNum = 1, reset = false) => {
    try {
      const params = new URLSearchParams({ page: pageNum, limit: 20 });
      if (filter !== 'all') params.append('status', filter);
      const res = await client.get(`/parking-violations/my-reports?${params}`);
      const newReports = res.data.reports || [];

      setReports(prev => reset ? newReports : [...prev, ...newReports]);
      setHasMore(pageNum < res.data.pages);
    } catch (err) {
      if (__DEV__) console.log('My reports error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchReports(1, true);
  };

  const loadMore = () => {
    if (!hasMore || loading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchReports(nextPage);
  };

  const renderReport = ({ item }) => (
    <View style={styles.reportCard}>
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <Text style={styles.reportNumber}>{item.reportNumber}</Text>
          <Text style={styles.reportType}>{item.violationTypeDisplay || item.violationType?.replace(/_/g, ' ')}</Text>
          <Text style={styles.reportDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: (statusColor[item.status] || '#64748b') + '22' }]}>
          <Text style={[styles.statusText, { color: statusColor[item.status] || '#64748b' }]}>
            {item.status?.replace(/_/g, ' ')}
          </Text>
        </View>
      </View>

      {/* Photo thumbs */}
      {item.photos?.length > 0 && (
        <View style={styles.thumbRow}>
          {item.photos.slice(0, 4).map((photo, i) => (
            <Image
              key={i}
              source={{ uri: getAssetUrl(photo.path || `/uploads/${photo.filename}`) }}
              style={styles.thumb}
            />
          ))}
          {item.photos.length > 4 && (
            <View style={styles.morePhotos}>
              <Text style={styles.morePhotosText}>+{item.photos.length - 4}</Text>
            </View>
          )}
        </View>
      )}

      {/* Station */}
      {item.assignedStation && (
        <View style={styles.stationRow}>
          <Ionicons name="business-outline" size={13} color="#64748b" />
          <Text style={styles.stationText}>{item.assignedStation.name || 'Police Dept'}</Text>
        </View>
      )}

      {/* Reward */}
      {item.reward?.awarded && (
        <View style={styles.rewardRow}>
          <Ionicons name="cash-outline" size={14} color="#22c55e" />
          <Text style={styles.rewardText}>
            Earned {item.reward.amount} credits (${(item.reward.amount / 100).toFixed(2)})
          </Text>
        </View>
      )}

      {/* Denial reason */}
      {item.review?.status === 'denied' && item.review.denialReason && (
        <Text style={styles.denialReason}>Denied: {item.review.denialReason}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Reports</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterBar}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && reports.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={56} color="#334155" />
          <Text style={styles.emptyTitle}>No reports yet</Text>
          <Text style={styles.emptyText}>Submit your first parking violation report to start earning rewards</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={item => item._id}
          renderItem={renderReport}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3b82f6" />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={hasMore ? <ActivityIndicator color="#3b82f6" style={{ padding: 16 }} /> : null}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155'
  },
  filterTabActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  filterTabText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  filterTabTextActive: { color: '#fff' },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  reportCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardLeft: { flex: 1 },
  reportNumber: { color: '#3b82f6', fontFamily: 'monospace', fontSize: 12, fontWeight: '700', marginBottom: 3 },
  reportType: { color: '#e2e8f0', fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  reportDate: { color: '#64748b', fontSize: 12, marginTop: 2 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  thumbRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  thumb: { width: 52, height: 52, borderRadius: 6 },
  morePhotos: {
    width: 52, height: 52, borderRadius: 6,
    backgroundColor: '#334155',
    justifyContent: 'center', alignItems: 'center'
  },
  morePhotosText: { color: '#94a3b8', fontWeight: '700', fontSize: 13 },
  stationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  stationText: { color: '#64748b', fontSize: 12 },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: 6,
    padding: 6
  },
  rewardText: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
  denialReason: { color: '#fca5a5', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptyText: { color: '#64748b', fontSize: 14, textAlign: 'center', lineHeight: 20 }
});
