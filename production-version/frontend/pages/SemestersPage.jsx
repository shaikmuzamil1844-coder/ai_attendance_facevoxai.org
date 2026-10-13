// pages/SemestersPage.jsx — Manage academic semesters & terms
import { useEffect, useState } from 'react';
import { api } from '../services/client';

export default function SemestersPage() {
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', isActive: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/semesters');
      setSemesters(res.data);
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
      await api.post('/semesters', form);
      setForm({ name: '', startDate: '', endDate: '', isActive: true });
      setShowModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create semester.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            📅 Organization
          </div>
          <h1 className="page-title">Semesters & Academic Terms</h1>
          <p className="page-subtitle">Configure terms, dates, and active academic periods.</p>
        </div>
        <button className="btn btn-gold" onClick={() => setShowModal(true)}>
          + Add Semester
        </button>
      </div>

      <div className="divider-gold" />

      {loading ? (
        <div className="grid-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card skeleton" style={{ height: 140 }} />
          ))}
        </div>
      ) : semesters.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">📅</div>
          <h4>No semesters created</h4>
          <p>Create terms like Spring 2026, Fall 2025, Semester 1, etc.</p>
          <button className="btn btn-gold btn-sm" onClick={() => setShowModal(true)}>
            + Add Semester
          </button>
        </div>
      ) : (
        <div className="table-wrap card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Semester Name</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {semesters.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</td>
                  <td>{s.start_date ? new Date(s.start_date).toLocaleDateString('en-IN') : '—'}</td>
                  <td>{s.end_date ? new Date(s.end_date).toLocaleDateString('en-IN') : '—'}</td>
                  <td>
                    <span className={`badge ${s.is_active ? 'badge-success' : 'badge-muted'}`}>
                      {s.is_active ? 'Active Term' : 'Archived'}
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
              <h2 className="modal-title">Add Semester</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && <div className="alert alert-danger">⚠️ {error}</div>}

              <div className="form-group">
                <label className="form-label">Semester / Term Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Spring 2026 / Semester IV"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Start Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">End Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="activeTerm"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <label htmlFor="activeTerm" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Set as active current term
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Saving…' : 'Create Semester'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
