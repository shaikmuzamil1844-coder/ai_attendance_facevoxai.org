// pages/StudentEnrollPage.jsx — Dedicated Subject Enrollment & Course Catalog
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/client';

export default function StudentEnrollPage() {
  const { user } = useAuth();
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const [codeQuery, setCodeQuery] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeMsg, setCodeMsg] = useState('');
  const [codeError, setCodeError] = useState('');

  const [catalogSearch, setCatalogSearch] = useState('');
  const [enrollingId, setEnrollingId] = useState(null);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const studentId = user?.studentId;

  const loadAvailableSubjects = async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get(`/students/${studentId}/available-subjects`);
      setAvailableSubjects(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load available subjects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAvailableSubjects();
  }, [studentId]);

  const handleEnrollByCode = async (e) => {
    e?.preventDefault();
    if (!codeQuery.trim()) return;
    setCodeLoading(true);
    setCodeError('');
    setCodeMsg('');
    setActionSuccess('');
    setActionError('');
    try {
      const res = await api.post(`/students/${studentId}/enroll`, {
        subjectCode: codeQuery.trim(),
        courseId: codeQuery.trim(),
      });
      setCodeMsg(res.data?.message || 'Enrolled successfully!');
      setCodeQuery('');
      await loadAvailableSubjects();
    } catch (err) {
      setCodeError(err.response?.data?.error || 'Failed to enroll with this code/ID. Please verify.');
    } finally {
      setCodeLoading(false);
    }
  };

  const handleEnrollSubject = async (subId) => {
    setEnrollingId(subId);
    setActionSuccess('');
    setActionError('');
    try {
      const res = await api.post(`/students/${studentId}/enroll`, { subjectId: subId });
      setActionSuccess(res.data?.message || 'Subject enrolled successfully!');
      await loadAvailableSubjects();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to enroll in subject.');
    } finally {
      setEnrollingId(null);
    }
  };

  const handleUnenrollSubject = async (subId) => {
    if (!window.confirm('Are you sure you want to drop/unenroll from this subject?')) return;
    setEnrollingId(subId);
    setActionSuccess('');
    setActionError('');
    try {
      await api.delete(`/students/${studentId}/enroll`, { data: { subjectId: subId } });
      setActionSuccess('Subject unenrolled successfully.');
      await loadAvailableSubjects();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to drop subject.');
    } finally {
      setEnrollingId(null);
    }
  };

  const enrolledCount = availableSubjects.filter(s => s.is_enrolled).length;
  const filteredCatalog = availableSubjects.filter(s =>
    !catalogSearch ||
    s.name?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    s.code?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    s.course_name?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    s.faculty_name?.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            📝 Academic Course Registration
          </div>
          <h1 className="page-title">Course List &amp; Enrollment</h1>
          <p className="page-subtitle">Register for semester subjects or drop courses from your active schedule.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="badge badge-gold" style={{ fontSize: 13, padding: '6px 14px' }}>
            {enrolledCount} Enrolled Subject{enrolledCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="divider-gold" />

      {/* Quick Code Enrollment Card */}
      <div className="card-elevated" style={{ marginBottom: 24, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 26 }}>⚡</span>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Quick Code Registration
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Enter a Subject Code (e.g. <code>CS101</code>, <code>AI202</code>) or Course Code (e.g. <code>B.TECH</code>) given by your instructor.
            </p>
          </div>
        </div>

        <form onSubmit={handleEnrollByCode} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
          <input
            type="text"
            className="form-input"
            placeholder="Enter Subject Code or Course Code (e.g. CS101, B.TECH)..."
            value={codeQuery}
            onChange={(e) => setCodeQuery(e.target.value)}
            style={{ flex: 1, minWidth: 260 }}
          />
          <button
            type="submit"
            className="btn btn-gold"
            disabled={codeLoading || !codeQuery.trim()}
          >
            {codeLoading ? 'Enrolling...' : '⚡ Enroll with Code'}
          </button>
        </form>

        {codeMsg && (
          <div className="alert alert-success" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>✅</span>
            <span>{codeMsg}</span>
          </div>
        )}
        {codeError && (
          <div className="alert alert-danger" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚠️</span>
            <span>{codeError}</span>
          </div>
        )}
      </div>

      {/* Institutional Subject Catalog */}
      <div className="card-elevated">
        <div className="page-header" style={{ marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
              📚 Institutional Subject Catalog
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Browse all active subjects available for your department and course.
            </p>
          </div>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Search available subjects..."
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            style={{ maxWidth: 280 }}
          />
        </div>

        {actionSuccess && (
          <div className="alert alert-success" style={{ marginBottom: 16 }}>
            ✅ {actionSuccess}
          </div>
        )}
        {actionError && (
          <div className="alert alert-danger" style={{ marginBottom: 16 }}>
            ⚠️ {actionError}
          </div>
        )}

        {loading ? (
          <div className="grid-3">
            {[1, 2, 3].map(i => <div key={i} className="card skeleton" style={{ height: 160 }} />)}
          </div>
        ) : filteredCatalog.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📖</div>
            <h4>No subjects found</h4>
            <p>{catalogSearch ? 'No subjects matched your search term.' : 'Subjects will appear here once published by your department.'}</p>
          </div>
        ) : (
          <div className="grid-3">
            {filteredCatalog.map(sub => {
              const isEnrolled = sub.is_enrolled;
              const isProcessing = enrollingId === sub.id;
              return (
                <div
                  key={sub.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    border: isEnrolled ? '1px solid var(--border)' : '1px solid var(--border-light)',
                    background: isEnrolled ? 'var(--gold-subtle)' : 'var(--bg-card)',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className="badge badge-gold" style={{ marginBottom: 6 }}>
                        {sub.code}
                      </span>
                      <h3 style={{ fontSize: 17, color: 'var(--text-primary)', marginTop: 4 }}>
                        {sub.name}
                      </h3>
                    </div>
                    <span className="badge badge-info">{sub.credits} Credits</span>
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    <div>📚 {sub.course_name || 'All Courses'}</div>
                    {sub.semester_name && <div>📅 {sub.semester_name}</div>}
                    <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 12 }}>
                      👩‍🏫 {sub.faculty_name ? `Prof. ${sub.faculty_name}` : 'Faculty Pending'}
                    </div>
                  </div>

                  <div className="divider" style={{ margin: '4px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`badge ${isEnrolled ? 'badge-success' : 'badge-muted'}`}>
                      {isEnrolled ? '✅ Enrolled' : 'Not Enrolled'}
                    </span>

                    {isEnrolled ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleUnenrollSubject(sub.id)}
                        disabled={isProcessing}
                        style={{ color: 'var(--danger)', fontSize: 12, padding: '4px 10px' }}
                        title="Drop Subject"
                      >
                        {isProcessing ? 'Dropping...' : '✕ Drop'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-gold btn-sm"
                        onClick={() => handleEnrollSubject(sub.id)}
                        disabled={isProcessing}
                        style={{ fontSize: 12, padding: '5px 14px' }}
                      >
                        {isProcessing ? 'Enrolling...' : '+ Enroll'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
