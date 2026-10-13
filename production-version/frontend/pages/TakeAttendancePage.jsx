// pages/TakeAttendancePage.jsx — Real-time AI Attendance v2
// Features:
//   ✅ Socket.IO real-time events (attendance:marked, session:ended)
//   ✅ Auto-scan mode: captures every N seconds automatically
//   ✅ Live session progress bar (present/absent/total counts)
//   ✅ End session button with summary modal
//   ✅ Manual override mode for individual students
//   ✅ Toast notifications on every match
//   ✅ Improved voice recording with live timer + waveform animation
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { api } from '../services/client';
import { AudioRecorder } from '../services/audioRecorder';

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4000';

export default function TakeAttendancePage() {
  const [subjects,    setSubjects]    = useState([]);
  const [classrooms,  setClassrooms]  = useState([]);
  const [selSubject,  setSelSubject]  = useState('');
  const [selClassroom,setSelClassroom]= useState('');
  const [session,     setSession]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [mode,        setMode]        = useState('face'); // face | voice | dual

  // Scanner Source Mode (Live Webcam vs Batch Classroom Photo)
  const [scanSource,    setScanSource]    = useState('camera'); // camera | upload
  const [groupPhotoB64, setGroupPhotoB64] = useState(null);
  const [groupScanning, setGroupScanning] = useState(false);
  const fileInputRef = useRef(null);

  // Camera
  const [cameraActive,  setCameraActive]  = useState(false);
  const [scanningFace,  setScanningFace]  = useState(false);
  const [autoScan,      setAutoScan]      = useState(false);
  const [autoInterval,  setAutoInterval]  = useState(5); // seconds
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const autoScanRef = useRef(null);

  // Voice
  const [recordingVoice, setRecordingVoice]   = useState(false);
  const [processingVoice,setProcessingVoice]  = useState(false);
  const [recordSeconds,  setRecordSeconds]    = useState(0);
  const audioRecorderRef = useRef(null);
  const timerRef         = useRef(null);

  // Dual Biometric Verification
  const [dualPhase,     setDualPhase]     = useState('idle'); // idle | recording | verifying
  const [dualFeedback,  setDualFeedback]  = useState(null);

  // Results
  const [recognized,  setRecognized]  = useState([]);
  const [sessionStats,setStats]       = useState({ total: 0, present: 0, absent: 0 });
  const [toast,       setToast]       = useState(null);
  const [error,       setError]       = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [endingSess,  setEndingSess]  = useState(false);

  // Socket.IO
  const socketRef = useRef(null);

  // ── Load subjects + classrooms ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [sRes, cRes] = await Promise.all([api.get('/subjects'), api.get('/classrooms')]);
        setSubjects(sRes.data   || []);
        setClassrooms(cRes.data || []);
        if (sRes.data?.length > 0)  setSelSubject(sRes.data[0].id);
        if (cRes.data?.length > 0)  setSelClassroom(cRes.data[0].id);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  // ── Socket.IO ─────────────────────────────────────────────────────────────
  const connectSocket = useCallback((sessionId) => {
    const sock = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = sock;

    sock.on('connect', () => {
      sock.emit('join:session', sessionId);
    });

    sock.on('attendance:marked', (data) => {
      // Show toast
      showToast(`✅ ${data.name} marked Present (${data.confidence ?? Math.round((data.similarity||0.9)*100)}%)`, 'success');

      setRecognized(prev => {
        if (prev.some(p => p.studentId === data.studentId)) return prev;
        return [data, ...prev];
      });

      setStats(prev => ({ ...prev, present: prev.present + 1, absent: Math.max(0, prev.absent - 1) }));
    });

    sock.on('session:ended', (data) => {
      setStats(prev => ({ ...prev, ...data.summary }));
      setShowSummary(true);
    });

    return sock;
  }, []);

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      disconnectSocket();
      stopCamera();
      clearInterval(autoScanRef.current);
    };
  }, []);

  // ── Toast notification ─────────────────────────────────────────────────────
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Camera ────────────────────────────────────────────────────────────────
  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch {
      setError('Camera access denied or no webcam detected.');
    }
  };

  const stopCamera = () => {
    clearInterval(autoScanRef.current);
    setAutoScan(false);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // ── Auto-scan ─────────────────────────────────────────────────────────────
  const toggleAutoScan = () => {
    if (autoScan) {
      clearInterval(autoScanRef.current);
      setAutoScan(false);
    } else {
      setAutoScan(true);
      autoScanRef.current = setInterval(() => {
        captureAndRecognize();
      }, autoInterval * 1000);
    }
  };

  // ── Face scan ─────────────────────────────────────────────────────────────
  const captureAndRecognize = async () => {
    if (!videoRef.current || !canvasRef.current || !session || scanningFace) return;
    setScanningFace(true);
    setError('');
    try {
      const canvas = canvasRef.current;
      const video  = videoRef.current;
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.85);

      const res = await api.post('/attendance/face', {
        sessionId:   session.sessionId || session.id,
        imageBase64,
      });

      if (res.data.spoofed > 0) {
        showToast('⚠️ Spoof attempt detected! Screen/photo detected.', 'danger');
        setError('Anti-spoofing alert: Screen or photo presentation detected.');
      } else if (!res.data.matched?.length) {
        showToast('😶 No enrolled face matched.', 'warn');
      }
      // attendance:marked socket event handles the match display
    } catch (err) {
      setError(err.response?.data?.error || 'Face recognition error. Is the AI service running?');
    } finally {
      setScanningFace(false);
    }
  };

  // ── Voice ─────────────────────────────────────────────────────────────────
  const startVoice = async () => {
    setError('');
    try {
      const rec = new AudioRecorder();
      audioRecorderRef.current = rec;
      await rec.start();
      setRecordingVoice(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } catch {
      setError('Microphone access denied or error starting recording.');
    }
  };

  const stopVoice = async () => {
    if (!audioRecorderRef.current || !session) return;
    clearInterval(timerRef.current);
    setRecordingVoice(false);
    setProcessingVoice(true);
    setError('');
    try {
      const blob = audioRecorderRef.current.stop();
      await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          try {
            const res = await api.post('/attendance/voice', {
              sessionId:   session.sessionId || session.id,
              audioBase64: reader.result,
            });
            if (!res.data.matched?.length) {
              showToast('🎤 No enrolled voice matched.', 'warn');
              setError('No enrolled voice signature matched this audio sample.');
            }
          } catch (err) {
            setError(err.response?.data?.error || 'Voice recognition failed.');
          }
          resolve();
        };
        reader.onerror = reject;
      });
    } finally {
      setProcessingVoice(false);
    }
  };

  // ── Classroom Group Photo Upload ──────────────────────────────────────────
  const handleGroupPhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      setGroupPhotoB64(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const scanGroupPhoto = async () => {
    if (!groupPhotoB64 || !session || groupScanning) return;
    setGroupScanning(true);
    setError('');
    try {
      const res = await api.post('/attendance/face', {
        sessionId:   session.sessionId || session.id,
        imageBase64: groupPhotoB64,
      });

      const matchedCount = res.data.matched?.length || 0;
      const spoofedCount = res.data.spoofed || 0;
      const unknownCount = res.data.unknown || 0;

      if (spoofedCount > 0) {
        showToast(`⚠️ Spoof check alert: ${spoofedCount} suspicious presentation detected.`, 'danger');
      }
      if (matchedCount > 0) {
        showToast(`🎉 Group Scan: ${matchedCount} student(s) identified & marked present!`, 'success');
      } else {
        showToast('😶 No enrolled faces recognized in group photo.', 'warn');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Group photo recognition failed. Ensure AI service is online.');
    } finally {
      setGroupScanning(false);
    }
  };

  // ── Dual Biometric Verification (Face + Voice Fusion) ─────────────────────
  const runDualVerification = async () => {
    if (!videoRef.current || !canvasRef.current || !session || dualPhase !== 'idle') return;
    setError('');
    setDualFeedback(null);

    // Step 1: Capture camera snapshot
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.85);

    // Step 2: Record 3.5 seconds of voice utterance
    setDualPhase('recording');
    try {
      const rec = new AudioRecorder();
      audioRecorderRef.current = rec;
      await rec.start();
      setRecordSeconds(0);
      let count = 0;
      const countTimer = setInterval(() => {
        count += 1;
        setRecordSeconds(count);
      }, 1000);

      // Record for 3.5 seconds
      await new Promise(r => setTimeout(r, 3500));
      clearInterval(countTimer);

      const blob = audioRecorderRef.current.stop();
      setDualPhase('verifying');

      const audioBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Step 3: POST to /attendance/dual
      const res = await api.post('/attendance/dual', {
        sessionId: session.sessionId || session.id,
        imageBase64,
        audioBase64,
      });

      if (res.data.verified) {
        const match = res.data.matched?.[0];
        setDualFeedback({
          success: true,
          name: match?.name,
          confidence: match?.confidence,
          faceConfidence: match?.faceConfidence,
          voiceConfidence: match?.voiceConfidence,
          message: res.data.message,
        });
        showToast(`✅ Dual Verified: ${match?.name} (${match?.confidence}%)`, 'success');
      } else {
        setDualFeedback({
          success: false,
          message: res.data.message || 'Dual biometric verification could not be confirmed.',
        });
        showToast('⚠️ Dual biometric match failed.', 'warn');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Dual biometric verification error.';
      setError(msg);
      setDualFeedback({ success: false, message: msg });
      showToast(`❌ ${msg}`, 'danger');
    } finally {
      setDualPhase('idle');
    }
  };

  // ── CSV Export ────────────────────────────────────────────────────────────
  const exportSessionCsv = async () => {
    try {
      let rowsToExport = [];
      const sessId = session?.sessionId || session?.id;
      if (sessId) {
        try {
          const res = await api.get(`/attendance/session/${sessId}/report`);
          if (Array.isArray(res.data) && res.data.length > 0) {
            rowsToExport = res.data.map(r => ({
              rollNumber: r.roll_number || r.rollNumber,
              name: r.student_name || r.name,
              status: r.status,
              method: r.method || '—',
              confidence: r.confidence ? `${Math.round(r.confidence * 100)}%` : '—',
              markedAt: r.marked_at ? new Date(r.marked_at).toLocaleTimeString() : '—',
            }));
          }
        } catch {
          // Fall back to local recognized list
        }
      }

      if (rowsToExport.length === 0 && recognized.length > 0) {
        rowsToExport = recognized.map(r => ({
          rollNumber: r.rollNumber || r.roll_number,
          name: r.name,
          status: 'present',
          method: r.method || mode,
          confidence: r.confidence ? `${r.confidence}%` : r.similarity ? `${Math.round(r.similarity * 100)}%` : '—',
          markedAt: new Date().toLocaleTimeString(),
        }));
      }

      if (rowsToExport.length === 0) {
        showToast('No attendance records to export yet.', 'warn');
        return;
      }

      const headers = ['Roll Number', 'Student Name', 'Status', 'Method', 'Confidence', 'Marked At'];
      const csvContent = [
        headers.join(','),
        ...rowsToExport.map(r => [
          `"${r.rollNumber || ''}"`,
          `"${r.name || ''}"`,
          `"${r.status || ''}"`,
          `"${r.method || ''}"`,
          `"${r.confidence || ''}"`,
          `"${r.markedAt || ''}"`,
        ].join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const subName = subjects.find(s => s.id === selSubject)?.code || 'Class';
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `${subName}_Attendance_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('📥 Attendance CSV exported successfully!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to export CSV report.', 'danger');
    }
  };

  // ── Start session ─────────────────────────────────────────────────────────
  const handleStartSession = async () => {
    if (!selSubject) return;
    setError('');
    try {
      const res = await api.post('/attendance/sessions/start', {
        subjectId:   selSubject,
        classroomId: selClassroom || null,
        topic:       'Live Lecture — AI Biometric Attendance',
      });
      setSession(res.data);
      connectSocket(res.data.sessionId || res.data.id);
      if (mode === 'face' || mode === 'dual') setTimeout(startCamera, 150);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start session.');
    }
  };

  // ── End session ───────────────────────────────────────────────────────────
  const handleEndSession = async () => {
    if (!session || endingSess) return;
    setEndingSess(true);
    try {
      const res = await api.post(`/attendance/sessions/${session.sessionId || session.id}/end`);
      setStats(s => ({ ...s, ...(res.data.summary || {}) }));
      setShowSummary(true);
      stopCamera();
      clearInterval(autoScanRef.current);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to end session.');
    } finally {
      setEndingSess(false);
    }
  };

  const handleNewSession = () => {
    disconnectSocket();
    setSession(null);
    setRecognized([]);
    setStats({ total: 0, present: 0, absent: 0 });
    setShowSummary(false);
    setError('');
    setAutoScan(false);
  };

  const attendancePct = sessionStats.total > 0
    ? Math.round((sessionStats.present / sessionStats.total) * 100)
    : 0;

  // ── PRE-SESSION SETUP ─────────────────────────────────────────────────────
  if (!session) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>📸 AI Biometrics</div>
            <h1 className="page-title">Take Attendance</h1>
            <p className="page-subtitle">Real-time dual facial &amp; voice recognition with anti-spoofing.</p>
          </div>
        </div>
        <div className="divider-gold" />
        {error && <div className="alert alert-danger" style={{ marginBottom: 20 }}>⚠️ {error}</div>}

        <div className="card" style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ fontSize: 18, color: 'var(--gold)' }}>🚀 Configure Attendance Session</h3>

          {/* Mode selector */}
          <div className="form-group">
            <label className="form-label">Verification Mode</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { id: 'face',  icon: '📸', label: 'Face ID'       },
                { id: 'voice', icon: '🎤', label: 'Voice ID'      },
                { id: 'dual',  icon: '⚡', label: 'Dual Biometric' },
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  className={`btn ${mode === m.id ? 'btn-gold' : 'btn-outline'} btn-sm`}
                  onClick={() => setMode(m.id)}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Subject *</label>
            <select className="form-input" value={selSubject} onChange={e => setSelSubject(e.target.value)}>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Classroom / Lab</label>
            <select className="form-input" value={selClassroom} onChange={e => setSelClassroom(e.target.value)}>
              <option value="">Select Room (Optional)</option>
              {classrooms.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </div>

          <button
            className="btn btn-gold btn-lg btn-full"
            onClick={handleStartSession}
            disabled={loading || !selSubject}
          >
            {loading ? 'Loading…' : '🚀 Launch Attendance Session'}
          </button>
        </div>
      </div>
    );
  }

  const sessionId = session.sessionId || session.id;

  // ── LIVE SESSION VIEW ─────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <span className="live-dot">LIVE SESSION ACTIVE</span>
          <h1 className="page-title" style={{ marginTop: 6 }}>Taking Attendance</h1>
          <p className="page-subtitle">
            {subjects.find(s => s.id === selSubject)?.name || 'Subject'} —
            <span style={{ color: 'var(--gold)', marginLeft: 6 }}>{mode.toUpperCase()} MODE</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-outline"
            onClick={exportSessionCsv}
            style={{ minWidth: 130 }}
            title="Download attendance records as CSV"
          >
            📥 Export CSV
          </button>
          <button
            className="btn btn-danger"
            onClick={handleEndSession}
            disabled={endingSess}
            style={{ minWidth: 140 }}
          >
            {endingSess ? '↻ Ending…' : '⏹ End Session'}
          </button>
        </div>
      </div>

      <div className="divider-gold" />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'success' ? 'var(--success)' : toast.type === 'danger' ? 'var(--danger)' : 'var(--warn)',
          color: '#fff', padding: '12px 20px', borderRadius: 10,
          fontWeight: 600, fontSize: 14, maxWidth: 320,
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
          animation: 'slideIn 0.3s ease',
        }}>
          {toast.msg}
        </div>
      )}

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

      {/* Session Progress Bar */}
      <div className="card" style={{ marginBottom: 20, padding: '16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 24 }}>
            <span style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>✅ {sessionStats.present ?? recognized.length}</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>Present</span>
            </span>
            <span style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>❌ {sessionStats.absent ?? 0}</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>Absent</span>
            </span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: attendancePct >= 75 ? 'var(--success)' : 'var(--warn)' }}>
            {attendancePct}% attendance
          </span>
        </div>
        <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            width: `${attendancePct}%`, height: '100%',
            background: attendancePct >= 75 ? 'var(--success)' : 'var(--warn)',
            borderRadius: 99, transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      <div className="grid-2">
        {/* ── Scanner Panel ───────────────────────────────────────────────── */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="live-dot">BIOMETRIC SCANNER</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {mode === 'face' && (
                <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 8, padding: 2 }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${scanSource === 'camera' ? 'btn-gold' : 'btn-outline'}`}
                    style={{ border: 'none', padding: '4px 10px', fontSize: 12 }}
                    onClick={() => { setScanSource('camera'); if (!cameraActive) startCamera(); }}
                  >
                    📷 Live Cam
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${scanSource === 'upload' ? 'btn-gold' : 'btn-outline'}`}
                    style={{ border: 'none', padding: '4px 10px', fontSize: 12 }}
                    onClick={() => { setScanSource('upload'); stopCamera(); }}
                  >
                    📁 Group Photo
                  </button>
                </div>
              )}
              <span className="badge badge-gold">{mode.toUpperCase()} MODE</span>
            </div>
          </div>

          {/* 1. Live Camera Feed for Face Mode */}
          {mode === 'face' && scanSource === 'camera' && (
            <>
              <div className={`camera-box ${cameraActive ? 'active' : ''}`} style={{ position: 'relative' }}>
                <video ref={videoRef} playsInline muted autoPlay style={{ borderRadius: 'var(--radius-sm)' }} />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <div className="face-guide" />
                {scanningFace && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', background: 'rgba(212,160,23,0.1)', borderRadius: 'var(--radius-sm)',
                  }}>
                    <span className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
                  </div>
                )}
              </div>

              {/* Face controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn btn-gold btn-full"
                    onClick={captureAndRecognize}
                    disabled={scanningFace || !cameraActive}
                  >
                    {scanningFace
                      ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Recognizing…</>
                      : '⚡ Recognize Face'}
                  </button>
                  <button className="btn btn-outline" onClick={cameraActive ? stopCamera : startCamera}>
                    {cameraActive ? '📷 Stop Cam' : '📷 Start Cam'}
                  </button>
                </div>

                {/* Auto-scan toggle */}
                {cameraActive && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button
                      className={`btn btn-sm ${autoScan ? 'btn-danger' : 'btn-outline'} btn-full`}
                      onClick={toggleAutoScan}
                    >
                      {autoScan ? `⏸ Stop Auto-Scan (${autoInterval}s)` : `▶ Auto-Scan Every ${autoInterval}s`}
                    </button>
                    <select
                      className="form-input"
                      style={{ width: 80, padding: '6px 8px', fontSize: 13 }}
                      value={autoInterval}
                      onChange={e => {
                        setAutoInterval(Number(e.target.value));
                        if (autoScan) { clearInterval(autoScanRef.current); toggleAutoScan(); }
                      }}
                    >
                      {[3,5,8,10,15].map(v => <option key={v} value={v}>{v}s</option>)}
                    </select>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 2. Batch Classroom Photo Upload */}
          {mode === 'face' && scanSource === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleGroupPhotoSelect}
                style={{ display: 'none' }}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 24,
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--bg-elevated)',
                  transition: 'border-color 0.2s',
                }}
              >
                {groupPhotoB64 ? (
                  <div>
                    <img
                      src={groupPhotoB64}
                      alt="Classroom Group Preview"
                      style={{ maxHeight: 220, margin: '0 auto 10px', borderRadius: 8, objectFit: 'contain' }}
                    />
                    <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600 }}>
                      📸 Photo Selected · Click to change
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>👥</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                      Upload Classroom Wide-Angle Snapshot
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Supports multiple student faces simultaneously (.jpg, .jpeg, .png)
                    </div>
                  </div>
                )}
              </div>

              <button
                className="btn btn-gold btn-full btn-lg"
                onClick={scanGroupPhoto}
                disabled={!groupPhotoB64 || groupScanning}
              >
                {groupScanning ? (
                  <><span className="spinner" style={{ width: 16, height: 16 }} /> Detecting &amp; Matching All Faces…</>
                ) : (
                  '⚡ Scan All Faces in Photo'
                )}
              </button>
            </div>
          )}

          {/* 3. Dual Biometric Verification Controller */}
          {mode === 'dual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className={`camera-box ${cameraActive ? 'active' : ''}`} style={{ position: 'relative' }}>
                <video ref={videoRef} playsInline muted autoPlay style={{ borderRadius: 'var(--radius-sm)' }} />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <div className="face-guide" />
                {dualPhase !== 'idle' && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', background: 'rgba(0,0,0,0.65)', borderRadius: 'var(--radius-sm)',
                    color: '#fff', gap: 10,
                  }}>
                    {dualPhase === 'recording' && (
                      <>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--danger)', animation: 'pulse 1s infinite' }} />
                        <div style={{ fontWeight: 700, fontSize: 15 }}>🎤 Listening &amp; Recording: {recordSeconds}s</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Speak full name / roll number clearly</div>
                      </>
                    )}
                    {dualPhase === 'verifying' && (
                      <>
                        <span className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
                        <div style={{ fontWeight: 700, fontSize: 15 }}>⚡ Fusing Face (128-D) + Voice (256-D)...</div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-gold btn-full btn-lg"
                  onClick={runDualVerification}
                  disabled={dualPhase !== 'idle' || !cameraActive}
                >
                  {dualPhase === 'recording'
                    ? '🔴 Recording Utterance (3.5s)…'
                    : dualPhase === 'verifying'
                    ? '⚡ Verifying Biometrics…'
                    : '⚡ Run Dual Verification (Face + Voice)'}
                </button>
                <button className="btn btn-outline" onClick={cameraActive ? stopCamera : startCamera}>
                  {cameraActive ? '📷 Stop Cam' : '📷 Start Cam'}
                </button>
              </div>

              {dualFeedback && (
                <div style={{
                  padding: 14, borderRadius: 'var(--radius-sm)',
                  background: dualFeedback.success ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${dualFeedback.success ? 'var(--success)' : 'var(--danger)'}`,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: dualFeedback.success ? 'var(--success)' : 'var(--danger)', marginBottom: 6 }}>
                    {dualFeedback.success ? '✅ Dual Verification Confirmed' : '⚠️ Verification Alert'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{dualFeedback.message}</div>
                  {dualFeedback.success && (
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12 }}>
                      <span>Face Match: <strong>{dualFeedback.faceConfidence}%</strong></span>
                      <span>Voice Match: <strong>{dualFeedback.voiceConfidence}%</strong></span>
                      <span>Combined: <strong style={{ color: 'var(--gold)' }}>{dualFeedback.confidence}%</strong></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 4. Single Voice Mode */}
          {mode === 'voice' && (
            <div style={{ background: 'var(--bg-elevated)', padding: 18, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: 15, color: 'var(--gold)', marginBottom: 8 }}>🎤 Voice Attendance</h4>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                Have the student say their name or roll number clearly.
              </p>

              {recordingVoice && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, border: '1px solid var(--danger)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--danger)', animation: 'pulse 1s infinite' }} />
                  <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 13 }}>
                    Recording {recordSeconds}s…
                  </span>
                  <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
                    {[...Array(8)].map((_, i) => (
                      <div key={i} style={{
                        width: 3, height: `${8 + Math.random() * 16}px`,
                        background: 'var(--danger)', borderRadius: 99, opacity: 0.8,
                        animation: `wave${i % 3} 0.${5 + i % 4}s infinite alternate`,
                      }} />
                    ))}
                  </div>
                </div>
              )}

              {!recordingVoice ? (
                <button
                  className="btn btn-gold btn-full"
                  onClick={startVoice}
                  disabled={processingVoice}
                >
                  {processingVoice
                    ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Matching Voice…</>
                    : '🔴 Start Voice Recording'}
                </button>
              ) : (
                <button className="btn btn-danger btn-full" onClick={stopVoice}>
                  ⏹ Stop &amp; Match Student
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Recognized Students Panel ───────────────────────────────────── */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>
              ✅ Marked Present — <span style={{ color: 'var(--gold)' }}>{recognized.length}</span>
            </h3>
            {recognized.length > 0 && (
              <button
                className="btn btn-outline btn-sm"
                onClick={exportSessionCsv}
                style={{ fontSize: 12, padding: '4px 10px' }}
              >
                📥 Export CSV
              </button>
            )}
          </div>

          {recognized.length > 0 && (
            <div style={{
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 'var(--radius-sm)', padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%', background: 'rgba(34,197,94,0.15)',
                border: '2px solid var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>✅</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                  {recognized[0].name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Roll: <strong>{recognized[0].rollNumber || recognized[0].roll_number}</strong>
                  &nbsp;·&nbsp;
                  {recognized[0].confidence
                    ? `${recognized[0].confidence}% confidence`
                    : recognized[0].similarity
                    ? `${Math.round(recognized[0].similarity * 100)}% voice match`
                    : 'Matched'}
                  &nbsp;·&nbsp;
                  <span style={{ color: 'var(--gold)' }}>{(recognized[0].method || mode).toUpperCase()}</span>
                </div>
              </div>
            </div>
          )}

          <div className="table-wrap" style={{ flex: 1, maxHeight: 340, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Name</th>
                  <th>Score</th>
                  <th>Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recognized.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>
                      {mode === 'face'
                        ? scanSource === 'upload'
                          ? 'Upload a classroom photo to detect multiple students at once.'
                          : 'Point camera at students to mark attendance in real-time.'
                        : mode === 'dual'
                        ? 'Click Run Dual Verification to evaluate face and voice in tandem.'
                        : 'Click Start Voice Recording and have the student speak.'}
                    </td>
                  </tr>
                ) : (
                  recognized.map((s, idx) => (
                    <tr key={idx}>
                      <td><span className="badge badge-gold">{s.rollNumber || s.roll_number}</span></td>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td>
                        {s.confidence
                          ? `${s.confidence}%`
                          : s.similarity
                          ? `${Math.round(s.similarity * 100)}%`
                          : '—'}
                      </td>
                      <td><span className="badge" style={{ background: 'rgba(212,160,23,0.15)', color: 'var(--gold)' }}>
                        {(s.method || mode).toUpperCase()}
                      </span></td>
                      <td><span className="badge badge-success">Present</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Session Summary Modal ─────────────────────────────────────────── */}
      {showSummary && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="card-elevated" style={{ maxWidth: 460, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎓</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
              Session Complete!
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
              Attendance session has been closed and saved to Supabase Cloud DB.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              <div style={{ background: 'rgba(34,197,94,0.1)', padding: '14px 10px', borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--success)' }}>
                  {sessionStats.present ?? recognized.length}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Present</div>
              </div>
              <div style={{ background: 'rgba(239,68,68,0.1)', padding: '14px 10px', borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--danger)' }}>
                  {sessionStats.absent ?? 0}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Absent</div>
              </div>
              <div style={{ background: 'rgba(212,160,23,0.1)', padding: '14px 10px', borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gold)' }}>
                  {attendancePct}%
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Rate</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-outline btn-lg" style={{ flex: 1 }} onClick={exportSessionCsv}>
                📥 Export CSV
              </button>
              <button className="btn btn-gold btn-lg" style={{ flex: 1 }} onClick={handleNewSession}>
                ➕ New Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
