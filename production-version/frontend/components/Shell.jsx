// components/Shell.jsx — App layout with sidebar + main content
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import ThemedIcon from './ThemedIcon';

const SETTINGS_SECTION = {
  section: 'Preferences',
  items: [{ to: '/themes', icon: '🎨', iconName: 'themes', label: 'Themes' }],
};

const NAV_BY_ROLE = {
  admin: [
    { section: 'Overview',      items: [{ to: '/admin',            icon: '⬡', iconName: 'dashboard', label: 'Dashboard' }] },
    { section: 'Organization',  items: [
      { to: '/admin/departments', icon: '🏛', iconName: 'departments', label: 'Departments' },
      { to: '/admin/courses',     icon: '📚', iconName: 'courses', label: 'Courses' },
      { to: '/admin/semesters',   icon: '📅', iconName: 'semesters', label: 'Semesters' },
      { to: '/admin/classrooms',  icon: '🚪', iconName: 'classrooms', label: 'Classrooms' },
    ]},
    { section: 'People', items: [
      { to: '/admin/faculty',     icon: '👩‍🏫', iconName: 'faculty', label: 'Faculty' },
      { to: '/admin/students',    icon: '🎓', iconName: 'students', label: 'Students' },
    ]},
    { section: 'Academics', items: [
      { to: '/faculty/take',      icon: '📸', iconName: 'attendance', label: 'Take Attendance' },
      { to: '/admin/subjects',    icon: '📖', iconName: 'subjects', label: 'Subjects' },
      { to: '/admin/timetable',   icon: '🗓', iconName: 'timetable', label: 'Timetable' },
    ]},
    { section: 'Analytics', items: [
      { to: '/admin/analytics',   icon: '📊', iconName: 'analytics', label: 'Analytics' },
      { to: '/admin/reports',     icon: '📄', iconName: 'reports', label: 'Reports' },
    ]},
    SETTINGS_SECTION,
  ],
  hod: [
    { section: 'Overview', items: [{ to: '/hod', icon: '⬡', iconName: 'dashboard', label: 'Dashboard' }] },
    { section: 'Department', items: [
      { to: '/hod/faculty',      icon: '👩‍🏫', iconName: 'faculty', label: 'Faculty' },
      { to: '/hod/students',     icon: '🎓', iconName: 'students', label: 'Students' },
      { to: '/hod/subjects',     icon: '📖', iconName: 'subjects', label: 'Subjects' },
      { to: '/hod/timetable',    icon: '🗓', iconName: 'timetable', label: 'Timetable' },
    ]},
    { section: 'Analytics', items: [
      { to: '/hod/analytics',    icon: '📊', iconName: 'analytics', label: 'Analytics' },
      { to: '/hod/at-risk',      icon: '⚠️', iconName: 'atRisk', label: 'At-Risk Students' },
    ]},
    SETTINGS_SECTION,
  ],
  faculty: [
    { section: 'Overview', items: [{ to: '/faculty', icon: '⬡', iconName: 'dashboard', label: 'Dashboard' }] },
    { section: 'Attendance', items: [
      { to: '/faculty/take',     icon: '📸', iconName: 'attendance', label: 'Take Attendance' },
      { to: '/faculty/sessions', icon: '📋', iconName: 'sessions', label: 'Sessions' },
      { to: '/faculty/history',  icon: '🕐', iconName: 'history', label: 'History' },
    ]},
    { section: 'Classes & Schedule', items: [
      { to: '/faculty/subjects', icon: '📖', iconName: 'subjects', label: 'My Subjects' },
      { to: '/faculty/students', icon: '🎓', iconName: 'students', label: 'My Students' },
      { to: '/faculty/timetable',icon: '🗓', iconName: 'timetable', label: 'My Timetable' },
    ]},
    { section: 'Reports', items: [
      { to: '/faculty/analytics',icon: '📊', iconName: 'analytics', label: 'Analytics' },
    ]},
    SETTINGS_SECTION,
  ],
  student: [
    { section: 'Overview', items: [{ to: '/student', icon: '⬡', iconName: 'dashboard', label: 'Dashboard' }] },
    { section: 'Academics & Schedule', items: [
      { to: '/student/attendance', icon: '📊', iconName: 'analytics', label: 'My Attendance' },
      { to: '/student/timetable',  icon: '🗓', iconName: 'timetable', label: 'My Timetable' },
      { to: '/student/history',    icon: '🕐', iconName: 'history', label: 'Attendance History' },
    ]},
    { section: 'Enrollment & Profile', items: [
      { to: '/student/enroll',     icon: '📝', iconName: 'subjects', label: 'Enroll Subjects' },
      { to: '/student/profile',    icon: '👤', iconName: 'profile', label: 'My Profile' },
    ]},
    SETTINGS_SECTION,
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
          <span>Attendance Platform v2.0</span>
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
                  <span className="nav-icon">
                    <ThemedIcon name={item.iconName} fallback={item.icon} size={16} />
                  </span>
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
              onClick={() => navigate('/themes')}
              title="Theme Settings"
              style={{ padding: 6, color: 'var(--primary)' }}
            >
              <ThemedIcon name="themes" fallback="🎨" size={16} />
            </button>
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
