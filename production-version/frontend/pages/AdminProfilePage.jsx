// pages/AdminProfilePage.jsx — Dedicated Super Admin Profile & Platform Security
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/client';

export default function AdminProfilePage() {
  const { user } = useAuth();

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');

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
      setPasswordMsg(res.data?.message || 'Admin password changed successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setShowPasswordModal(false), 1500);
    } catch (err) {
      setPasswordError(err.response?.data?.error || 'Failed to update password. Please check your current password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const adminName = user?.fullName || 'Super Administrator';
  const initial = (adminName[0] || 'A').toUpperCase();

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            ⬡ System Administrator Profile
          </div>
          <h1 className="page-title">{adminName}</h1>
          <p className="page-subtitle">Platform governance, administrative credentials, and system security.</p>
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
                  {adminName}
                </h2>
                <span className="badge badge-gold">Full System Privileges</span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                <code style={{ fontSize: 13, color: 'var(--gold)', background: 'var(--bg-base)', padding: '3px 10px', borderRadius: 4, fontWeight: 700 }}>
                  SUPER-ADMIN-ROOT
                </code>
                <span className="badge badge-success">Institutional Super Admin</span>
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
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Access Level</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                Global Super Admin (RBAC Level 0)
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Security Tier</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--success)', marginTop: 2 }}>
                JWT + Bcrypt Salted Hash (12 rounds)
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Official Email</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginTop: 2, wordBreak: 'break-all' }}>
                {user?.email || 'admin@facevoxai.com'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Governance Scope</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gold)', marginTop: 2 }}>
                All Departments, Faculty &amp; Students
              </div>
            </div>
          </div>
        </div>

        {/* System Architecture & Microservices Health Card */}
        <div className="card-elevated">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'var(--text-primary)' }}>
            ⚙️ Microservices &amp; Infrastructure
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            <div style={{ background: 'var(--bg-base)', padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>Node.js / Express API</strong>
                <span className="badge badge-success">Port 4000 Active</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                REST gateway, RBAC middleware, JWT auth &amp; socket.io pipelines.
              </p>
            </div>

            <div style={{ background: 'var(--bg-base)', padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>Python FastAPI AI Service</strong>
                <span className="badge badge-success">Port 8000 Active</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                ArcFace 128-D embeddings, Resemblyzer 256-D d-vectors &amp; liveness filters.
              </p>
            </div>

            <div style={{ background: 'var(--bg-base)', padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>PostgreSQL + pgvector</strong>
                <span className="badge badge-info">HNSW Cosine Index</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                High-throughput multi-modal biometric ledger with sub-second lookups.
              </p>
            </div>
          </div>
        </div>

        {/* Account Security Card */}
        <div className="card-elevated" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              🔐 Admin Password &amp; Credential Governance
            </h4>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Ensure strong cryptographic password protection for the super administrator account.
            </p>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setShowPasswordModal(true)}
          >
            Update Admin Password
          </button>
        </div>
      </div>

      {/* ─── MODAL: Change Password ─── */}
      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: 18, color: 'var(--gold)', fontWeight: 800 }}>🔐 Change Admin Password</h3>
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
