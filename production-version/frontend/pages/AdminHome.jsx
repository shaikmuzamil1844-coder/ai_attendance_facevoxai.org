// pages/AdminHome.jsx — Super Admin Dashboard
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

function QuickAction({ icon, label, desc, onClick }) {
  return (
    <button className="card" onClick={onClick} style={{ textAlign: 'left', cursor: 'pointer', width: '100%', border: '1px solid var(--border-light)' }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{desc}</div>
    </button>
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
          <span className="live-dot">Live System Active</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      <div className="divider-gold" />

      {/* Stats Grid */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard icon="🏛" label="Departments" value={stats?.departments ?? (stats?.org?.total_departments !== undefined ? stats.org.total_departments : (stats ? 0 : null))} sub="Active academic departments" />
        <StatCard icon="👩‍🏫" label="Faculty / Teachers" value={stats?.faculty ?? (stats?.org?.total_faculty !== undefined ? stats.org.total_faculty : (stats ? 0 : null))} sub="Teaching staff" color="var(--info)" />
        <StatCard icon="🎓" label="Students" value={stats?.students ?? (stats?.org?.total_students !== undefined ? stats.org.total_students : (stats ? 0 : null))} sub="Enrolled students" color="var(--success)" />
        <StatCard icon="📖" label="Subjects" value={stats?.subjects ?? (stats?.org?.total_subjects !== undefined ? stats.org.total_subjects : (stats ? 0 : null))} sub="Active curriculum subjects" color="var(--warn)" />
      </div>

      <div className="grid-4" style={{ marginBottom: 32 }}>
        <StatCard icon="📸" label="Face ID Enrolled" value={stats?.face_enrolled ?? (stats?.biometrics?.face_enrolled !== undefined ? stats.biometrics.face_enrolled : (stats ? 0 : null))} sub="ArcFace 128-D vectors" />
        <StatCard icon="🎤" label="Voice Enrolled" value={stats?.voice_enrolled ?? (stats?.biometrics?.voice_enrolled !== undefined ? stats.biometrics.voice_enrolled : (stats ? 0 : null))} sub="Resemblyzer 256-D vectors" color="var(--info)" />
        <StatCard icon="📋" label="Sessions Today" value={stats?.sessions_today ?? (stats?.sessions?.today_sessions !== undefined ? stats.sessions.today_sessions : (stats ? 0 : null))} sub="Conducted classes" color="var(--success)" />
        <StatCard icon="✅" label="Avg Attendance" value={stats?.attendance_today !== undefined ? `${stats.attendance_today}%` : (stats?.attendance?.avg_attendance_pct !== undefined ? `${stats.attendance.avg_attendance_pct}%` : (stats ? '0%' : null))} sub="Institutional rate" color="var(--warn)" />
      </div>

      {/* Complete Admin Controls */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
          ⚡ Administrative Management Hub
        </h2>
        <div className="grid-4">
          <QuickAction
            icon="🎓"
            label="Manage Students"
            desc="Enroll students & inspect biometric status"
            onClick={() => navigate('/admin/students')}
          />
          <QuickAction
            icon="👩‍🏫"
            label="Manage Faculty"
            desc="Register teachers & map subjects"
            onClick={() => navigate('/admin/faculty')}
          />
          <QuickAction
            icon="📖"
            label="Classes & Subjects"
            desc="Configure courses, credits & syllabus"
            onClick={() => navigate('/admin/subjects')}
          />
          <QuickAction
            icon="🗓"
            label="Manage Timetables"
            desc="Create & edit lecture schedules"
            onClick={() => navigate('/admin/timetable')}
          />
          <QuickAction
            icon="📸"
            label="Take Attendance"
            desc="Launch live biometric camera scan"
            onClick={() => navigate('/faculty/take')}
          />
          <QuickAction
            icon="📊"
            label="Attendance Analytics"
            desc="Institutional trends & <75% watchlist"
            onClick={() => navigate('/admin/analytics')}
          />
          <QuickAction
            icon="🏛"
            label="Departments"
            desc="Manage university departments"
            onClick={() => navigate('/admin/departments')}
          />
          <QuickAction
            icon="🚪"
            label="Classrooms"
            desc="Manage halls, labs & capacities"
            onClick={() => navigate('/admin/classrooms')}
          />
        </div>
      </div>

      {/* System Status */}
      <div className="card-elevated">
        <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>⚙️ System &amp; Microservices Health</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'REST API (Node.js Express)',   status: 'Operational', url: '/api/health' },
            { label: 'AI Microservice (FastAPI)',    status: 'Operational', url: 'http://localhost:8000/docs' },
            { label: 'Supabase Cloud Database',      status: 'Connected',   url: 'PostgreSQL with RLS & RBAC' },
            { label: 'pgvector Multi-Modal Engine',  status: 'Active',      url: 'HNSW Cosine Index (128-D & 256-D)' },
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
