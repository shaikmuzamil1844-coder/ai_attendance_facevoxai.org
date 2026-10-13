// pages/FacultyHome.jsx — Faculty & Teacher Dashboard
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/client';
import { useNavigate } from 'react-router-dom';

function StatCard({ icon, label, value, sub, color = 'var(--gold)' }) {
  return (
    <div className="stat-card">
      <span className="stat-icon">{icon}</span>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value ?? '—'}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default function FacultyHome() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [atRisk, setAtRisk] = useState([]);
  const [loading, setLoading] = useState(true);

  // Subject self-assignment modal state for new faculty members
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [allSubjects, setAllSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [sectionCode, setSectionCode] = useState('A');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [sessRes, subRes, studRes, riskRes] = await Promise.all([
        api.get('/attendance/sessions?limit=10').catch(() => ({ data: [] })),
        api.get('/subjects').catch(() => ({ data: [] })),
        api.get('/students').catch(() => ({ data: [] })),
        api.get('/analytics/at-risk').catch(() => ({ data: { students: [] } })),
      ]);

      const sessList = Array.isArray(sessRes.data) ? sessRes.data : (sessRes.data?.sessions || []);
      setSessions(sessList);
      setSubjects(Array.isArray(subRes.data) ? subRes.data : []);
      setStudents(Array.isArray(studRes.data) ? studRes.data : []);
      setAtRisk(riskRes.data?.students || []);
    } catch (err) {
      console.error('Failed to load faculty dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAssignModal = async () => {
    setAssignError('');
    setShowAssignModal(true);
    try {
      const res = await api.get('/subjects?all=true');
      const list = Array.isArray(res.data) ? res.data : [];
      setAllSubjects(list);
      if (list.length > 0) {
        setSelectedSubjectId(list[0].id);
      }
    } catch (err) {
      setAssignError('Failed to load catalog subjects.');
    }
  };

  const handleAssignSubject = async (e) => {
    e.preventDefault();
    if (!selectedSubjectId) return;
    setAssignLoading(true);
    setAssignError('');
    try {
      await api.post(`/subjects/${selectedSubjectId}/assign-faculty`, {
        facultyId: user?.facultyId,
        section: sectionCode.trim() || 'A',
      });
      setShowAssignModal(false);
      loadData();
    } catch (err) {
      setAssignError(err.response?.data?.error || 'Failed to assign subject.');
    } finally {
      setAssignLoading(false);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Metrics calculation
  const totalStudents = students.length;
  const faceEnrolledCount = students.filter(s => s.face_enrolled).length;
  const voiceEnrolledCount = students.filter(s => s.voice_enrolled).length;

  const totalSessions = sessions.length;
  const sessionsToday = sessions.filter(s => {
    if (!s.session_date) return false;
    const d = new Date(s.session_date).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    return d === today;
  }).length;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            👩‍🏫 Faculty Teaching Portal
          </div>
          <h1 className="page-title">{greeting}, {user?.fullName || 'Professor'} 👋</h1>
          <p className="page-subtitle">Manage your assigned classes, take biometric attendance, and inspect student progress.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={() => navigate('/faculty/timetable')}>
            🗓 My Timetable
          </button>
          <button className="btn btn-gold btn-lg" onClick={() => navigate('/faculty/take')}>
            📸 Start Live Attendance
          </button>
        </div>
      </div>

      <div className="divider-gold" />

      {/* KPI Stats Grid */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard
          icon="📖"
          label="My Subjects"
          value={loading ? null : subjects.length}
          sub="Assigned teaching classes"
          color="var(--gold)"
        />
        <StatCard
          icon="🎓"
          label="Enrolled Students"
          value={loading ? null : totalStudents}
          sub={`${faceEnrolledCount} Face · ${voiceEnrolledCount} Voice`}
          color="var(--info)"
        />
        <StatCard
          icon="📋"
          label="Sessions Conducted"
          value={loading ? null : totalSessions}
          sub={`${sessionsToday} session(s) today`}
          color="var(--success)"
        />
        <StatCard
          icon="⚠️"
          label="At-Risk (<75%)"
          value={loading ? null : atRisk.length}
          sub="Students needing attention"
          color={atRisk.length > 0 ? 'var(--danger)' : 'var(--success)'}
        />
      </div>

      {/* Biometric Readiness Summary Bar */}
      <div className="card-elevated" style={{ marginBottom: 24, padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              ⚡ Class Biometric Readiness
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Students enrolled in your subjects with facial geometry &amp; voice signatures active.
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/faculty/students')}>
            View Enrolled Students →
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div style={{ background: 'var(--bg-base)', padding: 12, borderRadius: 8, border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span>📸 Face Recognition Ready</span>
              <strong style={{ color: 'var(--success)' }}>
                {totalStudents > 0 ? Math.round((faceEnrolledCount / totalStudents) * 100) : 0}%
              </strong>
            </div>
            <div className="progress-bar-track" style={{ height: 6 }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${totalStudents > 0 ? (faceEnrolledCount / totalStudents) * 100 : 0}%`,
                  background: 'var(--success)',
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {faceEnrolledCount} of {totalStudents} students
            </div>
          </div>

          <div style={{ background: 'var(--bg-base)', padding: 12, borderRadius: 8, border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span>🎙️ Voice Print Ready</span>
              <strong style={{ color: 'var(--info)' }}>
                {totalStudents > 0 ? Math.round((voiceEnrolledCount / totalStudents) * 100) : 0}%
              </strong>
            </div>
            <div className="progress-bar-track" style={{ height: 6 }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${totalStudents > 0 ? (voiceEnrolledCount / totalStudents) * 100 : 0}%`,
                  background: 'var(--info)',
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {voiceEnrolledCount} of {totalStudents} students
            </div>
          </div>
        </div>
      </div>

      {/* Assigned Subjects Table */}
      <div className="card-elevated" style={{ marginBottom: 24 }}>
        <div className="page-header" style={{ marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>📖 My Assigned Subjects &amp; Classes</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              You have permission to take and mark attendance for these assigned subjects.
            </p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={handleOpenAssignModal}>
            + Add / Claim Subject
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 50 }} />)}
          </div>
        ) : subjects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📖</div>
            <h4>No subjects assigned yet</h4>
            <p>Your academic coordinator can assign subjects, or you can self-claim a subject right now.</p>
            <button className="btn btn-gold btn-sm" onClick={handleOpenAssignModal} style={{ marginTop: 12 }}>
              + Assign Subject to My Profile
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Subject Code</th>
                  <th>Subject Name</th>
                  <th>Course / Program</th>
                  <th>Semester</th>
                  <th>Enrolled Students</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map(s => (
                  <tr key={s.id}>
                    <td>
                      <code style={{ color: 'var(--gold)', fontWeight: 700 }}>{s.code}</code>
                    </td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{s.name}</td>
                    <td>{s.course_name || '—'}</td>
                    <td>{s.semester_name || 'Active'}</td>
                    <td>
                      <span className="badge badge-gold">
                        {s.student_count ?? totalStudents} Student(s)
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-gold btn-sm"
                        onClick={() => navigate('/faculty/take')}
                        style={{ fontSize: 12, padding: '4px 12px' }}
                      >
                        📸 Take Attendance
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Attendance Sessions */}
      <div className="card-elevated" style={{ marginBottom: 24 }}>
        <div className="page-header" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>📋 Recent Class Sessions</h3>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/faculty/take')}>
            Launch Live Session
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 50 }} />)}
          </div>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h4>No attendance sessions logged yet</h4>
            <p>Start your first biometric session using the button above.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Session Date</th>
                  <th>Status</th>
                  <th>Present / Total</th>
                  <th>Attendance %</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => {
                  const present = parseInt(s.present_count ?? 0, 10);
                  const total = parseInt(s.total_marked ?? s.total_enrolled ?? present, 10);
                  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
                  return (
                    <tr key={s.id}>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{s.subject_name}</td>
                      <td>{s.session_date ? new Date(s.session_date).toLocaleDateString() : '—'}</td>
                      <td>
                        <span className={`badge badge-${s.status === 'live' ? 'success' : s.status === 'completed' ? 'muted' : 'warn'}`}>
                          {s.status === 'live' && '🔴 '}{s.status}
                        </span>
                      </td>
                      <td>{present} / {total}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: pct >= 75 ? 'var(--success)' : 'var(--danger)' }}>
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Launch Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(212,160,23,0.12), rgba(212,160,23,0.03))',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        flexWrap: 'wrap',
      }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
            🚀 Ready for your next class?
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Biometric verification scans faces and voices instantly with passive anti-spoofing protections.
          </p>
        </div>
        <button className="btn btn-gold btn-lg" onClick={() => navigate('/faculty/take')}>
          📸 Open Live Scanner
        </button>
      </div>

      {/* Subject Assignment Modal for Faculty */}
      {showAssignModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 className="modal-title">📖 Assign Subject to My Teaching Schedule</h3>
              <button className="btn-icon" onClick={() => setShowAssignModal(false)}>✕</button>
            </div>

            {assignError && (
              <div className="alert alert-danger" style={{ marginBottom: 16 }}>
                ⚠️ {assignError}
              </div>
            )}

            <form onSubmit={handleAssignSubject}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  Select an academic subject to assign to your teaching portfolio so you can conduct attendance and monitor student progress.
                </p>

                <div className="form-group">
                  <label className="form-label">Select Subject *</label>
                  <select
                    className="form-input"
                    value={selectedSubjectId}
                    onChange={e => setSelectedSubjectId(e.target.value)}
                    required
                  >
                    {allSubjects.length === 0 ? (
                      <option value="">No subjects found</option>
                    ) : (
                      allSubjects.map(sub => (
                        <option key={sub.id} value={sub.id}>
                          {sub.code} — {sub.name} ({sub.course_name || 'General'})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Class Section *</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g. A or Section-1"
                    value={sectionCode}
                    onChange={e => setSectionCode(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowAssignModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-gold"
                  disabled={assignLoading || allSubjects.length === 0}
                >
                  {assignLoading ? 'Assigning…' : '✅ Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
