// pages/HodHome.jsx — HOD Dashboard
import { useEffect, useState } from 'react';
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

export default function HodHome() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [atRisk,  setAtRisk]  = useState([]);

  useEffect(() => {
    api.get('/analytics/department-summary').then(r => setSummary(r.data)).catch(() => {});
    api.get('/analytics/at-risk?threshold=75').then(r => setAtRisk(r.data.students || [])).catch(() => {});
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>🏛 HOD Dashboard</div>
          <h1 className="page-title">Department Overview</h1>
          <p className="page-subtitle">Monitor your department's academic performance and attendance health.</p>
        </div>
        <span className="badge badge-gold">HOD · {user?.fullName}</span>
      </div>

      <div className="divider-gold" />

      <div className="grid-4" style={{ marginBottom: 28 }}>
        <StatCard icon="👩‍🏫" label="Faculty"         value={summary?.faculty_count}      sub="Active faculty"       />
        <StatCard icon="🎓" label="Students"          value={summary?.student_count}      sub="Enrolled"            color="var(--success)" />
        <StatCard icon="📖" label="Subjects"          value={summary?.subject_count}      sub="This semester"       color="var(--info)" />
        <StatCard icon="✅" label="Dept Attendance"   value={summary?.avg_attendance ? `${summary.avg_attendance}%` : '—'} sub="Avg this semester" color="var(--warn)" />
      </div>

      {/* At-Risk Students */}
      <div className="card-elevated">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>
            ⚠️ At-Risk Students
            {atRisk.length > 0 && <span className="badge badge-danger" style={{ marginLeft: 10 }}>{atRisk.length}</span>}
          </h3>
        </div>

        {atRisk.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <h4>All students on track!</h4>
            <p>No students below 75% attendance threshold.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Student</th><th>Roll No</th><th>Subject</th><th>Attendance %</th><th>Action</th></tr>
              </thead>
              <tbody>
                {atRisk.map((s, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{s.student_name}</td>
                    <td>{s.roll_number}</td>
                    <td>{s.subject_name}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-bar-track" style={{ width: 60 }}>
                          <div className="progress-bar-fill" style={{ width: `${s.attendance_pct}%`, background: s.attendance_pct < 60 ? 'var(--danger)' : 'var(--warn)' }} />
                        </div>
                        <span style={{ color: s.attendance_pct < 60 ? 'var(--danger)' : 'var(--warn)', fontWeight: 700, fontSize: 13 }}>
                          {s.attendance_pct}%
                        </span>
                      </div>
                    </td>
                    <td><span className="badge badge-danger">Notify</span></td>
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
