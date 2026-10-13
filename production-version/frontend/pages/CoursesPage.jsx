// pages/CoursesPage.jsx — Manage degree courses & programs
import { useEffect, useState } from 'react';
import { api } from '../services/client';

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', departmentId: '', durationYears: 4 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [cRes, dRes] = await Promise.all([api.get('/courses'), api.get('/departments')]);
      setCourses(cRes.data);
      setDepartments(dRes.data);
      if (dRes.data.length > 0 && !form.departmentId) {
        setForm((prev) => ({ ...prev, departmentId: dRes.data[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/courses', form);
      setForm({ code: '', name: '', departmentId: departments[0]?.id || '', durationYears: 4 });
      setShowModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create course.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            📚 Organization
          </div>
          <h1 className="page-title">Courses & Programs</h1>
          <p className="page-subtitle">Degree programs, curriculum tracks, and duration specifications.</p>
        </div>
        <button className="btn btn-gold" onClick={() => setShowModal(true)}>
          + Add Course
        </button>
      </div>

      <div className="divider-gold" />

      {loading ? (
        <div className="grid-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card skeleton" style={{ height: 140 }} />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">📚</div>
          <h4>No courses registered</h4>
          <p>Add degree programs like B.Tech CSE, M.Tech AI, etc.</p>
          <button className="btn btn-gold btn-sm" onClick={() => setShowModal(true)}>
            + Add Course
          </button>
        </div>
      ) : (
        <div className="table-wrap card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Course Name</th>
                <th>Department</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="badge badge-gold">{c.code}</span>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</td>
                  <td>{c.dept_name || '—'}</td>
                  <td>{c.duration_years} Years</td>
                  <td>
                    <span className={`badge ${c.is_active ? 'badge-success' : 'badge-muted'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Course</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && <div className="alert alert-danger">⚠️ {error}</div>}

              <div className="form-group">
                <label className="form-label">Department *</label>
                <select
                  className="form-input"
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                  required
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Course Code *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. BTECH-CSE"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Course Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Bachelor of Technology in Computer Science"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Duration (Years)</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  max="10"
                  value={form.durationYears}
                  onChange={(e) => setForm({ ...form, durationYears: parseInt(e.target.value, 10) || 4 })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Saving…' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
