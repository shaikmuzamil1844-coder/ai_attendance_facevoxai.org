// pages/FacultyHome.jsx — Revamped Faculty Dashboard with Dedicated Feature Navigator
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/client';

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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

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

  const FEATURE_TILES = [
    {
      id: 'take_attendance',
      title: 'Take Live Attendance',
      subtitle: 'Multi-modal webcam & voice capture',
      icon: '📸',
      to: '/faculty/take',
      badge: 'Live',
    },
    {
      id: 'sessions',
      title: 'Class Sessions',
      subtitle: 'Manage active, live & past sessions',
      icon: '📋',
      to: '/faculty/sessions',
      badge: `${totalSessions} Sessions`,
    },
    {
      id: 'history',
      title: 'Attendance History & Logs',
      subtitle: 'Session-by-session student ledger',
      icon: '🕐',
      to: '/faculty/history',
      badge: 'Audit Log',
    },
    {
      id: 'subjects',
      title: 'My Assigned Subjects',
      subtitle: 'View curriculum & claim classes',
      icon: '📖',
      to: '/faculty/subjects',
      badge: `${subjects.length} Subjects`,
    },
    {
      id: 'students',
      title: 'My Enrolled Students',
      subtitle: 'Student directory & biometric status',
      icon: '🎓',
      to: '/faculty/students',
      badge: `${totalStudents} Students`,
    },
    {
      id: 'timetable',
      title: 'My Timetable',
      subtitle: 'Weekly teaching schedule & rooms',
      icon: '🗓️',
      to: '/faculty/timetable',
      badge: 'Schedule',
    },
    {
      id: 'analytics',
      title: 'Teaching Analytics',
      subtitle: 'Attendance rates & at-risk watchlists',
      icon: '📊',
      to: '/faculty/analytics',
      badge: `${atRisk.length} At-Risk`,
      badgeColor: atRisk.length > 0 ? 'badge-danger' : 'badge-success',
    },
    {
      id: 'profile',
      title: 'My Profile & Credentials',
      subtitle: 'Employee profile, email & security',
      icon: '👤',
      to: '/faculty/profile',
      badge: 'Profile',
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            👩‍🏫 Faculty Teaching Portal
          </div>
          <h1 className="page-title">{greeting}, {user?.fullName || 'Professor'} 👋</h1>
          <p className="page-subtitle">Track teaching sessions, conduct live multi-modal attendance, and access dedicated portal screens.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={() => navigate('/faculty/profile')}>
            👤 My Profile
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
          label="Sessions Today"
          value={loading ? null : sessionsToday}
          sub={`${totalSessions} total logged`}
          color="var(--success)"
        />
        <StatCard
          icon="⚠️"
          label="At-Risk (<75%)"
          value={loading ? null : atRisk.length}
          sub="Students needing attendance"
          color={atRisk.length > 0 ? 'var(--danger)' : 'var(--success)'}
        />
      </div>

      {/* ─── DEDICATED FEATURE PORTALS (MATCHING REFERENCE TILES) ─── */}
      <div style={{ marginBottom: 30 }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            📱 Teaching Feature Portals &amp; Dedicated Screens
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Click any feature below to open its dedicated management screen.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 16,
        }}>
          {FEATURE_TILES.map(tile => (
            <div
              key={tile.id}
              onClick={() => navigate(tile.to)}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '18px 20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--gold)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-light)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Rounded Green/Gold Icon badge */}
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(212, 160, 23, 0.2))',
                border: '1.5px solid var(--gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                flexShrink: 0,
              }}>
                {tile.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 700,
                  fontSize: 15,
                  color: 'var(--text-primary)',
                  fontFamily: 'Outfit, sans-serif',
                }}>
                  {tile.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tile.subtitle}
                </div>
              </div>

              <div style={{ fontSize: 16, color: 'var(--gold)', opacity: 0.7 }}>
                ›
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Biometric Readiness Summary Bar */}
      <div className="card-elevated" style={{ marginBottom: 24, padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              ⚡ Class Biometric Readiness
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Student cohort enrolled in your subjects with active facial geometry &amp; voice signatures.
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
    </div>
  );
}
