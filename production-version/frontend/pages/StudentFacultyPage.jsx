// pages/StudentFacultyPage.jsx — Dedicated Faculty & Instructors Directory for Students
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/client';

export default function StudentFacultyPage() {
  const { user } = useAuth();
  const [facultyList, setFacultyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const studentId = user?.studentId;

  const loadFaculty = async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get(`/students/${studentId}/faculty`).catch(() => ({ data: [] }));
      setFacultyList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load faculty list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFaculty();
  }, [studentId]);

  const filteredFaculty = facultyList.filter(f =>
    !search ||
    f.name?.toLowerCase().includes(search.toLowerCase()) ||
    f.subject_name?.toLowerCase().includes(search.toLowerCase()) ||
    f.subject_code?.toLowerCase().includes(search.toLowerCase()) ||
    f.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            👨‍🏫 Instructional Faculty
          </div>
          <h1 className="page-title">My Teachers &amp; Instructors</h1>
          <p className="page-subtitle">Assigned faculty members and subject coordinators for your enrolled courses.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="badge badge-gold" style={{ fontSize: 13, padding: '6px 14px' }}>
            {facultyList.length} Assigned Teacher{facultyList.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="divider-gold" />

      {/* Search Bar */}
      <div className="card-elevated" style={{ marginBottom: 20, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <input
          type="text"
          className="form-input"
          placeholder="🔍 Search teacher by name or subject…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Reach out directly via official institutional email
        </span>
      </div>

      {loading ? (
        <div className="grid-3">
          {[1, 2, 3].map(i => <div key={i} className="card skeleton" style={{ height: 160 }} />)}
        </div>
      ) : filteredFaculty.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👨‍🏫</div>
          <h4>No faculty members found</h4>
          <p>
            {facultyList.length === 0
              ? 'Faculty members will appear here as soon as teachers are mapped to your enrolled subjects.'
              : 'No faculty match your search filter.'}
          </p>
        </div>
      ) : (
        <div className="grid-3">
          {filteredFaculty.map(f => {
            const initial = (f.name || 'T')[0].toUpperCase();
            return (
              <div
                key={f.id}
                className="card-elevated"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  borderLeft: '4px solid var(--gold)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: '50%',
                    background: 'rgba(212, 160, 23, 0.14)',
                    border: '1px solid var(--gold)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, color: 'var(--gold)', fontWeight: 800, flexShrink: 0,
                  }}>
                    {initial}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      {f.name}
                    </h3>
                    <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600, marginTop: 2 }}>
                      {f.subject_name}
                    </div>
                  </div>
                </div>

                <div style={{
                  background: 'var(--bg-base)',
                  padding: 12,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-light)',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Subject Code: </span>
                    <code style={{ color: 'var(--gold)', fontWeight: 700 }}>{f.subject_code}</code>
                  </div>
                  <div style={{ wordBreak: 'break-all' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Email: </span>
                    <a href={`mailto:${f.email}`} style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}>
                      {f.email}
                    </a>
                  </div>
                </div>

                <a
                  href={`mailto:${f.email}?subject=Regarding ${f.subject_name} (${f.subject_code})`}
                  className="btn btn-outline btn-sm"
                  style={{ width: '100%', marginTop: 'auto', textAlign: 'center' }}
                >
                  ✉️ Contact Instructor
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
