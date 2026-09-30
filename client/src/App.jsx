import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './context/AuthContext';

// Layout
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import NotificationsModal from './components/layout/NotificationsModal';

// Auth Pages & Modals
import Login from './pages/auth/Login';
import ChangePasswordModal from './components/auth/ChangePasswordModal';

// Admin Pages
import Dashboard from './pages/admin/Dashboard';
import Courses from './pages/admin/Courses';
import Lectures from './pages/admin/Lectures';
import Exams from './pages/admin/Exams';
import ExamBuilder from './pages/admin/ExamBuilder';
import Results from './pages/admin/Results';
import Students from './pages/admin/Students';
import Assistants from './pages/admin/Assistants';
import Announcements from './pages/admin/Announcements';

// Student Pages
import MyCourses from './pages/student/MyCourses';
import MyExams from './pages/student/MyExams';
import TakeExam from './pages/student/TakeExam';
import MyGrades from './pages/student/MyGrades';

function MainApp() {
  const { i18n } = useTranslation();
  const { user, loading, isAuthenticated, isAdmin, isStudent } = useAuth();

  const [currentTab, setCurrentTab] = useState(isAdmin ? 'dashboard' : 'myCourses');
  const [selectedExamForBuilder, setSelectedExamForBuilder] = useState(null);
  const [activeExamId, setActiveExamId] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);

  // Sync RTL/LTR with current language
  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  // Set default tab on login
  useEffect(() => {
    if (user) {
      if (user.role === 'student') {
        setCurrentTab('myCourses');
      } else {
        setCurrentTab('dashboard');
      }
    }
  }, [user]);

  if (loading) {
    return (
      <div className="status-loading" style={{ minHeight: '100vh', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  // Not logged in -> Show Login
  if (!isAuthenticated) {
    return <Login />;
  }

  // Active exam taking mode (immersive view with AntiScreenshotShield)
  if (activeExamId) {
    return <TakeExam examId={activeExamId} onFinish={() => setActiveExamId(null)} />;
  }

  return (
    <div className="app">
      {/* Top Navbar */}
      <Navbar onOpenNotifications={() => setShowNotifications(true)} />

      {/* Main Layout: Sidebar + Dynamic Content */}
      <div className="portal-layout">
        <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

        <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          {/* Admin Views */}
          {isAdmin && (
            <>
              {currentTab === 'dashboard' && <Dashboard />}
              {currentTab === 'courses' && <Courses />}
              {currentTab === 'lectures' && <Lectures />}
              {currentTab === 'exams' && (
                <Exams
                  onSelectExamForBuilder={(exam) => {
                    setSelectedExamForBuilder(exam);
                    setCurrentTab('builder');
                  }}
                />
              )}
              {currentTab === 'builder' && selectedExamForBuilder && (
                <ExamBuilder
                  exam={selectedExamForBuilder}
                  onBack={() => setCurrentTab('exams')}
                />
              )}
              {currentTab === 'results' && <Results />}
              {currentTab === 'students' && <Students />}
              {currentTab === 'admins' && <Assistants />}
              {currentTab === 'announcements' && <Announcements />}
            </>
          )}

          {/* Student Views */}
          {isStudent && (
            <>
              {currentTab === 'myCourses' && <MyCourses />}
              {currentTab === 'myExams' && (
                <MyExams onStartExam={(examId) => setActiveExamId(examId)} />
              )}
              {currentTab === 'myGrades' && <MyGrades />}
            </>
          )}
        </main>
      </div>

      {/* Mandatory Change Password Modal if not changed */}
      <ChangePasswordModal isOpen={user.passwordChanged === false} />

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
