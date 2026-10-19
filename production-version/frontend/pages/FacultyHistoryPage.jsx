// pages/FacultyHistoryPage.jsx — Dedicated Biometric Verification & Student Attendance Logs for Teachers
import { useEffect, useState } from 'react';
import { api } from '../services/client';

export default function FacultyHistoryPage() {
  const [history, setHistory] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [histRes, subRes] = await Promise.all([
        api.get('/attendance/history?limit=100').catch(() => ({ data: [] })),
        api.get('/subjects').catch(() => ({ data: [] })),
      ]);
      setHistory(Array.isArray(histRes.data) ? histRes.data : []);
      setSubjects(Array.isArray(subRes.data) ? subRes.data : []);
    } catch (err) {
      console.error('Failed to load faculty history logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredHistory = history.filter(h => {
    if (filterSubject !== 'all' && h.subject_name !== filterSubject && h.subject_code !== filterSubject) return false;
    if (filterStatus !== 'all' && h.status !== filterStatus) return false;
    if (search && !h.student_name?.toLowerCase().includes(search.toLowerCase()) && !h.roll_number?.toLowerCase().includes(search.toLowerCase())) return false;
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
            🕐 Biometric Verification Ledger
          </div>
          <h1 className="page-title">Attendance Records &amp; Logs</h1>
          <p className="page-subtitle">Inspect timestamped biometric attendance verifications across all lecture sessions.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="badge badge-success">Present Events: {presentCount}</span>
          <span className="badge badge-danger">Absent Events: {absentCount}</span>
        </div>
      </div>

      <div className="divider-gold" />

      {/* Filter Toolbar */}
      <div className="card-elevated" style={{ marginBottom: 20, padding: '14px 20px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="form-input"
          placeholder="🔍 Search student name or roll number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Subject:</span>
          <select
            className="form-input"
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            style={{ width: 'auto', minWidth: 160, padding: '6px 12px', fontSize: 13 }}
          >
            <option value="all">All Subjects</option>
            {subjects.map(s => (
              <option key={s.id} value={s.name}>{s.code} — {s.name}</option>
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
            <option value="all">All Records</option>
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
            <div className="empty-icon">🕐</div>
            <h4>No attendance logs found</h4>
            <p>
              {history.length === 0
                ? 'Attendance verification records will appear here as soon as live sessions are concluded.'
                : 'No logs matched the selected filters.'}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Roll / Reg No</th>
                  <th>Subject</th>
                  <th>Date &amp; Time</th>
                  <th>Verification Method</th>
                  <th>Biometric Match</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((h, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{h.student_name || 'Enrolled Student'}</div>
                    </td>
                    <td>
                      <code style={{ color: 'var(--gold)' }}>{h.roll_number || 'N/A'}</code>
                    </td>
                    <td>
                      <div>{h.subject_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{h.subject_code}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>
                        {new Date(h.session_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {h.start_time ? `${h.start_time.slice(0, 5)} hrs` : 'Standard'}
                      </div>
                    </td>
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
