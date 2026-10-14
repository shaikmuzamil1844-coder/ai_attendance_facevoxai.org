// pages/LoginPage.jsx — 3-Role Login & Student Self-Registration Portal
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/client';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  // Active role tab: 'admin', 'faculty', 'student'
  const [activeRole, setActiveRole] = useState('faculty');
  // Student mode: 'login' or 'register'
  const [studentMode, setStudentMode] = useState('login');
  // Faculty mode: 'login' or 'register'
  const [facultyMode, setFacultyMode] = useState('login');

  // Login form state
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Default fallback departments and courses to ensure registration is never blocked
  const DEFAULT_DEPTS = [
    { id: '59086344-2f32-4402-aec6-c690c8267824', code: 'CSE', name: 'Computer Science & Engineering' },
  ];
  const DEFAULT_COURSES = [
    { id: '683f31d3-7ed0-4c7c-aee8-5e47cad62792', department_id: '59086344-2f32-4402-aec6-c690c8267824', code: 'B.TECH', name: 'Bachelor of Technology' },
  ];

  // Student registration form state
  const [regForm, setRegForm] = useState({
    rollNumber: '',
    name: '',
    email: '',
    password: '',
    departmentId: DEFAULT_DEPTS[0].id,
    courseId: DEFAULT_COURSES[0].id,
    phone: '',
  });
  const [departments, setDepartments] = useState(DEFAULT_DEPTS);
  const [courses, setCourses] = useState(DEFAULT_COURSES);
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState('');

  // Faculty registration form state
  const [facultyRegForm, setFacultyRegForm] = useState({
    name: '',
    email: '',
    password: '',
    departmentId: DEFAULT_DEPTS[0].id,
    designation: 'Assistant Professor',
    employeeCode: '',
    phone: '',
  });
  const [facultyRegLoading, setFacultyRegLoading] = useState(false);
  const [facultyRegSuccess, setFacultyRegSuccess] = useState('');

  // Fetch departments & courses for registration
  useEffect(() => {
    api.get('/auth/meta')
      .then(res => {
        if (res.data.departments?.length > 0) {
          setDepartments(res.data.departments);
          const firstDeptId = res.data.departments[0].id;
          setRegForm(p => ({
            ...p,
            departmentId: p.departmentId || firstDeptId,
            courseId: p.courseId || res.data.courses?.[0]?.id || '',
          }));
          setFacultyRegForm(p => ({
            ...p,
            departmentId: p.departmentId || firstDeptId,
          }));
        }
        if (res.data.courses?.length > 0) {
          setCourses(res.data.courses);
        }
      })
      .catch(() => {});
  }, []);

  // Filter courses by selected department
  const filteredCourses = courses.filter(c => !regForm.departmentId || c.department_id === regForm.departmentId);

  // Quick credentials autofill
  const handleAutofill = (role) => {
    setError('');
    setRegSuccess('');
    setFacultyRegSuccess('');
    setActiveRole(role);
    setStudentMode('login');
    setFacultyMode('login');
    if (role === 'admin') {
      setForm({ identifier: 'admin@facevoxai.com', password: 'AdminPassword123!' });
    } else if (role === 'faculty') {
      setForm({ identifier: 'shaikmuzzu0507@gmail.com', password: 'FacultyPassword123!' });
    } else if (role === 'student') {
      setForm({ identifier: '111233445', password: 'StudentPassword123!' });
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.identifier, form.password);
      const paths = { admin: '/admin', hod: '/hod', faculty: '/faculty', student: '/student' };
      navigate(paths[user.role] || '/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setRegSuccess('');
    setRegLoading(true);

    try {
      const res = await api.post('/auth/register-student', regForm);
      setRegSuccess('🎉 Student registered successfully! Logging you in…');
      // Store token and redirect
      if (res.data.accessToken) {
        localStorage.setItem('fv_token', res.data.accessToken);
        localStorage.setItem('fv_refresh', res.data.refreshToken);
        window.location.href = '/student';
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setRegLoading(false);
    }
  };

  const handleFacultyRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFacultyRegSuccess('');
    setFacultyRegLoading(true);

    try {
      const res = await api.post('/auth/register-faculty', facultyRegForm);
      setFacultyRegSuccess('🎉 Faculty registered successfully! Accessing portal…');
      if (res.data.accessToken) {
        localStorage.setItem('fv_token', res.data.accessToken);
        localStorage.setItem('fv_refresh', res.data.refreshToken);
        window.location.href = '/faculty';
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Faculty registration failed. Please check details.');
    } finally {
      setFacultyRegLoading(false);
    }
  };

  const roleMeta = {
    admin: {
      title: 'Administrator Portal',
      subtitle: 'Complete control over departments, courses, faculty, students & institutional analytics',
      icon: '👑',
      badge: 'SUPER ADMIN ACCESS',
      idLabel: 'Admin Email Address',
      idPlaceholder: 'admin@facevoxai.com',
    },
    faculty: {
      title: 'Faculty Portal',
      subtitle: 'Conduct live multi-modal attendance (Face, Voice, Dual) for your assigned subjects',
      icon: '👨‍🏫',
      badge: 'FACULTY & TEACHING STAFF',
      idLabel: 'Faculty Email or Employee Code',
      idPlaceholder: 'e.g. shaikmuzzu0507@gmail.com or FAC-101',
    },
    student: {
      title: 'Student Portal',
      subtitle: 'Track your attendance records and configure your Face ID & Voice Biometrics',
      icon: '🎓',
      badge: 'STUDENT ACCESS',
      idLabel: 'Register / Roll Number or Email',
      idPlaceholder: 'e.g. 111233445 or student@domain.com',
    },
  };

  const currentRole = roleMeta[activeRole];

  return (
    <div className="login-page" style={{ minHeight: '100vh', padding: '40px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Background ambient lighting */}
      <div className="login-glow" style={{ top: '-180px', left: '-180px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(212,160,23,0.15) 0%, transparent 70%)' }} />
      <div className="login-glow" style={{ bottom: '-180px', right: '-180px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(212,160,23,0.1) 0%, transparent 70%)' }} />

      <div className="login-card" style={{ maxWidth: 540, width: '100%', padding: '36px 32px' }}>
        {/* Brand Header */}
        <div className="login-logo" style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 44, marginBottom: 6 }}>🎓</div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', margin: 0, color: 'var(--text-primary)' }}>
            Face<span style={{ color: 'var(--gold)' }}>Vox</span>AI
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Intelligent AI Attendance & Biometrics Platform</p>
          <div style={{ width: 44, height: 2, background: 'linear-gradient(90deg, transparent, var(--gold), transparent)', margin: '12px auto 0', borderRadius: 99 }} />
        </div>

        {/* 3-Role Switcher Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
          background: 'var(--bg-elevated)',
          padding: 5,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          marginBottom: 20
        }}>
          <button
            type="button"
            className={`btn btn-sm ${activeRole === 'student' ? 'btn-gold' : 'btn-ghost'}`}
            style={{ padding: '8px 4px', fontSize: 13, fontWeight: 700 }}
            onClick={() => { setActiveRole('student'); setError(''); }}
          >
            🎓 Student
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeRole === 'faculty' ? 'btn-gold' : 'btn-ghost'}`}
            style={{ padding: '8px 4px', fontSize: 13, fontWeight: 700 }}
            onClick={() => { setActiveRole('faculty'); setError(''); }}
          >
            👨‍🏫 Faculty
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeRole === 'admin' ? 'btn-gold' : 'btn-ghost'}`}
            style={{ padding: '8px 4px', fontSize: 13, fontWeight: 700 }}
            onClick={() => { setActiveRole('admin'); setError(''); }}
          >
            👑 Admin
          </button>
        </div>

        {/* Selected Role Banner */}
        <div style={{
          background: 'rgba(212,160,23,0.06)',
          border: '1px solid rgba(212,160,23,0.2)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <div style={{ fontSize: 24 }}>{currentRole.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)', margin: 0 }}>{currentRole.title}</h3>
              <span className="badge badge-gold" style={{ fontSize: 9 }}>{currentRole.badge}</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{currentRole.subtitle}</p>
          </div>
        </div>

        {/* Student Sub-Tabs: Sign In vs Register New Student */}
        {activeRole === 'student' && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => { setStudentMode('login'); setError(''); setRegSuccess(''); }}
              style={{
                flex: 1,
                padding: '8px 0',
                background: 'none',
                border: 'none',
                borderBottom: studentMode === 'login' ? '2px solid var(--gold)' : '2px solid transparent',
                color: studentMode === 'login' ? 'var(--gold)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              🔑 Student Sign In
            </button>
            <button
              type="button"
              onClick={() => { setStudentMode('register'); setError(''); setRegSuccess(''); }}
              style={{
                flex: 1,
                padding: '8px 0',
                background: 'none',
                border: 'none',
                borderBottom: studentMode === 'register' ? '2px solid var(--gold)' : '2px solid transparent',
                color: studentMode === 'register' ? 'var(--gold)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              📝 Register New Student
            </button>
          </div>
        )}

        {/* Faculty Sub-Tabs: Sign In vs Register New Faculty */}
        {activeRole === 'faculty' && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => { setFacultyMode('login'); setError(''); setFacultyRegSuccess(''); }}
              style={{
                flex: 1,
                padding: '8px 0',
                background: 'none',
                border: 'none',
                borderBottom: facultyMode === 'login' ? '2px solid var(--gold)' : '2px solid transparent',
                color: facultyMode === 'login' ? 'var(--gold)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              🔑 Faculty Sign In
            </button>
            <button
              type="button"
              onClick={() => { setFacultyMode('register'); setError(''); setFacultyRegSuccess(''); }}
              style={{
                flex: 1,
                padding: '8px 0',
                background: 'none',
                border: 'none',
                borderBottom: facultyMode === 'register' ? '2px solid var(--gold)' : '2px solid transparent',
                color: facultyMode === 'register' ? 'var(--gold)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              📝 Register as Faculty
            </button>
          </div>
        )}

        {/* Error / Success Notifications */}
        {error && (
          <div className="alert alert-danger" style={{ fontSize: 13, marginBottom: 16 }}>
            ⚠️ {error}
          </div>
        )}
        {regSuccess && (
          <div className="alert alert-success" style={{ fontSize: 13, marginBottom: 16 }}>
            {regSuccess}
          </div>
        )}
        {facultyRegSuccess && (
          <div className="alert alert-success" style={{ fontSize: 13, marginBottom: 16 }}>
            {facultyRegSuccess}
          </div>
        )}

        {/* Sign In Form */}
        {((activeRole === 'student' && studentMode === 'login') ||
          (activeRole === 'faculty' && facultyMode === 'login') ||
          activeRole === 'admin') && (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">{currentRole.idLabel}</label>
              <input
                id="login-identifier"
                className="form-input"
                type="text"
                placeholder={currentRole.idPlaceholder}
                value={form.identifier}
                onChange={e => setForm(p => ({ ...p, identifier: e.target.value }))}
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0 }}>Password</label>
              </div>
              <input
                id="login-password"
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              className="btn btn-gold btn-lg btn-full"
              disabled={loading}
              style={{ marginTop: 4 }}
            >
              {loading ? (
                <><span className="spinner" style={{ width: 16, height: 16 }} /> Authenticating…</>
              ) : (
                `→ Sign In as ${activeRole === 'student' ? 'Student' : activeRole === 'faculty' ? 'Faculty' : 'Admin'}`
              )}
            </button>
          </form>
        )}

        {/* Faculty Self-Registration Form */}
        {activeRole === 'faculty' && facultyMode === 'register' && (
          <form onSubmit={handleFacultyRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. Dr. Priya Sharma"
                  value={facultyRegForm.name}
                  onChange={e => setFacultyRegForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Designation / Role *</label>
                <select
                  className="form-input"
                  value={facultyRegForm.designation}
                  onChange={e => setFacultyRegForm(p => ({ ...p, designation: e.target.value }))}
                  required
                >
                  <option value="Assistant Professor">Assistant Professor</option>
                  <option value="Associate Professor">Associate Professor</option>
                  <option value="Professor">Professor</option>
                  <option value="Lecturer">Lecturer</option>
                  <option value="Visiting Faculty">Visiting Faculty</option>
                  <option value="Head of Department">Head of Department (HOD)</option>
                </select>
              </div>
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Department *</label>
                <select
                  className="form-input"
                  value={facultyRegForm.departmentId}
                  onChange={e => setFacultyRegForm(p => ({ ...p, departmentId: e.target.value }))}
                  required
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Faculty Code (Optional)</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Leave blank for auto FAC-ID"
                  value={facultyRegForm.employeeCode}
                  onChange={e => setFacultyRegForm(p => ({ ...p, employeeCode: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Faculty Official Email *</label>
              <input
                className="form-input"
                type="email"
                placeholder="faculty.name@institution.edu"
                value={facultyRegForm.email}
                onChange={e => setFacultyRegForm(p => ({ ...p, email: e.target.value }))}
                required
              />
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Create Password *</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="At least 6 chars"
                  value={facultyRegForm.password}
                  onChange={e => setFacultyRegForm(p => ({ ...p, password: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number (Optional)</label>
                <input
                  className="form-input"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={facultyRegForm.phone}
                  onChange={e => setFacultyRegForm(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-gold btn-lg btn-full"
              disabled={facultyRegLoading}
              style={{ marginTop: 6 }}
            >
              {facultyRegLoading ? (
                <><span className="spinner" style={{ width: 16, height: 16 }} /> Registering Faculty Member…</>
              ) : (
                '✨ Complete Faculty Registration & Access Portal'
              )}
            </button>
          </form>
        )}

        {/* Student Self-Registration Form */}
        {activeRole === 'student' && studentMode === 'register' && (
          <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. Alex Johnson"
                  value={regForm.name}
                  onChange={e => setRegForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Register / Roll No *</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. 21CS101"
                  value={regForm.rollNumber}
                  onChange={e => setRegForm(p => ({ ...p, rollNumber: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Department *</label>
                <select
                  className="form-input"
                  value={regForm.departmentId}
                  onChange={e => setRegForm(p => ({ ...p, departmentId: e.target.value }))}
                  required
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Course / Degree *</label>
                <select
                  className="form-input"
                  value={regForm.courseId}
                  onChange={e => setRegForm(p => ({ ...p, courseId: e.target.value }))}
                  required
                >
                  {filteredCourses.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Student Email *</label>
              <input
                className="form-input"
                type="email"
                placeholder="student@institution.edu"
                value={regForm.email}
                onChange={e => setRegForm(p => ({ ...p, email: e.target.value }))}
                required
              />
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Create Password *</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="At least 6 chars"
                  value={regForm.password}
                  onChange={e => setRegForm(p => ({ ...p, password: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone (Optional)</label>
                <input
                  className="form-input"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={regForm.phone}
                  onChange={e => setRegForm(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-gold btn-lg btn-full"
              disabled={regLoading}
              style={{ marginTop: 6 }}
            >
              {regLoading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Creating Student Profile…</> : '✨ Complete Registration & Enter'}
            </button>
          </form>
        )}

        {/* Quick Demo Autofill Chips */}
        <div style={{ marginTop: 24, padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
          <p style={{ fontSize: 11, textAlign: 'center', color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            ⚡ 1-Click Demo Login Fill
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => handleAutofill('admin')}
              style={{ fontSize: 11, padding: '6px 4px', border: activeRole === 'admin' ? '1px solid var(--gold)' : '1px solid var(--border)' }}
            >
              👑 Admin Demo
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => handleAutofill('faculty')}
              style={{ fontSize: 11, padding: '6px 4px', border: activeRole === 'faculty' ? '1px solid var(--gold)' : '1px solid var(--border)' }}
            >
              👨‍🏫 Faculty Demo
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => handleAutofill('student')}
              style={{ fontSize: 11, padding: '6px 4px', border: activeRole === 'student' ? '1px solid var(--gold)' : '1px solid var(--border)' }}
            >
              🎓 Student Demo
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 18 }}>
          🔒 Secured with JWT & pgvector 128/256-D AI Biometrics
        </p>
      </div>
    </div>
  );
}
