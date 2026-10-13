// pages/TimetablePage.jsx — Interactive Class Schedule & Timetable Manager
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/client';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export default function TimetablePage() {
  const { user } = useAuth();
  const isAdminOrHod = user?.role === 'admin' || user?.role === 'hod';

  const [timetable, setTimetable] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [semesters, setSemesters] = useState([]);

  const [selectedDay, setSelectedDay] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    subjectId: '',
    facultyId: '',
    classroomId: '',
    semesterId: '',
    day: 'monday',
    startTime: '09:00',
    endTime: '10:00',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [tRes, sRes, fRes, cRes, semRes] = await Promise.all([
        api.get('/timetable').catch(() => ({ data: [] })),
        api.get('/subjects').catch(() => ({ data: [] })),
        isAdminOrHod ? api.get('/faculty').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        api.get('/classrooms').catch(() => ({ data: [] })),
        api.get('/semesters').catch(() => ({ data: [] })),
      ]);

      setTimetable(Array.isArray(tRes.data) ? tRes.data : []);
      setSubjects(Array.isArray(sRes.data) ? sRes.data : []);
      setFacultyList(Array.isArray(fRes.data) ? fRes.data : []);
      setClassrooms(Array.isArray(cRes.data) ? cRes.data : []);
      setSemesters(Array.isArray(semRes.data) ? semRes.data : []);

      if (sRes.data?.length > 0 && !form.subjectId) {
        setForm(prev => ({
          ...prev,
          subjectId: sRes.data[0].id,
          facultyId: fRes.data?.[0]?.id || user?.facultyId || '',
          classroomId: cRes.data?.[0]?.id || '',
          semesterId: semRes.data?.[0]?.id || '',
        }));
      }
    } catch (err) {
      console.error('Failed to load timetable data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingSlot(null);
    setForm({
      subjectId: subjects[0]?.id || '',
      facultyId: facultyList[0]?.id || user?.facultyId || '',
      classroomId: classrooms[0]?.id || '',
      semesterId: semesters[0]?.id || '',
      day: 'monday',
      startTime: '09:00',
      endTime: '10:00',
    });
    setError('');
    setShowModal(true);
  };

  const handleOpenEdit = (slot) => {
    setEditingSlot(slot);
    setForm({
      subjectId: slot.subject_id,
      facultyId: slot.faculty_id,
      classroomId: slot.classroom_id || '',
      semesterId: slot.semester_id || '',
      day: slot.day,
      startTime: (slot.start_time || '').slice(0, 5),
      endTime: (slot.end_time || '').slice(0, 5),
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.startTime >= form.endTime) {
      setError('End time must be after start time.');
      return;
    }
    setSaving(true);
    try {
      if (editingSlot) {
        await api.put(`/timetable/${editingSlot.id}`, form);
      } else {
        await api.post('/timetable', form);
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save timetable slot.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this timetable slot?')) return;
    try {
      await api.delete(`/timetable/${id}`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete slot.');
    }
  };

  const filteredSlots = selectedDay === 'all'
    ? timetable
    : timetable.filter(s => s.day?.toLowerCase() === selectedDay.toLowerCase());

  // Group slots by day for day-wise view
  const groupedByDay = DAYS.reduce((acc, day) => {
    acc[day] = timetable.filter(s => s.day?.toLowerCase() === day);
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            🗓 Class Schedule
          </div>
          <h1 className="page-title">Academic Timetable</h1>
          <p className="page-subtitle">
            {user?.role === 'student' && 'View your enrolled lecture slots, classroom locations, and teachers.'}
            {user?.role === 'faculty' && 'View and track your weekly assigned class teaching timetable.'}
            {isAdminOrHod && 'Manage institutional lecture schedules, faculty allocations, and classrooms.'}
          </p>
        </div>
        {isAdminOrHod && (
          <button className="btn btn-gold btn-lg" onClick={handleOpenAdd}>
            ➕ Add Schedule Slot
          </button>
        )}
      </div>

      <div className="divider-gold" />

      {/* Day Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 20 }}>
        <button
          className={`btn ${selectedDay === 'all' ? 'btn-gold' : 'btn-ghost'} btn-sm`}
          onClick={() => setSelectedDay('all')}
        >
          All Days ({timetable.length})
        </button>
        {DAYS.map(day => (
          <button
            key={day}
            className={`btn ${selectedDay === day ? 'btn-gold' : 'btn-ghost'} btn-sm`}
            onClick={() => setSelectedDay(day)}
          >
            {DAY_LABELS[day]} ({groupedByDay[day]?.length || 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10 }} />)}
        </div>
      ) : filteredSlots.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🗓</div>
          <h4>No timetable slots found</h4>
          <p>
            {selectedDay === 'all'
              ? 'No classes are scheduled yet in the academic calendar.'
              : `No lectures are scheduled on ${DAY_LABELS[selectedDay]}.`}
          </p>
          {isAdminOrHod && (
            <button className="btn btn-gold btn-sm" onClick={handleOpenAdd} style={{ marginTop: 14 }}>
              ➕ Create First Slot
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredSlots.map(slot => (
            <div
              key={slot.id}
              className="card-elevated"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                gap: 16,
                flexWrap: 'wrap',
                borderLeft: '4px solid var(--gold)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 260 }}>
                {/* Time Badge */}
                <div style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-light)',
                  padding: '8px 14px',
                  borderRadius: 8,
                  textAlign: 'center',
                  minWidth: 110,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)' }}>
                    {(slot.start_time || '').slice(0, 5)} - {(slot.end_time || '').slice(0, 5)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {DAY_LABELS[slot.day] || slot.day}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      {slot.subject_name}
                    </h3>
                    <code style={{ fontSize: 11, color: 'var(--gold)', background: 'var(--bg-base)', padding: '2px 6px', borderRadius: 4 }}>
                      {slot.subject_code}
                    </code>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    👨‍🏫 {slot.faculty_name || 'Faculty Assigned'}
                    {slot.semester_name && <span style={{ color: 'var(--text-muted)' }}> · {slot.semester_name}</span>}
                  </div>
                </div>
              </div>

              {/* Classroom Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  background: 'rgba(212,160,23,0.08)',
                  border: '1px solid rgba(212,160,23,0.2)',
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--text-primary)',
                }}>
                  🚪 <strong style={{ color: 'var(--gold)' }}>{slot.classroom_name || slot.classroom_code || 'TBA'}</strong>
                  {slot.classroom_location && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>({slot.classroom_location})</span>}
                </div>

                {isAdminOrHod && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleOpenEdit(slot)}
                      title="Edit slot"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(slot.id)}
                      title="Delete slot"
                    >
                      🗑
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add / Edit Slot Modal (Admin/HOD) ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingSlot ? '✏️ Edit Timetable Slot' : '➕ Add Timetable Slot'}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {error && <div className="alert alert-danger">⚠️ {error}</div>}

              <div className="form-group">
                <label className="form-label">Subject *</label>
                <select
                  className="form-input"
                  value={form.subjectId}
                  onChange={e => setForm({ ...form, subjectId: e.target.value })}
                  required
                >
                  <option value="">Select Subject</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Faculty / Teacher *</label>
                <select
                  className="form-input"
                  value={form.facultyId}
                  onChange={e => setForm({ ...form, facultyId: e.target.value })}
                  required
                >
                  <option value="">Select Faculty</option>
                  {facultyList.map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.email})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Classroom</label>
                  <select
                    className="form-input"
                    value={form.classroomId}
                    onChange={e => setForm({ ...form, classroomId: e.target.value })}
                  >
                    <option value="">Select Room (Optional)</option>
                    {classrooms.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Semester</label>
                  <select
                    className="form-input"
                    value={form.semesterId}
                    onChange={e => setForm({ ...form, semesterId: e.target.value })}
                  >
                    <option value="">Select Semester (Optional)</option>
                    {semesters.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Day of Week *</label>
                <select
                  className="form-input"
                  value={form.day}
                  onChange={e => setForm({ ...form, day: e.target.value })}
                  required
                >
                  {DAYS.map(day => (
                    <option key={day} value={day}>{DAY_LABELS[day]}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Start Time *</label>
                  <input
                    type="time"
                    className="form-input"
                    value={form.startTime}
                    onChange={e => setForm({ ...form, startTime: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">End Time *</label>
                  <input
                    type="time"
                    className="form-input"
                    value={form.endTime}
                    onChange={e => setForm({ ...form, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Saving…' : editingSlot ? 'Update Slot' : 'Save Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
