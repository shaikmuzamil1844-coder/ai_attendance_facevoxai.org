// pages/FacultyProfilePage.jsx — Dedicated Faculty Profile & Account Security
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/client';

export default function FacultyProfilePage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/subjects').catch(() => ({ data: [] }));
      setSubjects(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load faculty profile subjects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordMsg('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    setPasswordLoading(true);
    try {
      const res = await api.put('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordMsg(res.data?.message || 'Password changed successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setShowPasswordModal(false), 1500);
    } catch (err) {
      setPasswordError(err.response?.data?.error || 'Failed to update password. Please check your current password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const facultyName = user?.fullName || 'Faculty Professor';
  const initial = (facultyName[0] || 'F').toUpperCase();

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            👩‍🏫 Faculty Identity &amp; Profile
          </div>
          <h1 className="page-title">{facultyName}</h1>
          <p className="page-subtitle">Academic profile credentials, department affiliation, and security settings.</p>
        </div>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => setShowPasswordModal(true)}
        >
          🔐 Change Password
        </button>
      </div>

      <div className="divider-gold" />

      {/* Main Details Card */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--gold), #784500)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 900, color: '#000', flexShrink: 0,
              boxShadow: '0 4px 20px var(--gold-glow)'
            }}>
              {initial}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  {facultyName}
                </h2>
                <span className="badge badge-success">Active Faculty</span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                <code style={{ fontSize: 13, color: 'var(--gold)', background: 'var(--bg-base)', padding: '3px 10px', borderRadius: 4, fontWeight: 700 }}>
                  ID: {user?.facultyId ? user.facultyId.slice(0, 8).toUpperCase() : 'FAC-OFFICIAL'}
                </code>
                <span className="badge badge-gold">Professor &amp; Course Instructor</span>
              </div>
            </div>
          </div>

          {/* Profile Field Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            background: 'var(--bg-base)',
            padding: 18,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)'
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Department</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                Department of Technology
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Official Role</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2, textTransform: 'capitalize' }}>
                {user?.role || 'faculty'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Official Email</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginTop: 2, wordBreak: 'break-all' }}>
                {user?.email || 'N/A'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Teaching Load</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gold)', marginTop: 2 }}>
                {subjects.length} Assigned Subject{subjects.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Assigned Subjects Overview */}
        <div className="card-elevated">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'var(--text-primary)' }}>
            📖 My Teaching Subjects
          </h3>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 45 }} />)}
            </div>
          ) : subjects.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📖</div>
              <h4>No teaching subjects assigned</h4>
              <p>Your academic coordinator will map your subjects to your profile.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {subjects.map(s => (
                <div key={s.id} style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-light)',
                  borderLeft: '4px solid var(--gold)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <code style={{ color: 'var(--gold)', fontWeight: 800 }}>{s.code}</code>
                    <span className="badge badge-info">{s.credits || 4} Credits</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{s.course_name || 'Undergraduate'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Account Security Card */}
        <div className="card-elevated" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              🔐 Account Security &amp; Credentials
            </h4>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Signed in as faculty account (<code style={{ color: 'var(--gold)' }}>{user?.email}</code>).
            </p>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setShowPasswordModal(true)}
          >
            Update Password
          </button>
        </div>
      </div>

      {/* ─── MODAL: Change Password ─── */}
      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: 18, color: 'var(--gold)', fontWeight: 800 }}>🔐 Change Password</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPasswordModal(false)}>✕</button>
            </div>

            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  className="form-input"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  required
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Enter new password (min. 8 characters)"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Repeat new password"
                />
              </div>

              {passwordError && <div className="alert alert-danger" style={{ fontSize: 13 }}>⚠️ {passwordError}</div>}
              {passwordMsg && <div className="alert alert-success" style={{ fontSize: 13 }}>✅ {passwordMsg}</div>}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowPasswordModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-gold" disabled={passwordLoading}>
                  {passwordLoading ? 'Updating…' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
