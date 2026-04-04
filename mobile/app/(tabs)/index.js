import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/context/AuthContext';
import client from '../../src/api/client';

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const [rewards, setRewards] = useState(null);
  const [parkingReports, setParkingReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rewardsRes, parkingRes] = await Promise.all([
        client.get('/rewards/dashboard').catch(() => ({ data: { balance: { available: 0 } } })),
        client.get('/parking-violations/my-reports?limit=5').catch(() => ({ data: { reports: [] } }))
      ]);
      setRewards(rewardsRes.data);
      setParkingReports(parkingRes.data.reports || []);
    } catch (err) {
      if (__DEV__) console.log('Dashboard load error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const statusColor = {
    submitted: '#f59e0b',
    assigned: '#3b82f6',
    under_review: '#8b5cf6',
    approved: '#22c55e',
    denied: '#ef4444',
    closed: '#64748b'
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const balance = rewards?.balance?.available || 0;
  const balanceDollars = (balance / 100).toFixed(2);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3b82f6" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.username}>{user?.username}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <LinearGradient colors={['#1e3a5f', '#1e40af']} style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Ionicons name="cash-outline" size={22} color="#93c5fd" />
          </View>
          <Text style={styles.balanceAmount}>${balanceDollars}</Text>
          <Text style={styles.balanceCredits}>{balance} credits</Text>
        </LinearGradient>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Report</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/report-parking')}
          >
            <LinearGradient colors={['#14532d', '#166534']} style={styles.actionGradient}>
              <Ionicons name="camera" size={28} color="#22c55e" />
              <Text style={styles.actionLabel}>Parking Violation</Text>
              <Text style={styles.actionSub}>Photo → Police → Earn</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/report-violation')}
          >
            <LinearGradient colors={['#1e1b4b', '#312e81']} style={styles.actionGradient}>
              <Ionicons name="car-sport" size={28} color="#818cf8" />
              <Text style={styles.actionLabel}>Driving Violation</Text>
              <Text style={styles.actionSub}>Video → Municipality</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* How it works */}
        <View style={styles.howItWorks}>
          <Text style={styles.sectionTitle}>How Parking Bounties Work</Text>
          {[
            { icon: '📸', step: '1. Snap a photo of a parking violation' },
            { icon: '📍', step: '2. GPS auto-routes to nearest police dept' },
            { icon: '👮', step: '3. Officer reviews and approves/denies' },
            { icon: '💰', step: '4. You earn $1–$7.50 for approved reports' }
          ].map(({ icon, step }) => (
            <View key={step} style={styles.howStep}>
              <Text style={styles.howIcon}>{icon}</Text>
              <Text style={styles.howText}>{step}</Text>
            </View>
          ))}
        </View>

        {/* Recent Parking Reports */}
        {parkingReports.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <Text style={styles.sectionTitle}>Recent Reports</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/my-reports')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>

            {parkingReports.slice(0, 3).map(report => (
              <View key={report._id} style={styles.reportRow}>
                <View style={styles.reportInfo}>
                  <Text style={styles.reportType}>{report.violationTypeDisplay || report.violationType}</Text>
                  <Text style={styles.reportNumber}>{report.reportNumber}</Text>
                </View>
                <View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor[report.status] + '22' }]}>
                    <Text style={[styles.statusText, { color: statusColor[report.status] }]}>
                      {report.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                  {report.reward?.awarded && (
                    <Text style={styles.rewardEarned}>+${(report.reward.amount / 100).toFixed(2)}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Bottom padding */}
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  greeting: { color: '#64748b', fontSize: 14 },
  username: { color: '#fff', fontSize: 22, fontWeight: '800' },
  logoutBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center'
  },
  balanceCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24
  },
  balanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  balanceLabel: { color: '#93c5fd', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  balanceAmount: { color: '#fff', fontSize: 40, fontWeight: '800' },
  balanceCredits: { color: '#93c5fd', fontSize: 13, marginTop: 2 },
  sectionTitle: { color: '#e2e8f0', fontSize: 16, fontWeight: '700', marginHorizontal: 20, marginBottom: 12 },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24
  },
  actionCard: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  actionGradient: { padding: 16, alignItems: 'flex-start', gap: 6 },
  actionLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  actionSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  howItWorks: {
    marginHorizontal: 20,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24
  },
  howStep: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  howIcon: { fontSize: 20 },
  howText: { color: '#94a3b8', fontSize: 13, flex: 1 },
  recentSection: { marginHorizontal: 20, marginBottom: 16 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seeAll: { color: '#3b82f6', fontSize: 13, fontWeight: '600' },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8
  },
  reportInfo: { flex: 1 },
  reportType: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
  reportNumber: { color: '#3b82f6', fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignItems: 'center' },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  rewardEarned: { color: '#22c55e', fontSize: 12, fontWeight: '700', textAlign: 'right', marginTop: 4 }
});
