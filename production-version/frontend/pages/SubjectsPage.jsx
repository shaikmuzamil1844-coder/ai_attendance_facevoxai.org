// pages/SubjectsPage.jsx — Manage academic subjects & faculty assignment
import { useEffect, useState } from 'react';
import { api } from '../services/client';

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [courses, setCourses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create Subject Modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ courseId: '', semesterId: '', code: '', name: '', credits: 3 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Assign Faculty Modal
  const [assigningSubject, setAssigningSubject] = useState(null);
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [subRes, cRes, semRes, fRes] = await Promise.all([
        api.get('/subjects'),
        api.get('/courses'),
        api.get('/semesters'),
        api.get('/faculty'),
      ]);
      setSubjects(subRes.data);
      setCourses(cRes.data);
      setSemesters(semRes.data);
      setFacultyList(fRes.data);
      if (cRes.data.length > 0 && !form.courseId) {
        setForm((prev) => ({
          ...prev,
          courseId: cRes.data[0].id,
          semesterId: semRes.data[0]?.id || '',
        }));
      }
      if (fRes.data.length > 0 && !selectedFaculty) {
        setSelectedFaculty(fRes.data[0].id);
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
      await api.post('/subjects', form);
      setForm({
        courseId: courses[0]?.id || '',
        semesterId: semesters[0]?.id || '',
        code: '',
        name: '',
        credits: 3,
      });
      setShowModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create subject.');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignFaculty = async (e) => {
    e.preventDefault();
    if (!assigningSubject || !selectedFaculty) return;
    setAssignError('');
    setAssigning(true);
    try {
      await api.post(`/subjects/${assigningSubject.id}/assign-faculty`, {
        facultyId: selectedFaculty,
        academicYear: '2025-2026',
      });
      setAssigningSubject(null);
      loadData();
    } catch (err) {
      setAssignError(err.response?.data?.error || 'Failed to assign faculty.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            📖 Academics
          </div>
          <h1 className="page-title">Subjects & Course Allocations</h1>
          <p className="page-subtitle">Course subjects, credit units, and teaching faculty assignments.</p>
        </div>
        <button className="btn btn-gold" onClick={() => setShowModal(true)}>
          + Create Subject
        </button>
      </div>

      <div className="divider-gold" />

      {loading ? (
        <div className="grid-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card skeleton" style={{ height: 160 }} />
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">📖</div>
          <h4>No subjects created</h4>
          <p>Create subjects like Artificial Intelligence, Operating Systems, Machine Learning, etc.</p>
          <button className="btn btn-gold btn-sm" onClick={() => setShowModal(true)}>
            + Create Subject
          </button>
        </div>
      ) : (
        <div className="grid-3">
          {subjects.map((sub) => (
            <div key={sub.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="badge badge-gold" style={{ marginBottom: 6 }}>{sub.code}</span>
                  <h3 style={{ fontSize: 17, color: 'var(--text-primary)', marginTop: 4 }}>{sub.name}</h3>
                </div>
                <span className="badge badge-info">{sub.credits} Credits</span>
              </div>

              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                <div>📚 {sub.course_name}</div>
                {sub.semester_name && <div>📅 {sub.semester_name}</div>}
              </div>

              <div className="divider" style={{ margin: '4px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  🎓 <strong>{sub.student_count || 0}</strong> Students
                </span>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setAssigningSubject(sub);
                    setAssignError('');
                  }}
                  style={{ fontSize: 12, padding: '4px 10px' }}
                >
                  👩‍🏫 Assign Faculty
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Subject Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create Subject</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && <div className="alert alert-danger">⚠️ {error}</div>}

              <div className="form-group">
                <label className="form-label">Degree Course *</label>
                <select
                  className="form-input"
                  value={form.courseId}
                  onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                  required
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Semester / Term</label>
                <select
                  className="form-input"
                  value={form.semesterId}
                  onChange={(e) => setForm({ ...form, semesterId: e.target.value })}
                >
                  <option value="">Select Semester</option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Subject Code *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. CS401, AI502"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Subject Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Artificial Intelligence & Neural Networks"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Credits</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  max="10"
                  value={form.credits}
                  onChange={(e) => setForm({ ...form, credits: parseInt(e.target.value, 10) || 3 })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Creating…' : 'Create Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Faculty Modal */}
      {assigningSubject && (
        <div className="modal-overlay" onClick={() => setAssigningSubject(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Assign Faculty to Subject</h2>
                <div style={{ fontSize: 13, color: 'var(--gold)', marginTop: 2 }}>
                  {assigningSubject.name} ({assigningSubject.code})
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setAssigningSubject(null)}>✕</button>
            </div>

            <form onSubmit={handleAssignFaculty} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {assignError && <div className="alert alert-danger">⚠️ {assignError}</div>}

              <div className="form-group">
                <label className="form-label">Select Faculty Instructor *</label>
                <select
                  className="form-input"
                  value={selectedFaculty}
                  onChange={(e) => setSelectedFaculty(e.target.value)}
                  required
                >
                  {facultyList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.employee_code}) — {f.dept_name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setAssigningSubject(null)}>Cancel</button>
                <button type="submit" className="btn btn-gold" disabled={assigning}>
                  {assigning ? 'Assigning…' : 'Assign Faculty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
