// pages/FacultyPage.jsx — Manage teaching staff and faculty assignments
import { useEffect, useState } from 'react';
import { api } from '../services/client';

export default function FacultyPage() {
  const [faculty, setFaculty] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [form, setForm] = useState({
    departmentId: '',
    employeeCode: '',
    name: '',
    email: '',
    phone: '',
    designation: 'Assistant Professor',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [fRes, dRes] = await Promise.all([
        api.get('/faculty', { params: deptFilter ? { departmentId: deptFilter } : {} }),
        api.get('/departments'),
      ]);
      setFaculty(fRes.data);
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
  }, [deptFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/faculty', form);
      setForm({
        departmentId: departments[0]?.id || '',
        employeeCode: '',
        name: '',
        email: '',
        phone: '',
        designation: 'Assistant Professor',
      });
      setShowModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to register faculty member.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = faculty.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.email.toLowerCase().includes(search.toLowerCase()) ||
      f.employee_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            👩‍🏫 People
          </div>
          <h1 className="page-title">Faculty & Staff</h1>
          <p className="page-subtitle">Manage professors, lecturers, and teaching staff assignments.</p>
        </div>
        <button className="btn btn-gold" onClick={() => setShowModal(true)}>
          + Add Faculty
        </button>
      </div>

      <div className="divider-gold" />

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          type="text"
          className="form-input"
          placeholder="🔍 Search faculty by name, email, or employee code..."
          style={{ maxWidth: 380 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-input"
          style={{ maxWidth: 240 }}
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card skeleton" style={{ height: 160 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">👩‍🏫</div>
          <h4>No faculty members found</h4>
          <p>Register teaching faculty members to assign courses and take attendance.</p>
          <button className="btn btn-gold btn-sm" onClick={() => setShowModal(true)}>
            + Add Faculty
          </button>
        </div>
      ) : (
        <div className="grid-3">
          {filtered.map((f) => (
            <div key={f.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: 17, color: 'var(--text-primary)' }}>{f.name}</h3>
                  <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600, marginTop: 2 }}>
                    {f.designation || 'Faculty'}
                  </div>
                </div>
                <span className="badge badge-gold">{f.employee_code}</span>
              </div>

              <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>🏛 {f.dept_name}</div>
                <div>📧 {f.email}</div>
                {f.phone && <div>📞 {f.phone}</div>}
              </div>

              <div className="divider" style={{ margin: '8px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                <span>📖 <strong>{f.subject_count || 0}</strong> Assigned Subjects</span>
                <span className={`badge ${f.is_active ? 'badge-success' : 'badge-muted'}`}>
                  {f.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Faculty Member</h2>
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
                <label className="form-label">Employee Code *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. FAC-2026-001"
                  value={form.employeeCode}
                  onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Dr. Priya Sharma"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="e.g. priya.sharma@institution.edu"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Designation</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Professor / Associate Professor"
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. +91 9876543210"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Saving…' : 'Register Faculty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
