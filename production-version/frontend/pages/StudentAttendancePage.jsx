// pages/StudentAttendancePage.jsx — Dedicated Subject-Wise & Cumulative Attendance Analytics
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/client';

export default function StudentAttendancePage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const studentId = user?.studentId;

  const loadData = async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const summaryRes = await api.get(`/students/${studentId}/attendance-summary`).catch(() => ({ data: { summary: [] } }));
      setSummary(summaryRes.data?.summary || []);
    } catch (err) {
      console.error('Failed to load attendance summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [studentId]);

  // Overall attendance calculation
  const overallPct = summary.length > 0
    ? Math.round(summary.reduce((s, x) => s + parseFloat(x.attendance_pct || 0), 0) / summary.length)
    : null;

  const totalSessions = summary.reduce((s, x) => s + (parseInt(x.total_sessions || 0, 10)), 0);
  const totalAttended = summary.reduce((s, x) => s + (parseInt(x.attended || 0, 10)), 0);

  const pctColor = overallPct === null
    ? 'var(--gold)'
    : overallPct >= 75
      ? 'var(--success)'
      : overallPct >= 60
        ? 'var(--warn)'
        : 'var(--danger)';

  const isAtRisk = overallPct !== null && overallPct < 75;

  const filteredSummary = summary.filter(s =>
    !search ||
    s.subject_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.subject_code?.toLowerCase().includes(search.toLowerCase()) ||
    s.faculty_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            📊 Academic Attendance Telemetry
          </div>
          <h1 className="page-title">Subject-Wise Attendance</h1>
          <p className="page-subtitle">Track your attendance progress and mandatory 75% institutional compliance requirement.</p>
        </div>
        <Link to="/student/enroll" className="btn btn-gold btn-sm">
          + Enroll New Subject
        </Link>
      </div>

      <div className="divider-gold" />

      {/* ⚠️ Attendance Threshold Warning Banner */}
      {isAtRisk && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--danger)',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--danger)', marginBottom: 4 }}>
              ATTENDANCE WARNING: BELOW 75% MINIMUM ELIGIBILITY THRESHOLD
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Your overall cumulative attendance is currently at <strong>{overallPct}%</strong>, which is below the mandatory <strong>75%</strong> requirement.
              Students with attendance under 75% are at risk of exam debarment. Please attend upcoming lectures to maintain compliance.
            </div>
          </div>
        </div>
      )}

      {/* Cumulative Attendance Summary Gauge */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card-elevated" style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{
            width: 110, height: 110, borderRadius: '50%',
            border: `5px solid ${pctColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: `0 0 25px ${pctColor}30`,
          }}>
            <span style={{ fontFamily: 'Outfit', fontSize: 30, fontWeight: 900, color: pctColor }}>
              {overallPct !== null ? `${overallPct}%` : '—'}
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Cumulative Attendance</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              {overallPct === null
                ? 'No sessions recorded yet'
                : overallPct >= 75
                  ? '✅ Excellent! You meet institutional exam eligibility criteria.'
                  : overallPct >= 60
                    ? '⚠️ Warning: Attendance below required 75% threshold.'
                    : '🚨 Critical: Risk of exam debarment. Attend upcoming sessions.'}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className={`badge badge-${overallPct === null ? 'muted' : overallPct >= 75 ? 'success' : overallPct >= 60 ? 'warn' : 'danger'}`}>
                {summary.length} Enrolled Subject(s)
              </span>
              <span className={`badge badge-${overallPct >= 75 ? 'success' : 'danger'}`}>
                {overallPct >= 75 ? 'Exam Eligible' : 'At-Risk Debarment'}
              </span>
            </div>
          </div>
        </div>

        {/* Aggregate Stats Card */}
        <div className="card-elevated" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
          <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)', margin: 0 }}>
            📈 Session Statistics
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div style={{ background: 'var(--bg-base)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Sessions Held</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{totalSessions}</div>
            </div>
            <div style={{ background: 'var(--bg-base)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sessions Attended</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>{totalAttended}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Institutional Policy: <strong>75%</strong> minimum attendance is required per subject to qualify for end-semester examinations.
          </div>
        </div>
      </div>

      {/* Subject-Wise Breakdown List */}
      <div className="card-elevated">
        <div className="page-header" style={{ marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>📚 Subject Breakdown</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>Individual lecture attendance progress per registered course</p>
          </div>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Search subject or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 260 }}
          />
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60 }} />)}
          </div>
        ) : filteredSummary.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <h4>{search ? 'No matching subjects found' : 'No enrolled subjects found'}</h4>
            <p>{search ? 'Try clearing your search query.' : 'You haven’t enrolled in any subjects yet. Enroll with a subject code or browse your catalog.'}</p>
            {!search && (
              <Link to="/student/enroll" className="btn btn-gold btn-sm" style={{ marginTop: 12 }}>
                + Browse &amp; Enroll Subjects
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredSummary.map((s, i) => {
              const pct = parseFloat(s.attendance_pct || 0);
              const col = pct >= 75 ? 'var(--success)' : pct >= 60 ? 'var(--warn)' : 'var(--danger)';
              const total = parseInt(s.total_sessions || 0, 10);
              const attended = parseInt(s.attended || 0, 10);

              // Calculate needed lectures to reach 75%
              // (attended + x) / (total + x) >= 0.75 => x >= (0.75 * total - attended) / 0.25
              const needed = pct < 75 ? Math.max(0, Math.ceil((0.75 * total - attended) / 0.25)) : 0;

              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{s.subject_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>
                        {s.faculty_name ? `👨‍🏫 ${s.faculty_name}` : 'Faculty Assigned'}
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>Code: <code style={{ color: 'var(--gold)' }}>{s.subject_code}</code></span>
                      <span>•</span>
                      <span>Attended <strong>{attended}</strong> of <strong>{total}</strong> sessions</span>
                      {pct < 75 && needed > 0 && (
                        <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                          (Need to attend next {needed} class{needed > 1 ? 'es' : ''} to reach 75%)
                        </span>
                      )}
                    </div>

                    <div className="progress-bar-track" style={{ marginTop: 10, height: 8 }}>
                      <div className="progress-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: col, transition: 'width 1s ease' }} />
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 90 }}>
                    <div style={{ fontFamily: 'Outfit', fontSize: 24, fontWeight: 800, color: col }}>
                      {pct.toFixed(1)}%
                    </div>
                    <span className={`badge badge-${pct >= 75 ? 'success' : pct >= 60 ? 'warn' : 'danger'}`} style={{ marginTop: 4 }}>
                      {pct >= 75 ? 'Compliant' : pct >= 60 ? 'At Risk' : 'Debarred'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
