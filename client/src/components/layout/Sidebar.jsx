import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ currentTab, setCurrentTab }) {
  const { t } = useTranslation();
  const { isDoctor, isAdmin, isStudent } = useAuth();

  const adminNavItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: '📊' },
    { id: 'courses', label: t('nav.courses'), icon: '📚' },
    { id: 'lectures', label: t('nav.lectures'), icon: '📑' },
    { id: 'exams', label: t('nav.exams'), icon: '📝' },
    { id: 'results', label: t('nav.results'), icon: '🏆' },
    { id: 'students', label: t('nav.students'), icon: '🎓' },
    ...(isDoctor ? [{ id: 'admins', label: t('nav.admins'), icon: '👥' }] : []),
    { id: 'announcements', label: t('nav.notifications'), icon: '📢' },
  ];

  const studentNavItems = [
    { id: 'myCourses', label: t('nav.myCourses'), icon: '📚' },
    { id: 'myExams', label: t('nav.myExams'), icon: '📝' },
    { id: 'myGrades', label: t('nav.myGrades'), icon: '🏆' },
  ];

  const items = isAdmin ? adminNavItems : studentNavItems;

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentTab(item.id)}
            className={`nav-item ${currentTab === item.id ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
