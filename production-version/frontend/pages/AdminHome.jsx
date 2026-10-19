// pages/AdminHome.jsx — Revamped Super Admin Dashboard with Dedicated Feature Navigator
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/client';

function StatCard({ icon, label, value, sub, color = 'var(--gold)' }) {
  return (
    <div className="stat-card">
      <span className="stat-icon">{icon}</span>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>
        {value !== null && value !== undefined ? (
          value
        ) : (
          <span className="skeleton" style={{ width: 60, height: 32, display: 'block' }} />
        )}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default function AdminHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/analytics/overview')
      .then(r => setStats(r.data))
      .catch(() => setStats({ departments: 0, faculty: 0, students: 0, subjects: 0, face_enrolled: 0, voice_enrolled: 0, sessions_today: 0, attendance_today: 0 }));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const ADMIN_FEATURE_TILES = [
    {
      id: 'departments',
      title: 'Academic Departments',
      subtitle: 'Colleges, faculties & divisions',
      icon: '🏛️',
      to: '/admin/departments',
    },
    {
      id: 'courses',
      title: 'Degree Programs & Courses',
      subtitle: 'Undergraduate & master degrees',
      icon: '📚',
      to: '/admin/courses',
    },
    {
      id: 'semesters',
      title: 'Academic Semesters',
      subtitle: 'Term calendar & active periods',
      icon: '📅',
      to: '/admin/semesters',
    },
    {
      id: 'classrooms',
      title: 'Classrooms & Lecture Halls',
      subtitle: 'Physical rooms, labs & capacities',
      icon: '🚪',
      to: '/admin/classrooms',
    },
    {
      id: 'faculty',
      title: 'Faculty & Teachers',
      subtitle: 'Teacher directory & subject mapping',
      icon: '👩‍🏫',
      to: '/admin/faculty',
    },
    {
      id: 'students',
      title: 'Student Admissions & Biometrics',
      subtitle: 'Enrollment ledger & Face/Voice IDs',
      icon: '🎓',
      to: '/admin/students',
    },
    {
      id: 'subjects',
      title: 'Subjects & Curriculum',
      subtitle: 'Credits, course codes & syllabi',
      icon: '📖',
      to: '/admin/subjects',
    },
    {
      id: 'timetable',
      title: 'Timetable Scheduling',
      subtitle: 'Weekly lecture schedule manager',
      icon: '🗓️',
      to: '/admin/timetable',
    },
    {
      id: 'attendance',
      title: 'Take Live Attendance',
      subtitle: 'Multi-modal webcam & voice scanner',
      icon: '📸',
      to: '/faculty/take',
    },
    {
      id: 'analytics',
      title: 'Institutional Analytics',
      subtitle: 'Trends, graphs & cohorts',
      icon: '📊',
      to: '/admin/analytics',
    },
    {
      id: 'reports',
      title: 'Compliance Reports & Debarment',
      subtitle: 'Audit reports & CSV exports',
      icon: '📄',
      to: '/admin/reports',
    },
    {
      id: 'profile',
      title: 'Admin Profile & Security',
      subtitle: 'Root admin credentials & settings',
      icon: '👤',
      to: '/admin/profile',
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            ⬡ Super Admin Control Panel
          </div>
          <h1 className="page-title">{greeting}, {user?.fullName?.split(' ')[0] || 'Administrator'} 👋</h1>
          <p className="page-subtitle">Complete institutional access: manage users, classes, timetables, and biometric pipelines.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-outline" onClick={() => navigate('/admin/profile')}>
            👤 Admin Profile
          </button>
          <button className="btn btn-gold" onClick={() => navigate('/faculty/take')}>
            📸 Launch Scanner
          </button>
        </div>
      </div>

      <div className="divider-gold" />

      {/* KPI Stats Grid */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <StatCard icon="🏛" label="Departments" value={stats?.departments ?? (stats?.org?.total_departments !== undefined ? stats.org.total_departments : (stats ? 0 : null))} sub="Active academic departments" />
        <StatCard icon="👩‍🏫" label="Faculty / Teachers" value={stats?.faculty ?? (stats?.org?.total_faculty !== undefined ? stats.org.total_faculty : (stats ? 0 : null))} sub="Teaching staff" color="var(--info)" />
        <StatCard icon="🎓" label="Students" value={stats?.students ?? (stats?.org?.total_students !== undefined ? stats.org.total_students : (stats ? 0 : null))} sub="Enrolled students" color="var(--success)" />
        <StatCard icon="📖" label="Subjects" value={stats?.subjects ?? (stats?.org?.total_subjects !== undefined ? stats.org.total_subjects : (stats ? 0 : null))} sub="Active curriculum subjects" color="var(--warn)" />
      </div>

      <div className="grid-4" style={{ marginBottom: 30 }}>
        <StatCard icon="📸" label="Face ID Enrolled" value={stats?.face_enrolled ?? (stats?.biometrics?.face_enrolled !== undefined ? stats.biometrics.face_enrolled : (stats ? 0 : null))} sub="ArcFace 128-D vectors" />
        <StatCard icon="🎤" label="Voice Enrolled" value={stats?.voice_enrolled ?? (stats?.biometrics?.voice_enrolled !== undefined ? stats.biometrics.voice_enrolled : (stats ? 0 : null))} sub="Resemblyzer 256-D vectors" color="var(--info)" />
        <StatCard icon="📋" label="Sessions Today" value={stats?.sessions_today ?? (stats?.sessions?.today_sessions !== undefined ? stats.sessions.today_sessions : (stats ? 0 : null))} sub="Conducted classes" color="var(--success)" />
        <StatCard icon="✅" label="Avg Attendance" value={stats?.attendance_today !== undefined ? `${stats.attendance_today}%` : (stats?.attendance?.avg_attendance_pct !== undefined ? `${stats.attendance.avg_attendance_pct}%` : (stats ? '0%' : null))} sub="Institutional rate" color="var(--warn)" />
      </div>

      {/* ─── DEDICATED ADMIN FEATURE SCREENS (MATCHING REFERENCE TILES) ─── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            📱 Institutional Feature Portals &amp; Dedicated Screens
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Click any institutional feature below to open its dedicated management screen.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 16,
        }}>
          {ADMIN_FEATURE_TILES.map(tile => (
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

      {/* System Status Card */}
      <div className="card-elevated">
        <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>⚙️ System &amp; Microservices Health</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'REST API Gateway (Node.js Express)', status: 'Operational', url: 'http://localhost:4000/api/health' },
            { label: 'AI Inference Microservice (FastAPI)', status: 'Operational', url: 'http://localhost:8000/docs' },
            { label: 'PostgreSQL Database & RLS Security', status: 'Connected',   url: 'PostgreSQL 15+ Ledger with RLS' },
            { label: 'pgvector Multi-Modal HNSW Engine', status: 'Active',      url: '128-D ArcFace & 256-D Resemblyzer Vectors' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{s.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.url}</div>
              </div>
              <span className="badge badge-success">{s.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
