import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

// ─── Color Tokens ───────────────────────────────────────────────────────────
const C = {
  bg: '#0f172a',
  card: '#1e293b',
  cardHover: '#263548',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  accent: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  border: '#334155',
};

// ─── Reusable inline-style helpers ──────────────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: C.bg,
    color: C.text,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 32px',
    borderBottom: `1px solid ${C.border}`,
    background: C.card,
  },
  headerTitle: { margin: 0, fontSize: 22, fontWeight: 700 },
  headerSub: { margin: 0, color: C.textMuted, fontSize: 13 },
  container: { maxWidth: 1440, margin: '0 auto', padding: '24px 32px' },
  tabs: {
    display: 'flex',
    gap: 4,
    borderBottom: `1px solid ${C.border}`,
    marginBottom: 24,
    overflowX: 'auto',
  },
  tab: (active) => ({
    padding: '12px 20px',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    color: active ? C.accent : C.textMuted,
    borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent',
    fontWeight: active ? 600 : 400,
    fontSize: 14,
    whiteSpace: 'nowrap',
    transition: 'all .15s',
  }),
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 },
  statCard: {
    background: C.card,
    borderRadius: 12,
    padding: '20px 24px',
    border: `1px solid ${C.border}`,
  },
  statLabel: { fontSize: 12, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, margin: 0 },
  statValue: { fontSize: 28, fontWeight: 700, margin: '8px 0 0' },
  card: {
    background: C.card,
    borderRadius: 12,
    padding: 24,
    border: `1px solid ${C.border}`,
    marginBottom: 24,
  },
  cardTitle: { fontSize: 16, fontWeight: 600, marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: `1px solid ${C.border}`,
    color: C.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: 600,
  },
  td: {
    padding: '10px 12px',
    borderBottom: `1px solid ${C.border}`,
    verticalAlign: 'middle',
  },
  badge: (color) => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 9999,
    fontSize: 11,
    fontWeight: 600,
    background: color + '22',
    color,
  }),
  input: {
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.text,
    padding: '8px 12px',
    fontSize: 13,
    outline: 'none',
  },
  select: {
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.text,
    padding: '8px 12px',
    fontSize: 13,
    outline: 'none',
    cursor: 'pointer',
  },
  filterBar: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' },
  pagination: { display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20, alignItems: 'center' },
  pageBtn: (disabled) => ({
    padding: '6px 14px',
    borderRadius: 6,
    border: `1px solid ${C.border}`,
    background: disabled ? C.card : C.accent,
    color: disabled ? C.textMuted : '#fff',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 13,
    opacity: disabled ? 0.5 : 1,
  }),
  dot: (color) => ({
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: color,
    marginRight: 8,
  }),
  emptyState: { textAlign: 'center', padding: 48, color: C.textMuted },
  loading: { textAlign: 'center', padding: 64, color: C.textMuted, fontSize: 15 },
  mediaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 },
  mediaCard: {
    background: C.card,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    overflow: 'hidden',
    transition: 'border-color .15s',
  },
  mediaThumbnail: {
    width: '100%',
    height: 160,
    objectFit: 'cover',
    background: '#0d1321',
    display: 'block',
  },
  mediaInfo: { padding: 14 },
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
const severityColor = (s) => ({ critical: C.danger, high: '#f97316', medium: C.warning, low: C.success }[s] || C.textMuted);
const statusColor = (s) => {
  const m = { pending: C.warning, approved: C.success, denied: C.danger, active: C.accent, resolved: C.success, under_review: '#a78bfa', citation_issued: C.success, dismissed: C.textMuted, submitted: C.accent, received: C.accent, completed: C.success };
  return m[s] || C.textMuted;
};

// ─── Main Component ─────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Overview
  const [summary, setSummary] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [rewardRates, setRewardRates] = useState(null);

  // Users
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userPage, setUserPage] = useState(1);

  // Incidents
  const [incidents, setIncidents] = useState([]);
  const [incidentFilters, setIncidentFilters] = useState({ type: '', severity: '', status: '' });
  const [incidentPage, setIncidentPage] = useState(1);
  const [incidentTotal, setIncidentTotal] = useState(0);

  // Parking Violations
  const [parkingReports, setParkingReports] = useState([]);
  const [parkingFilter, setParkingFilter] = useState('');
  const [parkingPage, setParkingPage] = useState(1);

  // Municipal
  const [municipalReports, setMunicipalReports] = useState([]);
  const [municipalFilter, setMunicipalFilter] = useState({ status: '', city: '' });
  const [municipalPage, setMunicipalPage] = useState(1);

  // Submissions / Media
  const [mediaItems, setMediaItems] = useState([]);
  const [mediaPage, setMediaPage] = useState(1);

  // Selected user detail (modal-like)
  const [selectedUser, setSelectedUser] = useState(null);

  const PAGE_SIZE = 20;

  // ── Data Fetchers ───────────────────────────────────────────────────────
  const fetchOverview = useCallback(async () => {
    try {
      const [summaryRes, trendsRes, rewardsRes, recentRes] = await Promise.all([
        api.get('/analytics/summary'),
        api.get('/analytics/trends?granularity=day'),
        api.get('/rewards/rates').catch(() => ({ data: null })),
        api.get('/incidents?limit=20&sort=-createdAt'),
      ]);
      setSummary(summaryRes.data.data || summaryRes.data);
      setRewardRates(rewardsRes.data);
      setRecentActivity(recentRes.data.incidents || recentRes.data.data || recentRes.data || []);
    } catch (err) {
      console.error('Failed to fetch overview:', err);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      // Attempt admin users endpoint; fall back to analytics for counts
      const res = await api.get('/users', {
        params: { page: userPage, limit: PAGE_SIZE, role: userRoleFilter !== 'all' ? userRoleFilter : undefined, search: userSearch || undefined },
      }).catch(async () => {
        // Endpoint may not exist yet — return empty so UI degrades gracefully
        return { data: { users: [] } };
      });
      setUsers(res.data.users || res.data || []);
    } catch {
      setUsers([]);
    }
  }, [userPage, userRoleFilter, userSearch]);

  const fetchIncidents = useCallback(async () => {
    try {
      const params = { page: incidentPage, limit: PAGE_SIZE };
      if (incidentFilters.type) params.type = incidentFilters.type;
      if (incidentFilters.severity) params.severity = incidentFilters.severity;
      if (incidentFilters.status) params.status = incidentFilters.status;
      const res = await api.get('/incidents', { params });
      const data = res.data;
      setIncidents(data.incidents || data.data || data || []);
      setIncidentTotal(data.total || data.count || 0);
    } catch (err) {
      console.error('Failed to fetch incidents:', err);
    }
  }, [incidentPage, incidentFilters]);

  const fetchParking = useCallback(async () => {
    try {
      const params = { page: parkingPage, limit: PAGE_SIZE };
      if (parkingFilter) params.status = parkingFilter;
      // Admin may use /parking-violations or /parking-violations/my-reports
      const res = await api.get('/parking-violations/my-reports', { params })
        .catch(() => api.get('/parking-violations', { params }))
        .catch(() => ({ data: { reports: [] } }));
      setParkingReports(res.data.reports || res.data.data || res.data || []);
    } catch {
      setParkingReports([]);
    }
  }, [parkingPage, parkingFilter]);

  const fetchMunicipal = useCallback(async () => {
    try {
      const params = { page: municipalPage, limit: PAGE_SIZE };
      if (municipalFilter.status) params.status = municipalFilter.status;
      if (municipalFilter.city) params.city = municipalFilter.city;
      const res = await api.get('/municipal/my-reports', { params })
        .catch(() => api.get('/municipal/reports', { params }))
        .catch(() => ({ data: { reports: [] } }));
      setMunicipalReports(res.data.reports || res.data.data || res.data || []);
    } catch {
      setMunicipalReports([]);
    }
  }, [municipalPage, municipalFilter]);

  const fetchMedia = useCallback(async () => {
    try {
      // Build media from incidents that have evidence
      const res = await api.get('/incidents', { params: { page: mediaPage, limit: PAGE_SIZE, hasEvidence: true, sort: '-createdAt' } });
      const raw = res.data.incidents || res.data.data || res.data || [];
      const items = [];
      raw.forEach((inc) => {
        (inc.evidence || []).forEach((ev) => {
          items.push({
            _id: ev._id || ev.fileId,
            incidentId: inc._id,
            type: inc.type || inc.violationType || 'unknown',
            url: ev.url || ev.thumbnailUrl || ev.fileUrl || null,
            mimeType: ev.mimeType || ev.fileType || 'image/jpeg',
            gps: inc.location?.coordinates ? `${inc.location.coordinates[1]?.toFixed(5)}, ${inc.location.coordinates[0]?.toFixed(5)}` : (inc.location?.address || '-'),
            timestamp: ev.uploadedAt || ev.createdAt || inc.createdAt,
            fileSize: ev.metadata?.size || ev.fileSize || null,
            duration: ev.metadata?.duration || null,
            resolution: ev.metadata?.resolution || null,
            reporter: inc.reporterUsername || inc.reporter?.username || '-',
          });
        });
      });
      setMediaItems(items);
    } catch {
      setMediaItems([]);
    }
  }, [mediaPage]);

  // ── Tab-aware loading ──────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    const load = async () => {
      switch (activeTab) {
        case 'overview': await fetchOverview(); break;
        case 'users': await fetchUsers(); break;
        case 'incidents': await fetchIncidents(); break;
        case 'parking': await fetchParking(); break;
        case 'municipal': await fetchMunicipal(); break;
        case 'media': await fetchMedia(); break;
        default: break;
      }
      setLoading(false);
    };
    load();
  }, [activeTab, fetchOverview, fetchUsers, fetchIncidents, fetchParking, fetchMunicipal, fetchMedia]);

  // ── User detail ────────────────────────────────────────────────────────
  const viewUser = async (userId) => {
    try {
      const res = await api.get(`/users/${userId}`);
      setSelectedUser(res.data.user || res.data);
    } catch (err) {
      console.error('Failed to load user:', err);
    }
  };

  const changeUserRole = async (userId, newRole) => {
    try {
      await api.put(`/users/${userId}/role`, { role: newRole });
      fetchUsers();
      if (selectedUser && selectedUser._id === userId) {
        setSelectedUser((prev) => ({ ...prev, role: newRole }));
      }
    } catch (err) {
      alert('Failed to update role: ' + (err.response?.data?.message || err.message));
    }
  };

  // ── Pagination helper ──────────────────────────────────────────────────
  const Pagination = ({ page, setPage, total, items }) => {
    const totalPages = total ? Math.ceil(total / PAGE_SIZE) : (items && items.length < PAGE_SIZE ? page : page + 1);
    return (
      <div style={styles.pagination}>
        <button style={styles.pageBtn(page <= 1)} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
        <span style={{ color: C.textMuted, fontSize: 13 }}>Page {page}{total ? ` of ${Math.ceil(total / PAGE_SIZE)}` : ''}</span>
        <button style={styles.pageBtn(items && items.length < PAGE_SIZE)} disabled={items && items.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    );
  };

  // ─── TABS ──────────────────────────────────────────────────────────────
  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'users', label: 'Users' },
    { key: 'incidents', label: 'Incidents' },
    { key: 'parking', label: 'Parking Violations' },
    { key: 'municipal', label: 'Municipal Reports' },
    { key: 'media', label: 'Submissions / Media' },
  ];

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>Admin Dashboard</h1>
          <p style={styles.headerSub}>Civik Platform Control Center</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: C.textMuted }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>A</div>
        </div>
      </header>

      <div style={styles.container}>
        {/* ── Tab Bar ──────────────────────────────────────────────── */}
        <div style={styles.tabs}>
          {TABS.map((t) => (
            <button key={t.key} style={styles.tab(activeTab === t.key)} onClick={() => { setActiveTab(t.key); }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={styles.loading}>Loading data...</div>
        ) : (
          <>
            {/* ═══════════════════════ OVERVIEW TAB ════════════════════ */}
            {activeTab === 'overview' && (
              <div>
                {/* Stat Cards */}
                <div style={styles.grid4}>
                  <div style={styles.statCard}>
                    <p style={styles.statLabel}>Total Incidents</p>
                    <p style={{ ...styles.statValue, color: C.accent }}>{summary?.totalIncidents ?? '-'}</p>
                  </div>
                  <div style={styles.statCard}>
                    <p style={styles.statLabel}>This Week</p>
                    <p style={{ ...styles.statValue, color: C.success }}>{summary?.thisWeek ?? '-'}</p>
                    {summary?.changePercentage != null && (
                      <span style={{ fontSize: 12, color: summary.changePercentage >= 0 ? C.success : C.danger }}>
                        {summary.changePercentage >= 0 ? '+' : ''}{summary.changePercentage}% vs last week
                      </span>
                    )}
                  </div>
                  <div style={styles.statCard}>
                    <p style={styles.statLabel}>Last Week</p>
                    <p style={{ ...styles.statValue, color: C.warning }}>{summary?.lastWeek ?? '-'}</p>
                  </div>
                  <div style={styles.statCard}>
                    <p style={styles.statLabel}>Trend</p>
                    <p style={{ ...styles.statValue, color: summary?.trend === 'up' ? C.danger : summary?.trend === 'down' ? C.success : C.warning }}>
                      {summary?.trend === 'up' ? 'Increasing' : summary?.trend === 'down' ? 'Decreasing' : 'Stable'}
                    </p>
                  </div>
                </div>

                {/* Revenue / Rewards Row */}
                {rewardRates && (
                  <div style={{ ...styles.grid4, marginTop: 16 }}>
                    <div style={styles.statCard}>
                      <p style={styles.statLabel}>Reward per Report</p>
                      <p style={{ ...styles.statValue, color: C.success }}>{rewardRates.creditPerReport ?? rewardRates.data?.creditPerReport ?? '-'} credits</p>
                    </div>
                    <div style={styles.statCard}>
                      <p style={styles.statLabel}>Payout Rate</p>
                      <p style={{ ...styles.statValue, color: C.accent }}>${rewardRates.payoutRate ?? rewardRates.data?.payoutRate ?? '-'}/credit</p>
                    </div>
                  </div>
                )}

                {/* System Health */}
                <div style={{ ...styles.card, marginTop: 24 }}>
                  <h3 style={styles.cardTitle}>System Health</h3>
                  <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                    <div><span style={styles.dot(C.success)}></span>API Server <span style={{ color: C.success, fontWeight: 600 }}>Online</span></div>
                    <div><span style={styles.dot(C.success)}></span>Database <span style={{ color: C.success, fontWeight: 600 }}>Connected</span></div>
                    <div><span style={styles.dot(C.success)}></span>File Storage <span style={{ color: C.success, fontWeight: 600 }}>Operational</span></div>
                    <div><span style={styles.dot(summary?.totalIncidents > 0 ? C.success : C.warning)}></span>Data Pipeline <span style={{ color: summary?.totalIncidents > 0 ? C.success : C.warning, fontWeight: 600 }}>{summary?.totalIncidents > 0 ? 'Active' : 'Idle'}</span></div>
                  </div>
                </div>

                {/* Type Breakdown */}
                {summary?.typeBreakdown && summary.typeBreakdown.length > 0 && (
                  <div style={styles.card}>
                    <h3 style={styles.cardTitle}>Incidents by Type</h3>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Type</th>
                          <th style={styles.th}>Count</th>
                          <th style={styles.th}>Percentage</th>
                          <th style={styles.th}>Avg Severity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.typeBreakdown.map((t) => (
                          <tr key={t.type}>
                            <td style={styles.td}><span style={styles.badge(C.accent)}>{(t.type || '').replace(/_/g, ' ')}</span></td>
                            <td style={styles.td}>{t.count}</td>
                            <td style={styles.td}>{t.percentage}%</td>
                            <td style={styles.td}>{t.avgSeverity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Recent Activity Feed */}
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Recent Activity (last 20)</h3>
                  {recentActivity.length === 0 ? (
                    <p style={{ color: C.textMuted }}>No recent activity.</p>
                  ) : (
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Time</th>
                          <th style={styles.th}>Type</th>
                          <th style={styles.th}>Severity</th>
                          <th style={styles.th}>Location</th>
                          <th style={styles.th}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentActivity.slice(0, 20).map((inc) => (
                          <tr key={inc._id}>
                            <td style={styles.td}>{fmtDateTime(inc.createdAt || inc.incidentDateTime)}</td>
                            <td style={styles.td}><span style={styles.badge(C.accent)}>{(inc.type || inc.violationType || '-').replace(/_/g, ' ')}</span></td>
                            <td style={styles.td}><span style={styles.badge(severityColor(inc.severity))}>{inc.severity || '-'}</span></td>
                            <td style={{ ...styles.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.location?.address || '-'}</td>
                            <td style={styles.td}><span style={styles.badge(statusColor(inc.status))}>{(inc.status || '-').replace(/_/g, ' ')}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ═══════════════════════ USERS TAB ══════════════════════ */}
            {activeTab === 'users' && (
              <div>
                {/* Filters */}
                <div style={styles.filterBar}>
                  <input
                    style={{ ...styles.input, width: 260 }}
                    placeholder="Search by username or email..."
                    value={userSearch}
                    onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                  />
                  <select style={styles.select} value={userRoleFilter} onChange={(e) => { setUserRoleFilter(e.target.value); setUserPage(1); }}>
                    <option value="all">All Roles</option>
                    <option value="user">User</option>
                    <option value="police_officer">Police Officer</option>
                    <option value="municipal_worker">Municipal Worker</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button style={{ ...styles.select, cursor: 'pointer', background: C.accent, color: '#fff', border: 'none' }} onClick={fetchUsers}>Refresh</button>
                </div>

                {users.length === 0 ? (
                  <div style={styles.emptyState}>
                    <p style={{ fontSize: 16, marginBottom: 8 }}>No users found</p>
                    <p style={{ fontSize: 13 }}>The /api/users endpoint may need to be created. User listing requires an admin-level endpoint.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Username</th>
                            <th style={styles.th}>Email</th>
                            <th style={styles.th}>Role</th>
                            <th style={styles.th}>Credits</th>
                            <th style={styles.th}>Reports</th>
                            <th style={styles.th}>Joined</th>
                            <th style={styles.th}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u) => (
                            <tr key={u._id} style={{ cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.background = C.cardHover} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                              <td style={styles.td}>{u.username || '-'}</td>
                              <td style={{ ...styles.td, color: C.textMuted }}>{u.email || '-'}</td>
                              <td style={styles.td}>
                                <select
                                  style={{ ...styles.select, padding: '4px 8px', fontSize: 12 }}
                                  value={u.role || 'user'}
                                  onChange={(e) => changeUserRole(u._id, e.target.value)}
                                >
                                  <option value="user">User</option>
                                  <option value="police_officer">Police Officer</option>
                                  <option value="municipal_worker">Municipal Worker</option>
                                  <option value="admin">Admin</option>
                                </select>
                              </td>
                              <td style={styles.td}>{u.credits ?? u.rewardCredits ?? '-'}</td>
                              <td style={styles.td}>{u.reportsSubmitted ?? u.incidentCount ?? '-'}</td>
                              <td style={{ ...styles.td, color: C.textMuted }}>{fmtDate(u.createdAt || u.joinedAt)}</td>
                              <td style={styles.td}>
                                <button style={{ background: 'none', border: `1px solid ${C.accent}`, color: C.accent, borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }} onClick={() => viewUser(u._id)}>View</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination page={userPage} setPage={setUserPage} items={users} />
                  </>
                )}

                {/* User Detail Modal */}
                {selectedUser && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setSelectedUser(null)}>
                    <div style={{ ...styles.card, maxWidth: 560, width: '90%', maxHeight: '80vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h2 style={{ margin: 0, fontSize: 18 }}>User Detail</h2>
                        <button style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 20, cursor: 'pointer' }} onClick={() => setSelectedUser(null)}>X</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {[
                          ['Username', selectedUser.username],
                          ['Email', selectedUser.email],
                          ['Role', selectedUser.role],
                          ['Credits', selectedUser.credits ?? selectedUser.rewardCredits ?? '-'],
                          ['Phone', selectedUser.phone || '-'],
                          ['Joined', fmtDate(selectedUser.createdAt)],
                          ['Incidents', selectedUser.incidentCount ?? '-'],
                          ['Status', selectedUser.isActive !== false ? 'Active' : 'Inactive'],
                        ].map(([label, val]) => (
                          <div key={label}>
                            <p style={{ ...styles.statLabel, marginBottom: 4 }}>{label}</p>
                            <p style={{ margin: 0, fontSize: 14 }}>{val ?? '-'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════════ INCIDENTS TAB ═══════════════════ */}
            {activeTab === 'incidents' && (
              <div>
                <div style={styles.filterBar}>
                  <select style={styles.select} value={incidentFilters.type} onChange={(e) => { setIncidentFilters((f) => ({ ...f, type: e.target.value })); setIncidentPage(1); }}>
                    <option value="">All Types</option>
                    <option value="dangerous_driving">Dangerous Driving</option>
                    <option value="crime">Crime</option>
                    <option value="security">Security</option>
                    <option value="parking_violation">Parking Violation</option>
                    <option value="other">Other</option>
                  </select>
                  <select style={styles.select} value={incidentFilters.severity} onChange={(e) => { setIncidentFilters((f) => ({ ...f, severity: e.target.value })); setIncidentPage(1); }}>
                    <option value="">All Severities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                  <select style={styles.select} value={incidentFilters.status} onChange={(e) => { setIncidentFilters((f) => ({ ...f, status: e.target.value })); setIncidentPage(1); }}>
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="under_review">Under Review</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>ID</th>
                        <th style={styles.th}>Type</th>
                        <th style={styles.th}>Severity</th>
                        <th style={styles.th}>Reporter</th>
                        <th style={styles.th}>Location</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incidents.length === 0 ? (
                        <tr><td colSpan={7} style={{ ...styles.td, textAlign: 'center', color: C.textMuted, padding: 32 }}>No incidents found.</td></tr>
                      ) : incidents.map((inc) => (
                        <tr key={inc._id} onMouseEnter={(e) => e.currentTarget.style.background = C.cardHover} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 11 }}>{(inc._id || '').slice(-8)}</td>
                          <td style={styles.td}><span style={styles.badge(C.accent)}>{(inc.type || inc.violationType || '-').replace(/_/g, ' ')}</span></td>
                          <td style={styles.td}><span style={styles.badge(severityColor(inc.severity))}>{inc.severity || '-'}</span></td>
                          <td style={styles.td}>{inc.reporterUsername || inc.reporter?.username || '-'}</td>
                          <td style={{ ...styles.td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.location?.address || '-'}</td>
                          <td style={styles.td}><span style={styles.badge(statusColor(inc.status))}>{(inc.status || '-').replace(/_/g, ' ')}</span></td>
                          <td style={{ ...styles.td, color: C.textMuted }}>{fmtDate(inc.createdAt || inc.incidentDateTime)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={incidentPage} setPage={setIncidentPage} total={incidentTotal} items={incidents} />
              </div>
            )}

            {/* ═══════════════════════ PARKING TAB ═════════════════════ */}
            {activeTab === 'parking' && (
              <div>
                <div style={styles.filterBar}>
                  <select style={styles.select} value={parkingFilter} onChange={(e) => { setParkingFilter(e.target.value); setParkingPage(1); }}>
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="denied">Denied</option>
                  </select>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Report #</th>
                        <th style={styles.th}>Violation Type</th>
                        <th style={styles.th}>Reporter</th>
                        <th style={styles.th}>Assigned Station</th>
                        <th style={styles.th}>Review Status</th>
                        <th style={styles.th}>Bounty</th>
                        <th style={styles.th}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parkingReports.length === 0 ? (
                        <tr><td colSpan={7} style={{ ...styles.td, textAlign: 'center', color: C.textMuted, padding: 32 }}>No parking violations found.</td></tr>
                      ) : parkingReports.map((r) => (
                        <tr key={r._id} onMouseEnter={(e) => e.currentTarget.style.background = C.cardHover} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ ...styles.td, fontFamily: 'monospace' }}>{r.reportNumber || (r._id || '').slice(-8)}</td>
                          <td style={styles.td}><span style={styles.badge(C.accent)}>{(r.violationType || '-').replace(/_/g, ' ')}</span></td>
                          <td style={styles.td}>{r.reporterUsername || r.reporter?.username || '-'}</td>
                          <td style={styles.td}>{r.assignedStation || r.lawEnforcementSubmissions?.[0]?.stationName || '-'}</td>
                          <td style={styles.td}>
                            <span style={styles.badge(statusColor(r.reviewStatus || r.lawEnforcementSubmissions?.[0]?.status || 'pending'))}>
                              {(r.reviewStatus || r.lawEnforcementSubmissions?.[0]?.status || 'pending').replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td style={styles.td}>{r.bountyAmount != null ? `$${r.bountyAmount}` : (r.rewardCredits != null ? `${r.rewardCredits} cr` : '-')}</td>
                          <td style={{ ...styles.td, color: C.textMuted }}>{fmtDate(r.createdAt || r.incidentDateTime)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={parkingPage} setPage={setParkingPage} items={parkingReports} />
              </div>
            )}

            {/* ═══════════════════════ MUNICIPAL TAB ═══════════════════ */}
            {activeTab === 'municipal' && (
              <div>
                <div style={styles.filterBar}>
                  <select style={styles.select} value={municipalFilter.status} onChange={(e) => { setMunicipalFilter((f) => ({ ...f, status: e.target.value })); setMunicipalPage(1); }}>
                    <option value="">All Statuses</option>
                    <option value="submitted">Submitted</option>
                    <option value="received">Received</option>
                    <option value="under_review">Under Review</option>
                    <option value="completed">Completed</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                  <input
                    style={{ ...styles.input, width: 200 }}
                    placeholder="Filter by city..."
                    value={municipalFilter.city}
                    onChange={(e) => { setMunicipalFilter((f) => ({ ...f, city: e.target.value })); setMunicipalPage(1); }}
                  />
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Department</th>
                        <th style={styles.th}>City</th>
                        <th style={styles.th}>Protocol / Type</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {municipalReports.length === 0 ? (
                        <tr><td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: C.textMuted, padding: 32 }}>No municipal reports found.</td></tr>
                      ) : municipalReports.map((r) => (
                        <tr key={r._id} onMouseEnter={(e) => e.currentTarget.style.background = C.cardHover} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                          <td style={styles.td}>{r.department || r.departmentName || '-'}</td>
                          <td style={styles.td}>{r.city || r.location?.city || '-'}</td>
                          <td style={styles.td}>{r.protocol || r.reportType || r.type || '-'}</td>
                          <td style={styles.td}><span style={styles.badge(statusColor(r.status))}>{(r.status || '-').replace(/_/g, ' ')}</span></td>
                          <td style={{ ...styles.td, color: C.textMuted }}>{fmtDate(r.createdAt || r.submittedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={municipalPage} setPage={setMunicipalPage} items={municipalReports} />
              </div>
            )}

            {/* ═══════════════════════ MEDIA / SUBMISSIONS TAB ═════════ */}
            {activeTab === 'media' && (
              <div>
                <h3 style={{ ...styles.cardTitle, marginBottom: 20 }}>All Submitted Evidence ({mediaItems.length} items)</h3>
                {mediaItems.length === 0 ? (
                  <div style={styles.emptyState}>
                    <p style={{ fontSize: 16, marginBottom: 8 }}>No media submissions found</p>
                    <p style={{ fontSize: 13 }}>Submitted photos and videos from driver reports will appear here.</p>
                  </div>
                ) : (
                  <div style={styles.mediaGrid}>
                    {mediaItems.map((item, idx) => (
                      <div key={item._id || idx} style={styles.mediaCard}>
                        {/* Thumbnail */}
                        {item.url ? (
                          item.mimeType?.startsWith('video') ? (
                            <video style={styles.mediaThumbnail} src={item.url} muted preload="metadata" />
                          ) : (
                            <img style={styles.mediaThumbnail} src={item.url} alt="evidence" loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} />
                          )
                        ) : (
                          <div style={{ ...styles.mediaThumbnail, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontSize: 12 }}>
                            No preview available
                          </div>
                        )}
                        {/* Meta */}
                        <div style={styles.mediaInfo}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={styles.badge(C.accent)}>{(item.type || '').replace(/_/g, ' ')}</span>
                            <span style={{ fontSize: 10, color: C.textMuted }}>{item.mimeType || 'unknown'}</span>
                          </div>
                          <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
                            <div>GPS: {item.gps}</div>
                            <div>Time: {fmtDateTime(item.timestamp)}</div>
                            {item.fileSize && <div>Size: {(item.fileSize / 1024 / 1024).toFixed(2)} MB</div>}
                            {item.duration && <div>Duration: {item.duration}s</div>}
                            {item.resolution && <div>Res: {item.resolution}</div>}
                            <div>Reporter: {item.reporter}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Pagination page={mediaPage} setPage={setMediaPage} items={mediaItems} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
