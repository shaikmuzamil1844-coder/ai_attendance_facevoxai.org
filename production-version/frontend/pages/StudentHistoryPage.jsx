// pages/StudentHistoryPage.jsx — Dedicated Biometric Attendance History & Verification Logs
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/client';

export default function StudentHistoryPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const studentId = user?.studentId;

  const loadHistory = async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get(`/attendance/history?studentId=${studentId}`).catch(() => ({ data: [] }));
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load attendance history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [studentId]);

  const uniqueSubjects = Array.from(new Set(history.map(h => h.subject_name).filter(Boolean)));

  const filteredHistory = history.filter(h => {
    if (filterSubject !== 'all' && h.subject_name !== filterSubject) return false;
    if (filterStatus !== 'all' && h.status !== filterStatus) return false;
    return true;
  });

  const presentCount = history.filter(h => h.status === 'present').length;
  const absentCount = history.filter(h => h.status === 'absent').length;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            📋 Biometric Audit Ledger
          </div>
          <h1 className="page-title">Attendance History &amp; Logs</h1>
          <p className="page-subtitle">Historical log of biometric lecture attendance verified via ArcFace and Resemblyzer embeddings.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="badge badge-success">Present: {presentCount}</span>
          <span className="badge badge-danger">Absent: {absentCount}</span>
        </div>
      </div>

      <div className="divider-gold" />

      {/* Filter Toolbar */}
      <div className="card-elevated" style={{ marginBottom: 20, padding: '14px 20px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Filter Subject:</span>
          <select
            className="form-input"
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            style={{ width: 'auto', minWidth: 160, padding: '6px 12px', fontSize: 13 }}
          >
            <option value="all">All Enrolled Subjects</option>
            {uniqueSubjects.map((sub, i) => (
              <option key={i} value={sub}>{sub}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Status:</span>
          <select
            className="form-input"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ width: 'auto', minWidth: 130, padding: '6px 12px', fontSize: 13 }}
          >
            <option value="all">All Events</option>
            <option value="present">Present Only</option>
            <option value="absent">Absent Only</option>
          </select>
        </div>

        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          Showing {filteredHistory.length} of {history.length} records
        </span>
      </div>

      {/* Table Card */}
      <div className="card-elevated">
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 48 }} />)}
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h4>No attendance logs found</h4>
            <p>
              {history.length === 0
                ? 'Your attendance events will appear here once your instructors record sessions.'
                : 'No attendance records match the selected filters.'}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Session Date &amp; Time</th>
                  <th>Faculty</th>
                  <th>Verification Method</th>
                  <th>Biometric Match</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((h, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {h.subject_name}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{h.subject_code}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>
                        {new Date(h.session_date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {h.start_time ? `${h.start_time.slice(0, 5)} hrs` : 'Standard Slot'}
                      </div>
                    </td>
                    <td>{h.faculty_name ? `👨‍🏫 ${h.faculty_name}` : '—'}</td>
                    <td>
                      <span className="badge badge-gold" style={{ textTransform: 'uppercase', fontSize: 11 }}>
                        {h.method === 'face'
                          ? '📸 Face ID'
                          : h.method === 'voice'
                            ? '🎙️ Voice'
                            : h.method === 'dual'
                              ? '⚡ Dual'
                              : '✋ Manual'}
                      </span>
                    </td>
                    <td>
                      {h.confidence !== null && h.confidence !== undefined ? (
                        <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                          {(parseFloat(h.confidence) * 100).toFixed(0)}% Match
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-${h.status === 'present' ? 'success' : 'danger'}`}>
                        {h.status === 'present' ? '✅ Present' : '❌ Absent'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
