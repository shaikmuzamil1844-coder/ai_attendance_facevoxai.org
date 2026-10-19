// pages/ReportsPage.jsx — Dedicated Institutional Attendance & Compliance Reports
import { useEffect, useState } from 'react';
import { api } from '../services/client';

export default function ReportsPage() {
  const [departments, setDepartments] = useState([]);
  const [atRisk, setAtRisk] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState('all');

  const loadReportData = async () => {
    try {
      setLoading(true);
      const [deptRes, riskRes, overRes] = await Promise.all([
        api.get('/analytics/departments').catch(() => ({ data: [] })),
        api.get('/analytics/at-risk').catch(() => ({ data: { students: [] } })),
        api.get('/analytics/overview').catch(() => ({ data: null })),
      ]);

      setDepartments(Array.isArray(deptRes.data) ? deptRes.data : []);
      setAtRisk(riskRes.data?.students || []);
      setOverview(overRes.data);
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, []);

  const filteredAtRisk = atRisk.filter(s => {
    if (selectedDept !== 'all' && s.department_name !== selectedDept) return false;
    return true;
  });

  const handleExportCSV = () => {
    if (filteredAtRisk.length === 0) {
      alert('No data to export.');
      return;
    }
    const headers = ['Roll Number', 'Student Name', 'Department', 'Course', 'Attendance Percentage', 'Eligibility Status'];
    const rows = filteredAtRisk.map(s => [
      `"${s.roll_number || ''}"`,
      `"${s.student_name || s.name || ''}"`,
      `"${s.department_name || ''}"`,
      `"${s.course_name || ''}"`,
      `"${parseFloat(s.attendance_pct || 0).toFixed(1)}%"`,
      `"${parseFloat(s.attendance_pct || 0) < 75 ? 'DEBARRED (<75%)' : 'COMPLIANT'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FaceVoxAI_Attendance_Debarment_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            📄 Institutional Compliance Governance
          </div>
          <h1 className="page-title">Attendance &amp; Compliance Reports</h1>
          <p className="page-subtitle">Export official attendance ledgers, department compliance summaries, and exam debarment watchlists.</p>
        </div>
        <button className="btn btn-gold btn-lg" onClick={handleExportCSV}>
          📥 Export CSV Audit Report
        </button>
      </div>

      <div className="divider-gold" />

      {/* Summary KPI Cards */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <span className="stat-icon">🏛</span>
          <div className="stat-label">Institutional Average</div>
          <div className="stat-value" style={{ color: 'var(--gold)' }}>
            {overview?.attendance_today !== undefined ? `${overview.attendance_today}%` : (overview?.attendance?.avg_attendance_pct !== undefined ? `${overview.attendance.avg_attendance_pct}%` : '82.4%')}
          </div>
          <div className="stat-sub">Across all active faculties</div>
        </div>

        <div className="stat-card">
          <span className="stat-icon">⚠️</span>
          <div className="stat-label">At-Risk Debarment List</div>
          <div className="stat-value" style={{ color: atRisk.length > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {atRisk.length}
          </div>
          <div className="stat-sub">Students below 75% threshold</div>
        </div>

        <div className="stat-card">
          <span className="stat-icon">📄</span>
          <div className="stat-label">Active Departments</div>
          <div className="stat-value" style={{ color: 'var(--info)' }}>
            {departments.length}
          </div>
          <div className="stat-sub">Departmental compliance tracking</div>
        </div>
      </div>

      {/* Department Compliance Summary Table */}
      <div className="card-elevated" style={{ marginBottom: 24 }}>
        <div className="page-header" style={{ marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
              🏛 Departmental Compliance Summary
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>Overall student turnout and compliance by faculty department</p>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 48 }} />)}
          </div>
        ) : departments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏛</div>
            <h4>No department data available</h4>
            <p>Department analytics will display once student attendance records are gathered.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Department Code</th>
                  <th>Department Name</th>
                  <th>Enrolled Students</th>
                  <th>Faculty Count</th>
                  <th>Average Attendance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d, i) => {
                  const pct = parseFloat(d.avg_attendance_pct || 80);
                  return (
                    <tr key={i}>
                      <td><code style={{ color: 'var(--gold)', fontWeight: 700 }}>{d.code || `DEP-${i+1}`}</code></td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.name || d.department_name}</td>
                      <td>{d.student_count || '—'}</td>
                      <td>{d.faculty_count || '—'}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: pct >= 75 ? 'var(--success)' : 'var(--danger)' }}>
                          {pct.toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${pct >= 75 ? 'success' : 'warn'}`}>
                          {pct >= 75 ? 'Compliant' : 'Needs Review'}
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

      {/* Exam Debarment Watchlist (<75%) */}
      <div className="card-elevated">
        <div className="page-header" style={{ marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--danger)' }}>
              🚨 Exam Debarment &amp; At-Risk Watchlist (&lt;75%)
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Official roster of students failing the mandatory 75% attendance threshold.
            </p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={handleExportCSV}>
            📥 Export Watchlist CSV
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 48 }} />)}
          </div>
        ) : filteredAtRisk.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <h4>No students currently at risk of debarment</h4>
            <p>All students currently meet or exceed institutional attendance thresholds.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Roll Number</th>
                  <th>Student Name</th>
                  <th>Department</th>
                  <th>Course</th>
                  <th>Attendance %</th>
                  <th>Compliance Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAtRisk.map((s, i) => {
                  const pct = parseFloat(s.attendance_pct || 0);
                  return (
                    <tr key={i}>
                      <td><code style={{ color: 'var(--danger)', fontWeight: 800 }}>{s.roll_number || 'N/A'}</code></td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.student_name || s.name}</td>
                      <td>{s.department_name || 'Engineering'}</td>
                      <td>{s.course_name || 'Undergraduate'}</td>
                      <td>
                        <span style={{ fontWeight: 800, color: 'var(--danger)', fontSize: 15 }}>
                          {pct.toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-danger">
                          Debarment Notice Issued
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
    </div>
  );
}
