// pages/ClassroomsPage.jsx — Manage physical & virtual classrooms
import { useEffect, useState } from 'react';
import { api } from '../services/client';

export default function ClassroomsPage() {
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', location: '', capacity: 60 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/classrooms');
      setClassrooms(res.data);
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
      await api.post('/classrooms', form);
      setForm({ code: '', name: '', location: '', capacity: 60 });
      setShowModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create classroom.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            🚪 Organization
          </div>
          <h1 className="page-title">Classrooms & Lecture Halls</h1>
          <p className="page-subtitle">Physical rooms, smart labs, and seating capacity.</p>
        </div>
        <button className="btn btn-gold" onClick={() => setShowModal(true)}>
          + Add Classroom
        </button>
      </div>

      <div className="divider-gold" />

      {loading ? (
        <div className="grid-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card skeleton" style={{ height: 140 }} />
          ))}
        </div>
      ) : classrooms.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">🚪</div>
          <h4>No classrooms configured</h4>
          <p>Register lecture halls, seminar rooms, and computer labs.</p>
          <button className="btn btn-gold btn-sm" onClick={() => setShowModal(true)}>
            + Add Classroom
          </button>
        </div>
      ) : (
        <div className="grid-3">
          {classrooms.map((c) => (
            <div key={c.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-gold">{c.code}</span>
                <span className="badge badge-info">💺 {c.capacity || 60} Seats</span>
              </div>
              <h3 style={{ fontSize: 16, color: 'var(--text-primary)' }}>{c.name}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>📍 {c.location || 'Campus Main Block'}</p>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Classroom</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && <div className="alert alert-danger">⚠️ {error}</div>}

              <div className="form-group">
                <label className="form-label">Room Code *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. LH-101, LAB-3, AUDI-A"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Room Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Smart AI Computing Lab"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Location / Building</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Science Block, 2nd Floor"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Seating Capacity</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  max="1000"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value, 10) || 60 })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Saving…' : 'Create Classroom'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
