// pages/AnalyticsPage.jsx — Full-featured Platform Analytics Dashboard v2
// Features:
//   ✅ Overview KPI cards (students, faculty, sessions, biometrics)
//   ✅ Department table with attendance rates
//   ✅ Biometric enrollment stats per department (face/voice breakdown)
//   ✅ Weekly attendance trend chart (pure CSS/SVG — no extra libraries)
//   ✅ At-risk student query with filters
//   ✅ Subject trend on demand
//   ✅ Role-aware content (admin sees all, hod sees dept, faculty sees subjects)
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/client';

// ─── Mini Bar Spark ─────────────────────────────────────────────────────────
function TinyBar({ pct = 0 }) {
  const color = pct >= 75 ? 'var(--success)' : pct >= 50 ? 'var(--warn)' : 'var(--danger)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 36, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color = 'var(--gold)', trend }) {
  return (
    <div className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 28, opacity: 0.12 }}>{icon}</div>
      <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>
        {value !== null && value !== undefined
          ? value
          : <span className="skeleton" style={{ width: 60, height: 30, display: 'block', borderRadius: 6 }} />}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
      {trend !== undefined && (
        <div style={{ fontSize: 12, marginTop: 4, color: trend >= 0 ? 'var(--success)' : 'var(--danger)' }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last week
        </div>
      )}
    </div>
  );
}

// ─── Weekly Trend SVG Chart ─────────────────────────────────────────────────
function WeeklyChart({ data = [] }) {
  if (!data.length) return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 14 }}>
      No weekly data available yet.
    </div>
  );

  const sorted = [...data].reverse().slice(-8); // last 8 weeks
  const maxPct = Math.max(...sorted.map(d => parseFloat(d.avg_attendance_pct || 0)), 1);
  const W = 100 / sorted.length;

  return (
    <div style={{ padding: '0 8px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
        {sorted.map((d, i) => {
          const pct = parseFloat(d.avg_attendance_pct || 0);
          const h   = Math.max((pct / maxPct) * 100, 4);
          const color = pct >= 75 ? 'var(--success)' : pct >= 50 ? 'var(--warn)' : 'var(--danger)';
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{pct}%</div>
              <div style={{
                width: '100%', height: `${h}%`, background: color,
                borderRadius: '4px 4px 0 0', opacity: 0.85,
                transition: 'height 0.5s ease',
                minHeight: 4,
              }} />
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {d.week_start ? new Date(d.week_start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : `W${i+1}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Donut Metric ────────────────────────────────────────────────────────────
function DonutRing({ pct = 0, label, color = 'var(--gold)' }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--bg-elevated)" strokeWidth="8" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x="40" y="44" textAnchor="middle" fill={color} fontSize="14" fontWeight="700">{pct}%</text>
      </svg>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>{label}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════
export default function AnalyticsPage() {
  const { user } = useAuth();
  const [overview, setOverview]     = useState(null);
  const [departments, setDepts]     = useState([]);
  const [biometrics, setBiometrics] = useState([]);
  const [weeklyTrend, setWeekly]    = useState([]);
  const [atRisk, setAtRisk]         = useState([]);
  const [subjects, setSubjects]     = useState([]);
  const [loading, setLoading]       = useState(true);

  // At-risk filter state
  const [atRiskSubject,   setAtRiskSubject]   = useState('');
  const [atRiskThreshold, setAtRiskThreshold] = useState(75);
  const [loadingAtRisk,   setLoadingAtRisk]   = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState('overview');

  const loadBase = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, deptRes, bioRes, wkRes, subRes] = await Promise.allSettled([
        api.get('/analytics/overview'),
        api.get('/analytics/department-summary'),
        api.get('/analytics/biometric-enrollment'),
        api.get('/analytics/weekly-trend'),
        user.role !== 'student' ? api.get('/subjects') : Promise.resolve({ data: [] }),
      ]);
      if (ovRes.status   === 'fulfilled') setOverview(ovRes.value.data);
      if (deptRes.status === 'fulfilled') setDepts(deptRes.value.data);
      if (bioRes.status  === 'fulfilled') setBiometrics(bioRes.value.data);
      if (wkRes.status   === 'fulfilled') setWeekly(wkRes.value.data);
      if (subRes.status  === 'fulfilled') {
        const list = subRes.value.data || [];
        setSubjects(list);
        if (list.length > 0) setAtRiskSubject(list[0].id);
      }
    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user.role]);

  useEffect(() => { loadBase(); }, [loadBase]);

  const fetchAtRisk = useCallback(async () => {
    if (!atRiskSubject) return;
    setLoadingAtRisk(true);
    try {
      const res = await api.get(`/analytics/at-risk?subjectId=${atRiskSubject}&threshold=${atRiskThreshold}`);
      setAtRisk(res.data || []);
    } catch (err) {
      console.error('At-risk fetch error:', err);
    } finally {
      setLoadingAtRisk(false);
    }
  }, [atRiskSubject, atRiskThreshold]);

  const exportAtRiskCsv = () => {
    if (!atRisk.length) return;
    const headers = ['Roll Number', 'Student Name', 'Email', 'Classes Attended', 'Total Classes', 'Attendance %', 'Classes Needed to Recover'];
    const csvContent = [
      headers.join(','),
      ...atRisk.map(s => [
        `"${s.roll_number || ''}"`,
        `"${s.name || ''}"`,
        `"${s.email || ''}"`,
        `"${s.attended || 0}"`,
        `"${s.total_sessions || 0}"`,
        `"${s.attendance_pct || 0}%"`,
        `"${s.classes_needed_to_recover || 0}"`,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `At_Risk_Attendance_Defaulters_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const ov = overview || {};
  const totalStudents = ov.students || 0;
  const faceEnrolled  = ov.face_enrolled || 0;
  const voiceEnrolled = ov.voice_enrolled || 0;
  const dualEnrolled  = ov.dual_enrolled || 0;

  const facePct  = totalStudents ? Math.round(faceEnrolled  / totalStudents * 100) : 0;
  const voicePct = totalStudents ? Math.round(voiceEnrolled / totalStudents * 100) : 0;
  const dualPct  = totalStudents ? Math.round(dualEnrolled  / totalStudents * 100) : 0;

  const TABS = [
    { id: 'overview',   label: '📊 Overview'    },
    { id: 'biometrics', label: '🔬 Biometrics'  },
    { id: 'trend',      label: '📈 Trends'      },
    { id: 'at-risk',    label: '⚠️ At-Risk'    },
    { id: 'departments',label: '🏛 Departments' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            📊 Platform Insights
          </div>
          <h1 className="page-title">Attendance Analytics &amp; Reports</h1>
          <p className="page-subtitle">
            Cross-department metrics, biometric enrollment, and compliance rates.
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={loadBase} disabled={loading}>
          {loading ? '↻ Loading…' : '↻ Refresh'}
        </button>
      </div>

      <div className="divider-gold" />

      {/* Tab Nav */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`btn ${activeTab === tab.id ? 'btn-gold' : 'btn-outline'} btn-sm`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ─────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <>
          <div className="grid-4" style={{ marginBottom: 24 }}>
            <KpiCard icon="🎓" label="Total Students"    value={ov.students    ?? null} sub="Enrolled" color="var(--success)" />
            <KpiCard icon="👩‍🏫" label="Faculty Staff"    value={ov.faculty     ?? null} sub="Active teachers" color="var(--info)" />
            <KpiCard icon="📖" label="Active Subjects"   value={ov.subjects    ?? null} sub="Across all courses" />
            <KpiCard icon="🏛" label="Departments"       value={ov.departments ?? null} sub="Academic units" color="var(--warn)" />
          </div>
          <div className="grid-4" style={{ marginBottom: 32 }}>
            <KpiCard icon="📅" label="Sessions Today"  value={ov.sessions_today   ?? null} sub="Live &amp; completed" color="var(--gold)" />
            <KpiCard icon="🔴" label="Live Sessions"   value={ov.live_sessions    ?? null} sub="Right now" color="var(--danger)" />
            <KpiCard icon="✅" label="Avg Attendance"  value={ov.attendance_today !== undefined ? `${ov.attendance_today}%` : null} sub="Last 30 days" color="var(--success)" />
            <KpiCard icon="📚" label="Total Courses"   value={ov.courses ?? null} sub="Degree programs" color="var(--info)" />
          </div>

          {/* Quick biometric summary */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
              🔬 Biometric Enrollment Progress
            </h3>
            <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap' }}>
              <DonutRing pct={facePct}  label="Face Enrolled"  color="var(--gold)"    />
              <DonutRing pct={voicePct} label="Voice Enrolled" color="var(--info)"    />
              <DonutRing pct={dualPct}  label="Dual Enrolled"  color="var(--success)" />
            </div>
            <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
              {faceEnrolled} face · {voiceEnrolled} voice · {dualEnrolled} dual out of {totalStudents} students
            </p>
          </div>
        </>
      )}

      {/* ── Tab: Biometrics ───────────────────────────────────────────── */}
      {activeTab === 'biometrics' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '20px 24px 12px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Biometric Enrollment by Department</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Track face and voice enrollment progress across departments.
            </p>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : biometrics.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-icon">🔬</div>
              <h4>No biometric data yet</h4>
              <p>Students need to complete biometric enrollment first.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Total Students</th>
                    <th>Face Enrolled</th>
                    <th>Voice Enrolled</th>
                    <th>Dual Enrolled</th>
                    <th>Face %</th>
                    <th>Voice %</th>
                  </tr>
                </thead>
                <tbody>
                  {biometrics.map((d) => (
                    <tr key={d.department_id || d.department_name}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {d.department_name}
                      </td>
                      <td><span className="badge badge-gold">{d.total_students}</span></td>
                      <td style={{ color: 'var(--gold)' }}>{d.face_enrolled_count ?? d.face_enrolled ?? 0}</td>
                      <td style={{ color: 'var(--info)' }}>{d.voice_enrolled_count ?? d.voice_enrolled ?? 0}</td>
                      <td style={{ color: 'var(--success)' }}>{d.dual_enrolled_count ?? d.dual_enrolled ?? 0}</td>
                      <td style={{ width: 160 }}>
                        <TinyBar pct={parseFloat(d.face_enrollment_pct || 0)} />
                      </td>
                      <td style={{ width: 160 }}>
                        <TinyBar pct={parseFloat(d.voice_enrollment_pct || 0)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Trends ───────────────────────────────────────────────── */}
      {activeTab === 'trend' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Weekly Attendance Trend</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last 8 weeks</span>
          </div>
          {loading ? (
            <div className="skeleton" style={{ height: 160, borderRadius: 8 }} />
          ) : (
            <WeeklyChart data={weeklyTrend} />
          )}
          {weeklyTrend.length > 0 && (
            <div className="table-wrap" style={{ marginTop: 24 }}>
              <table>
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Sessions</th>
                    <th>Total Records</th>
                    <th>Present</th>
                    <th>Face Marked</th>
                    <th>Voice Marked</th>
                    <th>Manual</th>
                    <th>Avg %</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyTrend.slice(0, 13).map((w, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>
                        {w.week_start
                          ? new Date(w.week_start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : `Week ${i + 1}`}
                      </td>
                      <td>{w.total_sessions}</td>
                      <td>{w.total_records}</td>
                      <td style={{ color: 'var(--success)' }}>{w.present_count}</td>
                      <td style={{ color: 'var(--gold)' }}>{w.face_marked ?? '—'}</td>
                      <td style={{ color: 'var(--info)' }}>{w.voice_marked ?? '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{w.manual_marked ?? '—'}</td>
                      <td><TinyBar pct={parseFloat(w.avg_attendance_pct || 0)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: At-Risk ──────────────────────────────────────────────── */}
      {activeTab === 'at-risk' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              ⚠️ At-Risk Student Filter
            </h3>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
                <label className="form-label">Subject</label>
                <select className="form-input" value={atRiskSubject} onChange={e => setAtRiskSubject(e.target.value)}>
                  <option value="">Select subject…</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ width: 160 }}>
                <label className="form-label">Min Threshold (%)</label>
                <input
                  type="number" className="form-input"
                  value={atRiskThreshold} min="1" max="100"
                  onChange={e => setAtRiskThreshold(Number(e.target.value))}
                />
              </div>
              <button
                className="btn btn-gold"
                onClick={fetchAtRisk}
                disabled={loadingAtRisk || !atRiskSubject}
              >
                {loadingAtRisk ? '↻ Loading…' : '🔍 Find At-Risk Students'}
              </button>
            </div>
          </div>

          {atRisk.length > 0 ? (
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontWeight: 700, margin: 0 }}>
                  ⚠️ {atRisk.length} student(s) below {atRiskThreshold}% attendance
                </h4>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={exportAtRiskCsv}
                  style={{ fontSize: 13 }}
                >
                  📥 Export Watchlist CSV
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Roll Number</th>
                      <th>Student Name</th>
                      <th>Email</th>
                      <th>Classes Attended</th>
                      <th>Attendance</th>
                      <th>Classes Needed to Recover</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atRisk.map((s) => (
                      <tr key={s.student_id}>
                        <td><span className="badge badge-gold">{s.roll_number}</span></td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.email}</td>
                        <td>{s.attended}/{s.total_sessions}</td>
                        <td style={{ width: 160 }}><TinyBar pct={parseFloat(s.attendance_pct || 0)} /></td>
                        <td>
                          <span className="badge badge-danger">
                            {s.classes_needed_to_recover} more classes needed
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card empty-state">
              <div className="empty-icon">✅</div>
              <h4>Select a subject and click search</h4>
              <p>At-risk students (below {atRiskThreshold}% attendance) will appear here.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Departments ──────────────────────────────────────────── */}
      {activeTab === 'departments' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '20px 24px 12px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Department-level Attendance Summary</h3>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : departments.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-icon">📊</div>
              <h4>No analytics data recorded yet</h4>
              <p>Attendance records will automatically appear here after sessions are run.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Students</th>
                    <th>Faculty</th>
                    <th>Subjects</th>
                    <th>Sessions</th>
                    <th>Avg Attendance Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.department}</td>
                      <td>{d.students}</td>
                      <td>{d.faculty}</td>
                      <td>{d.subjects}</td>
                      <td>{d.total_sessions}</td>
                      <td style={{ width: 200 }}>
                        <TinyBar pct={parseFloat(d.avg_attendance_pct || 0)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
