// pages/StudentsPage.jsx — Manage and inspect students with live Face & Voice Biometrics & Attendance Dashboard
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/client';
import { AudioRecorder } from '../services/audioRecorder';

export default function StudentsPage() {
  const { user } = useAuth();
  const isAdminOrHod = user?.role === 'admin' || user?.role === 'hod';
  const isFaculty = user?.role === 'faculty';

  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [form, setForm] = useState({
    departmentId: '',
    courseId: '',
    rollNumber: '',
    name: '',
    email: '',
    phone: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Individual Student Inspection Modal State (Teacher / Admin view)
  const [viewingStudent, setViewingStudent] = useState(null);
  const [inspectSummary, setInspectSummary] = useState([]);
  const [inspectHistory, setInspectHistory] = useState([]);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Biometric Enrollment State
  const [enrollingStudent, setEnrollingStudent] = useState(null);
  const [biometricTab, setBiometricTab] = useState('face'); // 'face' or 'voice'
  const [bioError, setBioError] = useState('');
  const [bioSuccess, setBioSuccess] = useState('');
  const [bioProcessing, setBioProcessing] = useState(false);

  // Webcam Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Voice Recording
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const audioRecorderRef = useRef(null);
  const timerRef = useRef(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sRes, dRes, cRes] = await Promise.all([
        api.get('/students', { params: { search, departmentId: deptFilter } }),
        api.get('/departments'),
        api.get('/courses'),
      ]);
      setStudents(sRes.data || []);
      setDepartments(dRes.data || []);
      setCourses(cRes.data || []);
      if (dRes.data?.length > 0 && !form.departmentId) {
        setForm((prev) => ({
          ...prev,
          departmentId: dRes.data[0].id,
          courseId: cRes.data[0]?.id || '',
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(loadData, 250);
    return () => clearTimeout(t);
  }, [search, deptFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/students', form);
      setForm({
        departmentId: departments[0]?.id || '',
        courseId: courses[0]?.id || '',
        rollNumber: '',
        name: '',
        email: '',
        phone: '',
      });
      setShowModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to enroll student.');
    } finally {
      setSaving(false);
    }
  };

  // ── Open Student Inspection Modal ───────────────────────────────────────────
  const handleInspectStudent = async (student) => {
    setViewingStudent(student);
    setInspectLoading(true);
    try {
      const [sumRes, histRes] = await Promise.all([
        api.get(`/students/${student.id}/attendance-summary`).catch(() => ({ data: { summary: [] } })),
        api.get(`/attendance/history?studentId=${student.id}`).catch(() => ({ data: [] })),
      ]);
      setInspectSummary(sumRes.data?.summary || []);
      setInspectHistory(Array.isArray(histRes.data) ? histRes.data : []);
    } catch (err) {
      console.error('Failed to load student attendance details:', err);
    } finally {
      setInspectLoading(false);
    }
  };

  // ── Camera Controls ──────────────────────────────────────────────────────────
  const startCamera = async () => {
    setBioError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      setBioError('Camera access denied or webcam not connected.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  const captureFace = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setBioProcessing(true);
    setBioError('');
    setBioSuccess('');

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.9);

      const res = await api.post(`/students/${enrollingStudent.id}/enroll-face`, { imageBase64 });
      setBioSuccess(`✅ Face enrolled successfully! Quality: ${(res.data.quality * 100 || 95).toFixed(0)}%`);
      stopCamera();
      loadData();
    } catch (err) {
      setBioError(err.response?.data?.error || 'Face capture failed. Check lighting and ensure face is visible.');
    } finally {
      setBioProcessing(false);
    }
  };

  // ── Voice Recording Controls ────────────────────────────────────────────────
  const startVoiceRecording = async () => {
    setBioError('');
    setBioSuccess('');
    setRecordSeconds(0);
    try {
      const recorder = new AudioRecorder();
      audioRecorderRef.current = recorder;
      await recorder.start();
      setRecording(true);

      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s >= 4) {
            stopVoiceRecording();
            return 4;
          }
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      setBioError('Microphone access denied.');
    }
  };

  const stopVoiceRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!audioRecorderRef.current || !recording) return;
    setRecording(false);
    setBioProcessing(true);

    try {
      const blob = audioRecorderRef.current.stop();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        try {
          const audioBase64 = reader.result;
          await api.post(`/students/${enrollingStudent.id}/enroll-voice`, { audioBase64 });
          setBioSuccess('✅ Voice print enrolled successfully! 256-D embedding saved.');
          loadData();
        } catch (err) {
          setBioError(err.response?.data?.error || 'Voice enrollment failed. Speak clearly for at least 3 seconds.');
        } finally {
          setBioProcessing(false);
        }
      };
    } catch (err) {
      setBioError('Audio processing failed.');
      setBioProcessing(false);
    }
  };

  const openBiometricModal = (student) => {
    setEnrollingStudent(student);
    setBiometricTab('face');
    setBioError('');
    setBioSuccess('');
    setTimeout(startCamera, 150);
  };

  const closeBiometricModal = () => {
    stopCamera();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setEnrollingStudent(null);
  };

  // Metrics
  const totalCount = students.length;
  const faceCount = students.filter(s => s.face_enrolled).length;
  const voiceCount = students.filter(s => s.voice_enrolled).length;
  const dualCount = students.filter(s => s.face_enrolled && s.voice_enrolled).length;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            {isFaculty ? '👩‍🏫 My Assigned Classes' : '🎓 Student Management'}
          </div>
          <h1 className="page-title">{isFaculty ? 'My Class Students' : 'Students Directory'}</h1>
          <p className="page-subtitle">
            {isFaculty
              ? 'View students enrolled in your assigned classes, verify biometric status, and inspect attendance records.'
              : 'Register students, manage academic enrollment, and configure facial and voice recognition.'}
          </p>
        </div>
        {isAdminOrHod && (
          <button className="btn btn-gold btn-lg" onClick={() => setShowModal(true)}>
            + Enroll Student
          </button>
        )}
      </div>

      <div className="divider-gold" />

      {/* Biometric Telemetry Cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <span className="stat-icon">🎓</span>
          <div className="stat-label">Total Students</div>
          <div className="stat-value">{totalCount}</div>
          <div className="stat-sub">{isFaculty ? 'In your assigned classes' : 'Institutional total'}</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📸</span>
          <div className="stat-label">Face ID Enrolled</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{faceCount}</div>
          <div className="stat-sub">{totalCount > 0 ? Math.round((faceCount / totalCount) * 100) : 0}% coverage</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🎤</span>
          <div className="stat-label">Voice Enrolled</div>
          <div className="stat-value" style={{ color: 'var(--info)' }}>{voiceCount}</div>
          <div className="stat-sub">{totalCount > 0 ? Math.round((voiceCount / totalCount) * 100) : 0}% coverage</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⚡</span>
          <div className="stat-label">Dual Ready</div>
          <div className="stat-value" style={{ color: 'var(--gold)' }}>{dualCount}</div>
          <div className="stat-sub">Face + Voice active</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          type="text"
          className="form-input"
          placeholder="🔍 Search student by name, roll number, or email..."
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
        <div className="table-wrap card skeleton" style={{ height: 280 }} />
      ) : students.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">🎓</div>
          <h4>No students found</h4>
          <p>
            {isFaculty
              ? 'No students enrolled in your assigned subjects matching the query.'
              : 'Enroll your first student to configure facial and voice recognition.'}
          </p>
          {isAdminOrHod && (
            <button className="btn btn-gold btn-sm" onClick={() => setShowModal(true)}>
              + Enroll Student
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrap card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Roll Number</th>
                <th>Student Name</th>
                <th>Department</th>
                <th>Course</th>
                <th>Face ID</th>
                <th>Voice ID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="badge badge-gold">{s.roll_number}</span>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    <div>{s.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.email}</div>
                  </td>
                  <td>{s.dept_name}</td>
                  <td>{s.course_name}</td>
                  <td>
                    {s.face_enrolled ? (
                      <span className="badge badge-success">📸 Enrolled</span>
                    ) : (
                      <span className="badge badge-warn">⚠️ Pending</span>
                    )}
                  </td>
                  <td>
                    {s.voice_enrolled ? (
                      <span className="badge badge-success">🎤 Enrolled</span>
                    ) : (
                      <span className="badge badge-warn">⚠️ Pending</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleInspectStudent(s)}
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        title="View student dashboard & attendance details"
                      >
                        📊 Attendance Details
                      </button>
                      {isAdminOrHod && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openBiometricModal(s)}
                          style={{ fontSize: 12, padding: '4px 10px' }}
                          title="Configure biometrics"
                        >
                          ⚡ Biometrics
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── STUDENT ATTENDANCE INSPECTION MODAL (Teacher / Admin) ── */}
      {viewingStudent && (
        <div className="modal-overlay" onClick={() => setViewingStudent(null)}>
          <div className="modal" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">📊 Student Attendance Dashboard</h2>
                <div style={{ fontSize: 13, color: 'var(--gold)', marginTop: 2 }}>
                  {viewingStudent.name} (Roll: <strong>{viewingStudent.roll_number}</strong>)
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setViewingStudent(null)}>✕</button>
            </div>

            {inspectLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 20 }}>
                {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 50 }} />)}
              </div>
            ) : (
              <div>
                {/* Profile Overview Card */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12, background: 'var(--bg-base)', padding: 14, borderRadius: 10,
                  border: '1px solid var(--border-light)', marginBottom: 18
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Department</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{viewingStudent.dept_name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Course / Program</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{viewingStudent.course_name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Biometrics Status</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <span className={`badge badge-${viewingStudent.face_enrolled ? 'success' : 'warn'}`}>
                        {viewingStudent.face_enrolled ? '📸 Face OK' : 'No Face'}
                      </span>
                      <span className={`badge badge-${viewingStudent.voice_enrolled ? 'success' : 'warn'}`}>
                        {viewingStudent.voice_enrolled ? '🎤 Voice OK' : 'No Voice'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Email</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {viewingStudent.email}
                    </div>
                  </div>
                </div>

                {/* Subject Attendance Breakdown */}
                <div style={{ marginBottom: 18 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📚 Subject Attendance Summary</h4>
                  {inspectSummary.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>
                      No subjects recorded for this student.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {inspectSummary.map((sub, idx) => {
                        const pct = parseFloat(sub.attendance_pct || 0);
                        const col = pct >= 75 ? 'var(--success)' : pct >= 60 ? 'var(--warn)' : 'var(--danger)';
                        return (
                          <div key={idx} style={{
                            background: 'var(--bg-base)', padding: '10px 14px', borderRadius: 8,
                            border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 14
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{sub.subject_name}</strong>
                                <span style={{ fontFamily: 'Outfit', fontWeight: 800, color: col }}>{pct.toFixed(1)}%</span>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                                Attended {sub.attended} of {sub.total_sessions} sessions · Code: {sub.subject_code}
                              </div>
                              <div className="progress-bar-track" style={{ height: 6 }}>
                                <div className="progress-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: col }} />
                              </div>
                            </div>
                            <span className={`badge badge-${pct >= 75 ? 'success' : pct >= 60 ? 'warn' : 'danger'}`}>
                              {pct >= 75 ? 'Eligible' : pct >= 60 ? 'At-Risk' : 'Debarred'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Recent Session Logs */}
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📋 Recent Class Attendance Logs</h4>
                  {inspectHistory.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      No attendance logs recorded for this student yet.
                    </div>
                  ) : (
                    <div className="table-wrap" style={{ maxHeight: 220, overflowY: 'auto' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th><th>Subject</th><th>Method</th><th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inspectHistory.slice(0, 10).map((h, i) => (
                            <tr key={i}>
                              <td>{h.session_date ? new Date(h.session_date).toLocaleDateString() : '—'}</td>
                              <td>{h.subject_name}</td>
                              <td>
                                <span className="badge badge-gold" style={{ textTransform: 'capitalize' }}>
                                  {h.method || 'auto'}
                                </span>
                              </td>
                              <td>
                                <span className={`badge badge-${h.status === 'present' ? 'success' : 'danger'}`}>
                                  {h.status === 'present' ? '✅ Present' : '❌ Absent'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                  <button className="btn btn-outline" onClick={() => setViewingStudent(null)}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add Student Modal (Admin/HOD Only) ── */}
      {showModal && isAdminOrHod && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Enroll New Student</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
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
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Course *</label>
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
                <label className="form-label">Roll Number *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 23CSE101"
                  value={form.rollNumber}
                  onChange={(e) => setForm({ ...form, rollNumber: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Student Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Rahul Sharma"
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
                  placeholder="e.g. rahul.sharma@student.edu"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
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
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Saving…' : 'Enroll Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Biometric Enrollment Modal ── */}
      {enrollingStudent && (
        <div className="modal-overlay" onClick={closeBiometricModal}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Biometric Enrollment</h2>
                <div style={{ fontSize: 13, color: 'var(--gold)', marginTop: 2 }}>
                  {enrollingStudent.name} ({enrollingStudent.roll_number})
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={closeBiometricModal}>✕</button>
            </div>

            {/* Tab switch */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border-light)', paddingBottom: 10 }}>
              <button
                className={`btn ${biometricTab === 'face' ? 'btn-gold' : 'btn-ghost'} btn-sm`}
                onClick={() => { setBiometricTab('face'); startCamera(); }}
              >
                📸 Face ID Enrollment
              </button>
              <button
                className={`btn ${biometricTab === 'voice' ? 'btn-gold' : 'btn-ghost'} btn-sm`}
                onClick={() => { setBiometricTab('voice'); stopCamera(); }}
              >
                🎤 Voice Print Enrollment
              </button>
            </div>

            {bioError && <div className="alert alert-danger" style={{ marginBottom: 16 }}>⚠️ {bioError}</div>}
            {bioSuccess && <div className="alert alert-success" style={{ marginBottom: 16 }}>{bioSuccess}</div>}

            {/* Face Tab */}
            {biometricTab === 'face' && (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  Position the student in front of the camera. The neural net will extract the 128-D facial feature embeddings with passive anti-spoofing checks.
                </p>

                <div
                  className={`camera-box ${cameraActive ? 'active' : ''}`}
                  style={{ width: '100%', height: 280, background: '#000', borderRadius: 'var(--radius-md)', overflow: 'hidden', position: 'relative', marginBottom: 16 }}
                >
                  <video ref={videoRef} playsInline muted autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  <div className="face-guide" />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost" onClick={closeBiometricModal}>Cancel</button>
                  <button
                    className="btn btn-gold"
                    onClick={captureFace}
                    disabled={bioProcessing || !cameraActive}
                  >
                    {bioProcessing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Processing…</> : '📸 Capture Face'}
                  </button>
                </div>
              </div>
            )}

            {/* Voice Tab */}
            {biometricTab === 'voice' && (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  Ask the student to read the sample phrase clearly for 3 to 4 seconds to extract their 256-D voice embedding.
                </p>

                <div style={{
                  background: 'var(--bg-base)', border: '1px solid var(--border-light)',
                  borderRadius: 12, padding: '24px 20px', textAlign: 'center', marginBottom: 16
                }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>
                    {recording ? '🔴' : '🎙️'}
                  </div>

                  {recording ? (
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--danger)', marginBottom: 4 }}>
                        Recording Voice ({recordSeconds}s / 4s)…
                      </div>
                      <div className="progress-bar-track" style={{ height: 6, maxWidth: 200, margin: '8px auto' }}>
                        <div className="progress-bar-fill" style={{ width: `${(recordSeconds / 4) * 100}%`, background: 'var(--danger)' }} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      Click below and speak: <em>"My name is {enrollingStudent.name} and this is my voice attendance sample."</em>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost" onClick={closeBiometricModal}>Cancel</button>
                  {recording ? (
                    <button className="btn btn-danger" onClick={stopVoiceRecording}>
                      ⏹ Stop &amp; Save
                    </button>
                  ) : (
                    <button
                      className="btn btn-gold"
                      onClick={startVoiceRecording}
                      disabled={bioProcessing}
                    >
                      {bioProcessing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Processing…</> : '🔴 Start Recording'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
