import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import AdminHome from './pages/AdminHome.jsx';
import HodHome from './pages/HodHome.jsx';
import FacultyHome from './pages/FacultyHome.jsx';
import FacultySessionsPage from './pages/FacultySessionsPage.jsx';
import FacultyHistoryPage from './pages/FacultyHistoryPage.jsx';
import FacultyProfilePage from './pages/FacultyProfilePage.jsx';
import AdminProfilePage from './pages/AdminProfilePage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import StudentHome from './pages/StudentHome.jsx';
import StudentAttendancePage from './pages/StudentAttendancePage.jsx';
import StudentEnrollPage from './pages/StudentEnrollPage.jsx';
import StudentHistoryPage from './pages/StudentHistoryPage.jsx';
import StudentFacultyPage from './pages/StudentFacultyPage.jsx';
import StudentProfilePage from './pages/StudentProfilePage.jsx';
import DepartmentsPage from './pages/DepartmentsPage.jsx';
import CoursesPage from './pages/CoursesPage.jsx';
import SemestersPage from './pages/SemestersPage.jsx';
import ClassroomsPage from './pages/ClassroomsPage.jsx';
import FacultyPage from './pages/FacultyPage.jsx';
import StudentsPage from './pages/StudentsPage.jsx';
import SubjectsPage from './pages/SubjectsPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import TakeAttendancePage from './pages/TakeAttendancePage.jsx';
import TimetablePage from './pages/TimetablePage.jsx';
import ThemesPage from './pages/ThemesPage.jsx';
import Shell from './components/Shell.jsx';

function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  const map = {
    admin: '/admin',
    hod: '/hod',
    faculty: '/faculty',
    student: '/student',
  };
  return <Navigate to={map[user.role] || '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route
        element={
          <Guard>
            <Shell />
          </Guard>
        }
      >
        {/* Admin Routes */}
        <Route path="/admin" element={<Guard roles={['admin']}><AdminHome /></Guard>} />
        <Route path="/admin/departments" element={<Guard roles={['admin']}><DepartmentsPage /></Guard>} />
        <Route path="/admin/courses" element={<Guard roles={['admin']}><CoursesPage /></Guard>} />
        <Route path="/admin/semesters" element={<Guard roles={['admin']}><SemestersPage /></Guard>} />
        <Route path="/admin/classrooms" element={<Guard roles={['admin']}><ClassroomsPage /></Guard>} />
        <Route path="/admin/faculty" element={<Guard roles={['admin']}><FacultyPage /></Guard>} />
        <Route path="/admin/students" element={<Guard roles={['admin']}><StudentsPage /></Guard>} />
        <Route path="/admin/subjects" element={<Guard roles={['admin']}><SubjectsPage /></Guard>} />
        <Route path="/admin/timetable" element={<Guard roles={['admin']}><TimetablePage /></Guard>} />
        <Route path="/admin/analytics" element={<Guard roles={['admin']}><AnalyticsPage /></Guard>} />
        <Route path="/admin/reports" element={<Guard roles={['admin']}><ReportsPage /></Guard>} />
        <Route path="/admin/profile" element={<Guard roles={['admin']}><AdminProfilePage /></Guard>} />

        {/* HOD Routes */}
        <Route path="/hod" element={<Guard roles={['hod']}><HodHome /></Guard>} />
        <Route path="/hod/faculty" element={<Guard roles={['hod']}><FacultyPage /></Guard>} />
        <Route path="/hod/students" element={<Guard roles={['hod']}><StudentsPage /></Guard>} />
        <Route path="/hod/subjects" element={<Guard roles={['hod']}><SubjectsPage /></Guard>} />
        <Route path="/hod/timetable" element={<Guard roles={['hod']}><TimetablePage /></Guard>} />
        <Route path="/hod/analytics" element={<Guard roles={['hod']}><AnalyticsPage /></Guard>} />
        <Route path="/hod/at-risk" element={<Guard roles={['hod']}><AnalyticsPage /></Guard>} />

        {/* Faculty Routes — Dedicated Clean Feature Screens */}
        <Route path="/faculty" element={<Guard roles={['faculty']}><FacultyHome /></Guard>} />
        <Route path="/faculty/take" element={<Guard roles={['faculty']}><TakeAttendancePage /></Guard>} />
        <Route path="/faculty/sessions" element={<Guard roles={['faculty']}><FacultySessionsPage /></Guard>} />
        <Route path="/faculty/history" element={<Guard roles={['faculty']}><FacultyHistoryPage /></Guard>} />
        <Route path="/faculty/subjects" element={<Guard roles={['faculty']}><SubjectsPage /></Guard>} />
        <Route path="/faculty/students" element={<Guard roles={['faculty']}><StudentsPage /></Guard>} />
        <Route path="/faculty/timetable" element={<Guard roles={['faculty']}><TimetablePage /></Guard>} />
        <Route path="/faculty/analytics" element={<Guard roles={['faculty']}><AnalyticsPage /></Guard>} />
        <Route path="/faculty/profile" element={<Guard roles={['faculty']}><FacultyProfilePage /></Guard>} />

        {/* Student Routes — Dedicated Clean Feature Screens */}
        <Route path="/student" element={<Guard roles={['student']}><StudentHome /></Guard>} />
        <Route path="/student/attendance" element={<Guard roles={['student']}><StudentAttendancePage /></Guard>} />
        <Route path="/student/timetable" element={<Guard roles={['student']}><TimetablePage /></Guard>} />
        <Route path="/student/history" element={<Guard roles={['student']}><StudentHistoryPage /></Guard>} />
        <Route path="/student/enroll" element={<Guard roles={['student']}><StudentEnrollPage /></Guard>} />
        <Route path="/student/faculty" element={<Guard roles={['student']}><StudentFacultyPage /></Guard>} />
        <Route path="/student/profile" element={<Guard roles={['student']}><StudentProfilePage /></Guard>} />

        {/* Themes & Appearance Settings */}
        <Route path="/themes" element={<ThemesPage />} />
        <Route path="/settings/themes" element={<ThemesPage />} />
      </Route>
      {/* Standalone Themes Preview / Route */}
      <Route path="/themes-preview" element={<ThemesPage />} />
    </Routes>
  );
}
