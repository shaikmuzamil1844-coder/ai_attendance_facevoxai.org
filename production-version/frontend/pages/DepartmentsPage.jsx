// pages/DepartmentsPage.jsx — Manage institution departments
import { useEffect, useState } from 'react';
import { api } from '../services/client';
import { useTheme } from '../context/ThemeContext';

export default function DepartmentsPage() {
  const { grouped } = useTheme();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', hodName: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchDepts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/departments');
      setDepartments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepts();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/departments', form);
      setForm({ code: '', name: '', hodName: '' });
      setShowModal(false);
      fetchDepts();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create department.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = departments.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.code.toLowerCase().includes(search.toLowerCase()) ||
      (d.hod_name && d.hod_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            🏛 Organization
          </div>
          <h1 className="page-title">Departments</h1>
          <p className="page-subtitle">Manage academic departments, HOD assignments, and curriculum scopes.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-gold" onClick={() => setShowModal(true)}>
            + Add Department
          </button>
        </div>
      </div>

      <div className="divider-gold" />

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <input
          type="text"
          className="form-input"
          placeholder="🔍 Search departments by name, code, or HOD..."
          style={{ maxWidth: 400 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Department Cards Grid */}
      {loading ? (
        <div className="grid-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card skeleton" style={{ height: 160 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">🏛</div>
          <h4>No departments found</h4>
          <p>Create your first academic department to begin structuring courses and faculty.</p>
          <button className="btn btn-gold btn-sm" onClick={() => setShowModal(true)}>
            + Add Department
          </button>
        </div>
      ) : grouped ? (
        <div className="grid-3">
          {filtered.map((dept) => (
            <div key={dept.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="badge badge-gold" style={{ marginBottom: 6 }}>
                    {dept.code}
                  </span>
                  <h3 style={{ fontSize: 18, color: 'var(--text-primary)', marginTop: 4 }}>{dept.name}</h3>
                </div>
                <span className={`badge ${dept.is_active ? 'badge-success' : 'badge-muted'}`}>
                  {dept.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                <strong>HOD:</strong> {dept.hod_name || <span className="text-muted">Not assigned</span>}
              </div>

              <div className="divider" style={{ margin: '8px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                <span>📚 <strong>{dept.course_count || 0}</strong> Courses</span>
                <span>👩‍🏫 <strong>{dept.faculty_count || 0}</strong> Faculty</span>
                <span>🎓 <strong>{dept.student_count || 0}</strong> Students</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-wrap card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Department Name</th>
                <th>Head of Department</th>
                <th>Courses</th>
                <th>Faculty</th>
                <th>Students</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((dept) => (
                <tr key={dept.id}>
                  <td>
                    <span className="badge badge-gold">{dept.code}</span>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{dept.name}</td>
                  <td>{dept.hod_name || <span className="text-muted">Not assigned</span>}</td>
                  <td>📚 {dept.course_count || 0}</td>
                  <td>👩‍🏫 {dept.faculty_count || 0}</td>
                  <td>🎓 {dept.student_count || 0}</td>
                  <td>
                    <span className={`badge ${dept.is_active ? 'badge-success' : 'badge-muted'}`}>
                      {dept.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Department</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && <div className="alert alert-danger">⚠️ {error}</div>}

              <div className="form-group">
                <label className="form-label">Department Code *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. CSE, ECE, MECH"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Department Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Computer Science and Engineering"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Head of Department (HOD Name)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Dr. Ramesh Kumar"
                  value={form.hodName}
                  onChange={(e) => setForm({ ...form, hodName: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Creating…' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
