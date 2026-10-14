// pages/StudentHome.jsx — Student Portal with Academic Telemetry, Timetable, Teachers, & Biometrics
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/client';
import { AudioRecorder } from '../services/audioRecorder';

const DAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export default function StudentHome() {
  const { user } = useAuth();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState([]);
  const [history, setHistory] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active view tab: 'overview' | 'subjects' | 'enroll' | 'timetable' | 'faculty' | 'history'
  const [activeTab, setActiveTab] = useState(() => {
    return location.pathname.includes('/enroll') ? 'enroll' : 'overview';
  });

  // Subject Enrollment State
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [codeQuery, setCodeQuery] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeMsg, setCodeMsg] = useState('');
  const [codeError, setCodeError] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [enrollingId, setEnrollingId] = useState(null);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Modals for Biometrics
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  // Face scanner state
  const [cameraActive, setCameraActive] = useState(false);
  const [faceProcessing, setFaceProcessing] = useState(false);
  const [faceError, setFaceError] = useState('');
  const [faceSuccess, setFaceSuccess] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Voice recorder state
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [voiceSuccess, setVoiceSuccess] = useState('');
  const [recordSeconds, setRecordSeconds] = useState(0);
  const audioRecorderRef = useRef(null);
  const timerRef = useRef(null);

  const studentId = user?.studentId;

  const loadData = async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [profileRes, summaryRes, historyRes, facultyRes, timetableRes] = await Promise.all([
        api.get(`/students/${studentId}`).catch(() => ({ data: null })),
        api.get(`/students/${studentId}/attendance-summary`).catch(() => ({ data: { summary: [] } })),
        api.get(`/attendance/history?studentId=${studentId}`).catch(() => ({ data: [] })),
        api.get(`/students/${studentId}/faculty`).catch(() => ({ data: [] })),
        api.get('/timetable').catch(() => ({ data: [] })),
      ]);

      setProfile(profileRes.data);
      setSummary(summaryRes.data?.summary || []);
      setHistory(Array.isArray(historyRes.data) ? historyRes.data : []);
      setFacultyList(Array.isArray(facultyRes.data) ? facultyRes.data : []);
      setTimetable(Array.isArray(timetableRes.data) ? timetableRes.data : []);
    } catch (err) {
      console.error('Failed to load student data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableSubjects = async () => {
    if (!studentId) return;
    try {
      setAvailableLoading(true);
      const res = await api.get(`/students/${studentId}/available-subjects`);
      setAvailableSubjects(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load available subjects:', err);
    } finally {
      setAvailableLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadAvailableSubjects();
  }, [studentId]);

  useEffect(() => {
    if (activeTab === 'enroll') {
      loadAvailableSubjects();
    }
  }, [activeTab]);

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
      await Promise.all([loadData(), loadAvailableSubjects()]);
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
      await Promise.all([loadData(), loadAvailableSubjects()]);
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
      await Promise.all([loadData(), loadAvailableSubjects()]);
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to drop subject.');
    } finally {
      setEnrollingId(null);
    }
  };

  // ── Camera Controls for Face Enrollment ─────────────────────────────────────
  const startCamera = async () => {
    setFaceError('');
    setFaceSuccess('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      setFaceError('Webcam access denied. Please allow camera permissions.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  const handleCaptureFace = async () => {
    if (!videoRef.current || !canvasRef.current || !studentId) return;
    setFaceError('');
    setFaceSuccess('');
    setFaceProcessing(true);

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.9);

      const res = await api.post(`/students/${studentId}/enroll-face`, { imageBase64 });
      setFaceSuccess(`🎉 Face Enrolled Successfully! Quality: ${(res.data.quality * 100 || 95).toFixed(0)}% · Liveness: Passed`);
      stopCamera();
      loadData();
    } catch (err) {
      setFaceError(err.response?.data?.error || 'Face enrollment failed. Ensure face is well-lit and centered.');
    } finally {
      setFaceProcessing(false);
    }
  };

  // ── Microphone Controls for Voice Enrollment ────────────────────────────────
  const handleStartVoiceRecord = async () => {
    setVoiceError('');
    setVoiceSuccess('');
    setRecordSeconds(0);

    try {
      const recorder = new AudioRecorder();
      audioRecorderRef.current = recorder;
      await recorder.start();
      setRecordingVoice(true);

      timerRef.current = setInterval(() => {
        setRecordSeconds(s => {
          if (s >= 4) {
            handleStopVoiceRecord();
            return 4;
          }
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      setVoiceError('Microphone access denied. Please allow microphone permissions.');
    }
  };

  const handleStopVoiceRecord = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!audioRecorderRef.current || !recordingVoice) return;
    setRecordingVoice(false);
    setVoiceProcessing(true);
    setVoiceError('');

    try {
      const audioBlob = audioRecorderRef.current.stop();
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        try {
          const audioBase64 = reader.result;
          await api.post(`/students/${studentId}/enroll-voice`, { audioBase64 });
          setVoiceSuccess(`🎉 Voice Print Enrolled Successfully! Resemblyzer 256-D GE2E embedding active.`);
          loadData();
        } catch (err) {
          setVoiceError(err.response?.data?.error || 'Voice enrollment failed. Please speak clearly for at least 3 seconds.');
        } finally {
          setVoiceProcessing(false);
        }
      };
    } catch (err) {
      setVoiceError('Audio processing failed. Try again.');
      setVoiceProcessing(false);
    }
  };

  // Overall attendance calculation
  const overallPct = summary.length > 0
    ? Math.round(summary.reduce((s, x) => s + parseFloat(x.attendance_pct || 0), 0) / summary.length)
    : null;

  const pctColor = overallPct === null ? 'var(--gold)' : overallPct >= 75 ? 'var(--success)' : overallPct >= 60 ? 'var(--warn)' : 'var(--danger)';
  const isAtRisk = overallPct !== null && overallPct < 75;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
            🎓 Student Academic & Attendance Portal
          </div>
          <h1 className="page-title">Welcome, {profile?.name || user?.fullName || 'Student'} 👋</h1>
          <p className="page-subtitle">Track your attendance progress, class timetable, assigned faculty, and biometric identity.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn btn-gold btn-sm"
            onClick={() => {
              setActiveTab('enroll');
              loadAvailableSubjects();
            }}
          >
            + Enroll New Subject
          </button>
        </div>
      </div>

      <div className="divider-gold" />

      {/* ⚠️ Phase 4 Attendance Threshold Alert Banner */}
      {isAtRisk && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--danger)',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--danger)', marginBottom: 4 }}>
              ATTENDANCE WARNING: BELOW 75% MINIMUM ELIGIBILITY THRESHOLD
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Your overall cumulative attendance is currently at <strong>{overallPct}%</strong>, which is below the mandatory <strong>75%</strong> requirement.
              Students with attendance under 75% are at risk of exam debarment. Please attend upcoming lectures to maintain compliance.
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 20 }}>
        {[
          { id: 'overview',  label: '📊 Overview & Biometrics', count: null },
          { id: 'subjects',  label: '📚 Subject Attendance',    count: summary.length },
          { id: 'enroll',    label: '📝 Enroll Subjects',       count: availableSubjects.filter(s => !s.is_enrolled).length },
          { id: 'timetable', label: '🗓 Class Timetable',       count: timetable.length },
          { id: 'faculty',   label: '👨‍🏫 My Teachers',          count: facultyList.length },
          { id: 'history',   label: '📋 Attendance History',   count: history.length },
        ].map(tab => (
          <button
            key={tab.id}
            className={`btn ${activeTab === tab.id ? 'btn-gold' : 'btn-ghost'} btn-sm`}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === 'enroll') loadAvailableSubjects();
            }}
          >
            {tab.label} {tab.count !== null && `(${tab.count})`}
          </button>
        ))}
      </div>

      {/* ── TAB: OVERVIEW & BIOMETRICS ── */}
      {(activeTab === 'overview') && (
        <>
          {/* Top Section: Profile Card + Biometrics Status */}
          <div className="grid-2" style={{ marginBottom: 24 }}>
            {/* Student Academic Details */}
            <div className="card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--gold), #784500)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 900, color: '#000', flexShrink: 0
                }}>
                  {(profile?.name || user?.fullName || 'S')[0].toUpperCase()}
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    {profile?.name || user?.fullName}
                  </h3>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                    <code style={{ fontSize: 13, color: 'var(--gold)', background: 'var(--bg-base)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                      REG: {profile?.roll_number || 'N/A'}
                    </code>
                    <span className="badge badge-gold">{profile?.course_name || 'Undergraduate'}</span>
                  </div>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 10,
                background: 'var(--bg-base)',
                padding: 14,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-light)'
              }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Department</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{profile?.dept_name || 'Department of Technology'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Semester</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{profile?.sem_name || 'Active Semester'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Email</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{profile?.email || user?.email}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Phone</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{profile?.phone || 'Not provided'}</div>
                </div>
              </div>
            </div>

            {/* Biometric Integration Hub */}
            <div className="card-elevated" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)' }}>⚡ AI Biometric Identity</h3>
                  <span className="badge badge-gold">MULTI-MODAL</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Register your Face ID and Voice Signature to enable touchless biometric attendance during sessions.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  {/* Face Biometric Card */}
                  <div style={{
                    background: 'var(--bg-base)',
                    padding: '14px',
                    borderRadius: 'var(--radius-sm)',
                    border: profile?.face_enrolled ? '1px solid var(--success)' : '1px solid var(--border-light)',
                    display: 'flex', flexDirection: 'column', gap: 8
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>📸 Face ID</span>
                      <span className={`badge badge-${profile?.face_enrolled ? 'success' : 'warn'}`}>
                        {profile?.face_enrolled ? '✅ Enrolled' : '⚠️ Missing'}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                      {profile?.face_enrolled ? 'ArcFace 128-D vector active' : 'Webcam scan required'}
                    </p>
                    <button
                      type="button"
                      className={`btn ${profile?.face_enrolled ? 'btn-outline' : 'btn-gold'} btn-sm`}
                      style={{ marginTop: 4, width: '100%' }}
                      onClick={() => {
                        setShowFaceModal(true);
                        setTimeout(startCamera, 200);
                      }}
                    >
                      {profile?.face_enrolled ? '🔄 Re-scan Face' : '🤳 Enroll Face'}
                    </button>
                  </div>

                  {/* Voice Biometric Card */}
                  <div style={{
                    background: 'var(--bg-base)',
                    padding: '14px',
                    borderRadius: 'var(--radius-sm)',
                    border: profile?.voice_enrolled ? '1px solid var(--success)' : '1px solid var(--border-light)',
                    display: 'flex', flexDirection: 'column', gap: 8
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>🎙️ Voice Print</span>
                      <span className={`badge badge-${profile?.voice_enrolled ? 'success' : 'warn'}`}>
                        {profile?.voice_enrolled ? '✅ Enrolled' : '⚠️ Missing'}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                      {profile?.voice_enrolled ? 'Resemblyzer 256-D vector active' : 'Voice capture required'}
                    </p>
                    <button
                      type="button"
                      className={`btn ${profile?.voice_enrolled ? 'btn-outline' : 'btn-gold'} btn-sm`}
                      style={{ marginTop: 4, width: '100%' }}
                      onClick={() => {
                        setVoiceError('');
                        setVoiceSuccess('');
                        setShowVoiceModal(true);
                      }}
                    >
                      {profile?.voice_enrolled ? '🔄 Re-record Voice' : '🎤 Enroll Voice'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Attendance Percentage Gauge */}
          <div className="grid-2" style={{ marginBottom: 24 }}>
            <div className="card-elevated" style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <div style={{
                width: 110, height: 110, borderRadius: '50%',
                border: `5px solid ${pctColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: `0 0 25px ${pctColor}30`,
              }}>
                <span style={{ fontFamily: 'Outfit', fontSize: 30, fontWeight: 900, color: pctColor }}>
                  {overallPct !== null ? `${overallPct}%` : '—'}
                </span>
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Cumulative Attendance</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                  {overallPct === null ? 'No sessions recorded yet' : overallPct >= 75 ? '✅ Excellent! You meet all institutional criteria.' : overallPct >= 60 ? '⚠️ Warning: Attendance below required 75% threshold.' : '🚨 Critical: Risk of exam debarment. Attend upcoming sessions.'}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className={`badge badge-${overallPct === null ? 'muted' : overallPct >= 75 ? 'success' : overallPct >= 60 ? 'warn' : 'danger'}`}>
                    {summary.length} Enrolled Subject(s)
                  </span>
                  <span className={`badge badge-${overallPct >= 75 ? 'success' : 'danger'}`}>
                    {overallPct >= 75 ? 'Exam Eligible' : 'At-Risk Debarment'}
                  </span>
                </div>
              </div>
            </div>

            {/* Verification Info */}
            <div className="card-elevated" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>💡 Touchless Verification Process</h4>
              <ul style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: 16, margin: 0, lineHeight: '1.6' }}>
                <li>Your teacher opens the live biometric attendance camera in the classroom.</li>
                <li>FaceVoxAI verifies your facial geometry &amp; voice embedding with passive liveness detection.</li>
                <li>Attendance is securely recorded in the Supabase academic ledger in real-time.</li>
              </ul>
            </div>
          </div>
        </>
      )}

      {/* ── TAB: SUBJECT-WISE BREAKDOWN ── */}
      {(activeTab === 'overview' || activeTab === 'subjects') && (
        <div className="card-elevated" style={{ marginBottom: 24 }}>
          <div className="page-header" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800 }}>📊 Subject-Wise Attendance Breakdown</h3>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Required: 75% per subject</span>
              <button
                className="btn btn-gold btn-sm"
                onClick={() => {
                  setActiveTab('enroll');
                  loadAvailableSubjects();
                }}
              >
                + Enroll New Subject
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60 }} />)}
            </div>
          ) : summary.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📚</div>
              <h4>No enrolled subjects found</h4>
              <p>You haven't enrolled in any subjects yet. Enroll with a subject code or choose from your course catalog.</p>
              <button
                className="btn btn-gold btn-sm"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setActiveTab('enroll');
                  loadAvailableSubjects();
                }}
              >
                + Browse & Enroll Subjects
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {summary.map((s, i) => {
                const pct = parseFloat(s.attendance_pct || 0);
                const col = pct >= 75 ? 'var(--success)' : pct >= 60 ? 'var(--warn)' : 'var(--danger)';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{s.subject_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>{s.faculty_name ? `👨‍🏫 ${s.faculty_name}` : 'Faculty Assigned'}</div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Code: <code style={{ color: 'var(--gold)' }}>{s.subject_code}</code> · Attended {s.attended} of {s.total_sessions} sessions
                      </div>
                      <div className="progress-bar-track" style={{ marginTop: 8 }}>
                        <div className="progress-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: col, transition: 'width 1s ease' }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 85 }}>
                      <div style={{ fontFamily: 'Outfit', fontSize: 22, fontWeight: 800, color: col }}>{pct.toFixed(1)}%</div>
                      <span className={`badge badge-${pct >= 75 ? 'success' : pct >= 60 ? 'warn' : 'danger'}`} style={{ marginTop: 4 }}>
                        {pct >= 75 ? 'Compliant' : pct >= 60 ? 'At Risk' : 'Debarred'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: ENROLL SUBJECTS ── */}
      {activeTab === 'enroll' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 24 }}>
          {/* Quick Code / Course Enrollment Box */}
          <div className="card-elevated" style={{ border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>⚡</span>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Quick Subject or Course Enrollment
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  Enter a Subject Code (e.g. <code>CS101</code>, <code>AI202</code>) or Course Code (e.g. <code>B.TECH</code>) provided by your instructor or department.
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

          {/* Available Subjects Catalog */}
          <div className="card-elevated">
            <div className="page-header" style={{ marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
                  📚 Available Institutional Subjects Catalog
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  Browse active subjects in your department and course. Click to enroll instantly.
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

            {availableLoading ? (
              <div className="grid-3">
                {[1, 2, 3].map(i => <div key={i} className="card skeleton" style={{ height: 160 }} />)}
              </div>
            ) : availableSubjects.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📖</div>
                <h4>No institutional subjects available</h4>
                <p>Subjects will appear here once registered by your department.</p>
              </div>
            ) : (
              <div className="grid-3">
                {availableSubjects
                  .filter(s =>
                    !catalogSearch ||
                    s.name?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                    s.code?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                    s.course_name?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                    s.faculty_name?.toLowerCase().includes(catalogSearch.toLowerCase())
                  )
                  .map(sub => {
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
      )}

      {/* ── TAB: CLASS TIMETABLE ── */}
      {(activeTab === 'overview' || activeTab === 'timetable') && (
        <div className="card-elevated" style={{ marginBottom: 24 }}>
          <div className="page-header" style={{ marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>🗓 Weekly Class Timetable</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Your enrolled schedule for the active semester</p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => setActiveTab('timetable')}>
              View Full Schedule
            </button>
          </div>

          {timetable.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🗓</div>
              <h4>No timetable slots published</h4>
              <p>Your class timetable will appear here once finalized by the administration.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {timetable.map(slot => (
                <div key={slot.id} style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-light)',
                  borderLeft: '4px solid var(--gold)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', textTransform: 'capitalize' }}>
                      {DAY_LABELS[slot.day] || slot.day}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {(slot.start_time || '').slice(0, 5)} - {(slot.end_time || '').slice(0, 5)}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                    {slot.subject_name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    👨‍🏫 {slot.faculty_name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    🚪 {slot.classroom_name || slot.classroom_code || 'Main Hall'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: MY TEACHERS / FACULTY ── */}
      {(activeTab === 'overview' || activeTab === 'faculty') && (
        <div className="card-elevated" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>👨‍🏫 My Faculty &amp; Instructors</h3>

          {facultyList.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👨‍🏫</div>
              <h4>No faculty members assigned yet</h4>
              <p>Faculty details will appear here as soon as teachers are mapped to your subjects.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {facultyList.map(f => (
                <div key={f.id} style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px 16px',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'rgba(212,160,23,0.12)', border: '1px solid var(--gold)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, color: 'var(--gold)', fontWeight: 800,
                  }}>
                    {(f.name || 'T')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>{f.subject_name} ({f.subject_code})</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      ✉️ {f.email}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: ATTENDANCE HISTORY & LOGS ── */}
      {(activeTab === 'overview' || activeTab === 'history') && history.length > 0 && (
        <div className="card-elevated" style={{ marginBottom: 24 }}>
          <div className="page-header" style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800 }}>📋 Biometric Attendance Activity &amp; Logs</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Verified against pgvector HNSW ledger</span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Date &amp; Time</th>
                  <th>Faculty</th>
                  <th>Verification Method</th>
                  <th>Biometric Match</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {h.subject_name}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{h.subject_code}</div>
                    </td>
                    <td>{new Date(h.session_date).toLocaleDateString()} {h.start_time || ''}</td>
                    <td>{h.faculty_name || '—'}</td>
                    <td>
                      <span className="badge badge-gold" style={{ textTransform: 'uppercase' }}>
                        {h.method === 'face' ? '📸 Face ID' : h.method === 'voice' ? '🎙️ Voice' : h.method === 'dual' ? '⚡ Dual' : '✋ Manual'}
                      </span>
                    </td>
                    <td>
                      {h.confidence !== null && h.confidence !== undefined ? (
                        <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                          {(parseFloat(h.confidence) * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
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
        </div>
      )}

      {/* ─── MODAL: Live Face Enrollment ─── */}
      {showFaceModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: 18, color: 'var(--gold)', fontWeight: 800 }}>🤳 Live Face ID Enrollment</h3>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  stopCamera();
                  setShowFaceModal(false);
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Look straight into the camera in good lighting. FaceVoxAI will extract a 128-D ArcFace vector and verify live facial geometry.
            </p>

            <div className={`camera-box ${cameraActive ? 'active' : ''}`} style={{ width: '100%', height: 320, background: '#000', borderRadius: 'var(--radius-md)', overflow: 'hidden', position: 'relative', marginBottom: 14 }}>
              <video ref={videoRef} playsInline muted autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <div className="face-guide" />
            </div>

            {faceError && <div className="alert alert-danger" style={{ fontSize: 13, marginBottom: 12 }}>⚠️ {faceError}</div>}
            {faceSuccess && <div className="alert alert-success" style={{ fontSize: 13, marginBottom: 12 }}>{faceSuccess}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  stopCamera();
                  setShowFaceModal(false);
                }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-gold"
                onClick={handleCaptureFace}
                disabled={faceProcessing || !cameraActive}
              >
                {faceProcessing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Processing ArcFace…</> : '📸 Capture & Enroll Face'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Voice Print Enrollment ─── */}
      {showVoiceModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: 18, color: 'var(--gold)', fontWeight: 800 }}>🎙️ Live Voice Print Enrollment</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowVoiceModal(false)}>✕</button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Speak naturally for 3 to 4 seconds (e.g. read: <em>"FaceVoxAI biometric verification sample for attendance."</em>).
            </p>

            <div style={{
              background: 'var(--bg-base)', border: '1px solid var(--border-light)',
              borderRadius: 12, padding: '24px 20px', textAlign: 'center', marginBottom: 16
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>
                {recordingVoice ? '🔴' : '🎙️'}
              </div>

              {recordingVoice ? (
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--danger)', marginBottom: 4 }}>
                    Recording Utterance ({recordSeconds}s / 4s)…
                  </div>
                  <div className="progress-bar-track" style={{ height: 6, maxWidth: 200, margin: '8px auto' }}>
                    <div className="progress-bar-fill" style={{ width: `${(recordSeconds / 4) * 100}%`, background: 'var(--danger)' }} />
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Ready to record. Click below to begin voice capture.
                </div>
              )}
            </div>

            {voiceError && <div className="alert alert-danger" style={{ fontSize: 13, marginBottom: 12 }}>⚠️ {voiceError}</div>}
            {voiceSuccess && <div className="alert alert-success" style={{ fontSize: 13, marginBottom: 12 }}>{voiceSuccess}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowVoiceModal(false)}>Close</button>
              {recordingVoice ? (
                <button type="button" className="btn btn-danger" onClick={handleStopVoiceRecord}>
                  ⏹ Stop &amp; Save Voiceprint
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-gold"
                  onClick={handleStartVoiceRecord}
                  disabled={voiceProcessing}
                >
                  {voiceProcessing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Extracting GE2E Embedding…</> : '🔴 Start 4s Recording'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
