// pages/StudentHome.jsx — Clean Student Dashboard Focused on Attendance & Quick Feature Navigation
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/client';

export default function StudentHome() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  // Quick dialogs
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);

  const studentId = user?.studentId;

  const loadData = async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [profileRes, summaryRes] = await Promise.all([
        api.get(`/students/${studentId}`).catch(() => ({ data: null })),
        api.get(`/students/${studentId}/attendance-summary`).catch(() => ({ data: { summary: [] } })),
      ]);

      setProfile(profileRes.data);
      setSummary(summaryRes.data?.summary || []);
    } catch (err) {
      console.error('Failed to load student dashboard:', err);
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
  const studentName = profile?.name || user?.fullName || 'Student';

  // Feature menu items matching user reference images
  const FEATURE_TILES = [
    {
      id: 'subject_attendance',
      title: 'Subject Wise Attendance',
      subtitle: 'Individual lecture % and subject thresholds',
      icon: '📊',
      to: '/student/attendance',
      badge: `${summary.length} Subjects`,
    },
    {
      id: 'timetable',
      title: 'Class Timetable',
      subtitle: 'Weekly lecture schedule & classrooms',
      icon: '🗓️',
      to: '/student/timetable',
      badge: 'Schedule',
    },
    {
      id: 'profile',
      title: 'My Profile & Biometrics',
      subtitle: 'Identity details, Face ID & Voice print',
      icon: '👤',
      to: '/student/profile',
      badge: profile?.face_enrolled && profile?.voice_enrolled ? 'Enrolled' : 'Action Needed',
      badgeColor: profile?.face_enrolled && profile?.voice_enrolled ? 'badge-success' : 'badge-warn',
    },
    {
      id: 'enroll',
      title: 'Course List & Enroll',
      subtitle: 'Browse semester subjects & join codes',
      icon: '📝',
      to: '/student/enroll',
      badge: 'Catalog',
    },
    {
      id: 'history',
      title: 'Hour & Session Attendance',
      subtitle: 'Timestamped biometric verification log',
      icon: '🕐',
      to: '/student/history',
      badge: 'Ledger',
    },
    {
      id: 'faculty',
      title: 'My Teachers & Instructors',
      subtitle: 'Assigned professors & email contacts',
      icon: '👨‍🏫',
      to: '/student/faculty',
      badge: 'Faculty',
    },
    {
      id: 'notifications',
      title: 'Campus Notifications',
      subtitle: 'Institutional announcements & alerts',
      icon: '🔔',
      onClick: () => setShowNotificationsModal(true),
      badge: 'Active',
    },
    {
      id: 'security',
      title: 'Change Password & Security',
      subtitle: 'Account credentials & biometric access',
      icon: '🔐',
      to: '/student/profile',
      badge: 'Security',
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            🎓 Student Attendance &amp; Academic Dashboard
          </div>
          <h1 className="page-title">Welcome, {studentName} 👋</h1>
          <p className="page-subtitle">
            {profile?.course_name ? `${profile.course_name} · ` : ''}
            {profile?.dept_name || 'Department of Technology'} ·{' '}
            {profile?.sem_name || 'Active Semester'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link to="/student/profile" className="btn btn-outline btn-sm">
            👤 View Profile
          </Link>
          <Link to="/student/attendance" className="btn btn-gold btn-sm">
            📊 View Full Attendance
          </Link>
        </div>
      </div>

      <div className="divider-gold" />

      {/* ⚠️ Attendance Warning Alert Banner */}
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
              Students with attendance under 75% are at risk of exam debarment.
            </div>
          </div>
          <Link to="/student/attendance" className="btn btn-danger btn-sm" style={{ whiteSpace: 'nowrap' }}>
            Check Subjects
          </Link>
        </div>
      )}

      {/* ─── SECTION 1: ATTENDANCE DETAILS AT DASHBOARD ─── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            📈 Attendance Summary
          </h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Mandatory requirement: 75%</span>
        </div>

        {loading ? (
          <div className="grid-2">
            <div className="card skeleton" style={{ height: 160 }} />
            <div className="card skeleton" style={{ height: 160 }} />
          </div>
        ) : (
          <div className="grid-2">
            {/* Cumulative Gauge Card */}
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
                    ? 'No lecture sessions recorded yet'
                    : overallPct >= 75
                      ? '✅ Exam Eligible — You meet all institutional attendance guidelines.'
                      : overallPct >= 60
                        ? '⚠️ At-Risk — Attendance is below the required 75% threshold.'
                        : '🚨 Debarment Risk — Attendance critically below requirements.'}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className={`badge badge-${overallPct === null ? 'muted' : overallPct >= 75 ? 'success' : overallPct >= 60 ? 'warn' : 'danger'}`}>
                    {overallPct !== null ? `${overallPct}% Overall` : 'Pending'}
                  </span>
                  <span className={`badge badge-${overallPct >= 75 ? 'success' : 'danger'}`}>
                    {overallPct >= 75 ? 'Exam Eligible' : 'At-Risk Debarment'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Metrics & Biometrics Card */}
            <div className="card-elevated" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)', margin: '0 0 10px 0' }}>
                  🎯 Academic Snapshot
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <div style={{ background: 'var(--bg-base)', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Subjects</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                      {summary.length}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-base)', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sessions</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                      {totalSessions}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-base)', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Attended</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)', marginTop: 2 }}>
                      {totalAttended}
                    </div>
                  </div>
                </div>
              </div>

              {/* Biometric Status Summary */}
              <div style={{
                background: 'var(--bg-base)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Biometrics: {profile?.face_enrolled ? '📸 Face Active' : '📸 Face Missing'} · {profile?.voice_enrolled ? '🎙️ Voice Active' : '🎙️ Voice Missing'}
                </div>
                <Link to="/student/profile" style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>
                  Manage →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── SECTION 2: DEDICATED FEATURE SCREENS (REFERENCE STYLE TILES) ─── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              📱 Feature Portals &amp; Dedicated Screens
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Select any feature below to view its isolated, dedicated screen without distraction.
            </p>
          </div>
        </div>

        {/* Feature Grid Inspired by Mobile Portal Architecture */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 16,
        }}>
          {FEATURE_TILES.map(tile => (
            <div
              key={tile.id}
              onClick={() => {
                if (tile.onClick) {
                  tile.onClick();
                } else if (tile.to) {
                  navigate(tile.to);
                }
              }}
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
                position: 'relative',
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
              {/* Rounded Green/Gold Icon badge like in reference app */}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    fontWeight: 700,
                    fontSize: 15,
                    color: 'var(--text-primary)',
                    fontFamily: 'Outfit, sans-serif',
                  }}>
                    {tile.title}
                  </div>
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

      {/* ─── SECTION 3: TOUCHLESS ATTENDANCE EXPLANATION CARD ─── */}
      <div className="card-elevated" style={{ borderLeft: '4px solid var(--gold)' }}>
        <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)', margin: '0 0 8px 0' }}>
          💡 How FaceVoxAI Touchless Biometrics Works
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
          <div>
            <strong>1. Teacher Starts Session</strong>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              During class, your instructor launches the live camera stream on the classroom display.
            </p>
          </div>
          <div>
            <strong>2. Instant Multi-Modal Matching</strong>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              ArcFace 128-D facial vectors and Resemblyzer voice prints are checked against pgvector HNSW indexes in sub-seconds.
            </p>
          </div>
          <div>
            <strong>3. Automatic Ledger Entry</strong>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Attendance is immediately logged to your attendance history and subject percentage is updated in real time.
            </p>
          </div>
        </div>
      </div>

      {/* ─── MODAL: Campus Notifications ─── */}
      {showNotificationsModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: 18, color: 'var(--gold)', fontWeight: 800 }}>🔔 Campus Notifications</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowNotificationsModal(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <div style={{ background: 'var(--bg-base)', padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>End-Semester Attendance Cutoff</strong>
                  <span style={{ fontSize: 11, color: 'var(--gold)' }}>Notice</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                  All students must ensure a minimum of 75% attendance in each enrolled subject before the final assessment week.
                </p>
              </div>

              <div style={{ background: 'var(--bg-base)', padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>Biometric Identity Verification</strong>
                  <span style={{ fontSize: 11, color: 'var(--success)' }}>Info</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                  Please ensure your Face ID and Voice Print are enrolled in <strong>My Profile</strong> to enable frictionless touchless attendance.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-gold btn-sm" onClick={() => setShowNotificationsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
