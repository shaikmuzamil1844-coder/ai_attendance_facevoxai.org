// components/Shell.jsx — App layout with sidebar + main content
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const NAV_BY_ROLE = {
  admin: [
    { section: 'Overview',      items: [{ to: '/admin',            icon: '⬡', label: 'Dashboard' }] },
    { section: 'Organization',  items: [
      { to: '/admin/departments', icon: '🏛', label: 'Departments' },
      { to: '/admin/courses',     icon: '📚', label: 'Courses' },
      { to: '/admin/semesters',   icon: '📅', label: 'Semesters' },
      { to: '/admin/classrooms',  icon: '🚪', label: 'Classrooms' },
    ]},
    { section: 'People', items: [
      { to: '/admin/faculty',     icon: '👩‍🏫', label: 'Faculty' },
      { to: '/admin/students',    icon: '🎓', label: 'Students' },
    ]},
    { section: 'Academics', items: [
      { to: '/faculty/take',      icon: '📸', label: 'Take Attendance' },
      { to: '/admin/subjects',    icon: '📖', label: 'Subjects' },
      { to: '/admin/timetable',   icon: '🗓', label: 'Timetable' },
    ]},
    { section: 'Analytics', items: [
      { to: '/admin/analytics',   icon: '📊', label: 'Analytics' },
      { to: '/admin/reports',     icon: '📄', label: 'Reports' },
    ]},
  ],
  hod: [
    { section: 'Overview', items: [{ to: '/hod', icon: '⬡', label: 'Dashboard' }] },
    { section: 'Department', items: [
      { to: '/hod/faculty',      icon: '👩‍🏫', label: 'Faculty' },
      { to: '/hod/students',     icon: '🎓', label: 'Students' },
      { to: '/hod/subjects',     icon: '📖', label: 'Subjects' },
      { to: '/hod/timetable',    icon: '🗓', label: 'Timetable' },
    ]},
    { section: 'Analytics', items: [
      { to: '/hod/analytics',    icon: '📊', label: 'Analytics' },
      { to: '/hod/at-risk',      icon: '⚠️', label: 'At-Risk Students' },
    ]},
  ],
  faculty: [
    { section: 'Overview', items: [{ to: '/faculty', icon: '⬡', label: 'Dashboard' }] },
    { section: 'Attendance', items: [
      { to: '/faculty/take',     icon: '📸', label: 'Take Attendance' },
      { to: '/faculty/sessions', icon: '📋', label: 'Sessions' },
      { to: '/faculty/history',  icon: '🕐', label: 'History' },
    ]},
    { section: 'Classes & Schedule', items: [
      { to: '/faculty/subjects', icon: '📖', label: 'My Subjects' },
      { to: '/faculty/students', icon: '🎓', label: 'My Students' },
      { to: '/faculty/timetable',icon: '🗓', label: 'My Timetable' },
    ]},
    { section: 'Reports', items: [
      { to: '/faculty/analytics',icon: '📊', label: 'Analytics' },
    ]},
  ],
  student: [
    { section: 'Overview', items: [{ to: '/student', icon: '⬡', label: 'Dashboard' }] },
    { section: 'Academics & Schedule', items: [
      { to: '/student/attendance', icon: '📊', label: 'My Attendance' },
      { to: '/student/timetable',  icon: '🗓', label: 'My Timetable' },
      { to: '/student/history',    icon: '🕐', label: 'Attendance History' },
    ]},
    { section: 'Profile & Biometrics', items: [
      { to: '/student/enroll',     icon: '🤳', label: 'Biometric Enroll' },
      { to: '/student/profile',    icon: '👤', label: 'My Profile' },
    ]},
  ],
};

export default function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const nav = NAV_BY_ROLE[user?.role] || [];
  const initials = user?.fullName?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>🎓 FaceVoxAI</h2>
          <span>Attendance Platform v1.0</span>
        </div>

        <nav className="sidebar-nav">
          {nav.map(section => (
            <div key={section.section}>
              <div className="nav-section-title">{section.section}</div>
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === `/${user?.role}`}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.fullName}
              </div>
              <div className="user-role">{user?.role}</div>
            </div>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => { logout(); navigate('/login'); }}
              title="Logout"
              style={{ padding: 6 }}
            >
              🚪
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
