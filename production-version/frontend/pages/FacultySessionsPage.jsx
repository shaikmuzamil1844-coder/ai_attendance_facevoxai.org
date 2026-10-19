// pages/FacultySessionsPage.jsx — Dedicated Class Attendance Sessions Management
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/client';

export default function FacultySessionsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

  const loadSessions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/sessions?limit=50').catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : (res.data?.sessions || []);
      setSessions(list);
    } catch (err) {
      console.error('Failed to load faculty sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const filteredSessions = sessions.filter(s => {
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    if (search && !s.subject_name?.toLowerCase().includes(search.toLowerCase()) && !s.subject_code?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const liveCount = sessions.filter(s => s.status === 'live').length;
  const completedCount = sessions.filter(s => s.status === 'completed').length;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            📋 Class Session Management
          </div>
          <h1 className="page-title">Attendance Sessions</h1>
          <p className="page-subtitle">Inspect historical lecture sessions, live biometric attendance sessions, and student tallies.</p>
        </div>
        <button className="btn btn-gold btn-lg" onClick={() => navigate('/faculty/take')}>
          📸 Start New Attendance Session
        </button>
      </div>

      <div className="divider-gold" />

      {/* Filter Toolbar */}
      <div className="card-elevated" style={{ marginBottom: 20, padding: '14px 20px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="form-input"
          placeholder="🔍 Search subject name or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 260 }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Status:</span>
          <select
            className="form-input"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ width: 'auto', minWidth: 140, padding: '6px 12px', fontSize: 13 }}
          >
            <option value="all">All Sessions ({sessions.length})</option>
            <option value="live">Live Only ({liveCount})</option>
            <option value="completed">Completed Only ({completedCount})</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <span className="badge badge-success">Live: {liveCount}</span>
          <span className="badge badge-info">Completed: {completedCount}</span>
        </div>
      </div>

      {/* Table Card */}
      <div className="card-elevated">
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 50 }} />)}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h4>No attendance sessions found</h4>
            <p>
              {sessions.length === 0
                ? 'You haven’t conducted any attendance sessions yet. Start your first session now!'
                : 'No sessions matched the chosen filter.'}
            </p>
            <button className="btn btn-gold btn-sm" onClick={() => navigate('/faculty/take')} style={{ marginTop: 14 }}>
              📸 Start Live Attendance
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Session Date &amp; Time</th>
                  <th>Status</th>
                  <th>Students Present</th>
                  <th>Attendance %</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map(s => {
                  const present = parseInt(s.present_count ?? 0, 10);
                  const total = parseInt(s.total_marked ?? s.total_enrolled ?? present, 10);
                  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.subject_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.subject_code}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {s.session_date ? new Date(s.session_date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {s.start_time ? `${s.start_time.slice(0, 5)} hrs` : 'Standard'}
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-${s.status === 'live' ? 'success' : s.status === 'completed' ? 'muted' : 'warn'}`}>
                          {s.status === 'live' && '🔴 '}{s.status}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{present}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> / {total}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: pct >= 75 ? 'var(--success)' : pct >= 50 ? 'var(--warn)' : 'var(--danger)' }}>
                          {pct}%
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => navigate('/faculty/take')}
                          style={{ fontSize: 12, padding: '4px 10px' }}
                        >
                          📸 Scanner
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
