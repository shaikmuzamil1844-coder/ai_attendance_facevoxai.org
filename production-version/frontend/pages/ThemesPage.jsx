import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

export default function ThemesPage() {
  const navigate = useNavigate();
  const {
    theme,
    setTheme,
    darkMode,
    setDarkMode,
    grouped,
    setGrouped,
    iconTheme,
    setIconTheme,
    saveSettings,
    toastMessage,
  } = useTheme();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const themeOptions = [
    { id: 'default', label: 'Default', color: '#D4A017' },
    { id: 'blue', label: 'Blue', color: '#3B82F6' },
    { id: 'green', label: 'Green', color: '#22C55E' },
    { id: 'pink', label: 'Pink', color: '#EC4899' },
  ];

  return (
    <div className="themes-page-wrapper">
      {/* ── Top Header ── */}
      <header className="themes-header">
        <button
          type="button"
          className="themes-back-btn"
          onClick={handleBack}
          aria-label="Go back"
          title="Back"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <h1 className="themes-header-title">Themes</h1>
      </header>

      {/* ── Main Settings Container ── */}
      <main className="themes-container">
        {/* 1. Grouped Setting */}
        <div className="theme-setting-row">
          <span className="theme-setting-label">Grouped</span>
          <button
            type="button"
            className="theme-pill-switch"
            onClick={() => setGrouped(!grouped)}
            aria-label={`Toggle grouped view, currently ${grouped ? 'grid' : 'list'}`}
            title={grouped ? 'Switch to List View' : 'Switch to Grid View'}
          >
            {/* Knob with radial gradient and soft glow */}
            <div
              className="theme-pill-knob"
              style={{
                transform: grouped ? 'translateX(0px)' : 'translateX(46px)',
              }}
            />

            {/* Left: Grid Icon */}
            <div className={`theme-switch-icon ${grouped ? 'active' : ''}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
                <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
                <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
                <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
              </svg>
            </div>

            {/* Right: List Icon */}
            <div className={`theme-switch-icon ${!grouped ? 'active' : ''}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="4" width="18" height="3" rx="1.5" />
                <rect x="3" y="10.5" width="18" height="3" rx="1.5" />
                <rect x="3" y="17" width="18" height="3" rx="1.5" />
              </svg>
            </div>
          </button>
        </div>

        {/* 2. Dark Mode Setting */}
        <div className="theme-setting-row">
          <span className="theme-setting-label">Dark Mode</span>
          <button
            type="button"
            className="theme-pill-switch"
            onClick={() => setDarkMode(!darkMode)}
            aria-label={`Toggle dark mode, currently ${darkMode ? 'dark' : 'light'}`}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {/* Knob with radial gradient and soft glow */}
            <div
              className="theme-pill-knob"
              style={{
                transform: darkMode ? 'translateX(46px)' : 'translateX(0px)',
              }}
            />

            {/* Left: Sun / Light Icon */}
            <div className={`theme-switch-icon ${!darkMode ? 'active' : ''}`}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>

            {/* Right: Moon / Dark Icon */}
            <div className={`theme-switch-icon ${darkMode ? 'active' : ''}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </div>
          </button>
        </div>

        {/* 3. Icon Theme Setting */}
        <div className="theme-setting-row">
          <span className="theme-setting-label">Icon Theme:</span>
          <button
            type="button"
            className="theme-checkbox"
            onClick={() => setIconTheme(!iconTheme)}
            aria-label="Toggle custom icon theme"
            title={iconTheme ? 'Custom Vector Icons Enabled' : 'Default Emoji Icons Enabled'}
          >
            {iconTheme && (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: 'var(--primary)' }}
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        </div>

        {/* 4. Select Custom Theme Section */}
        <div className="theme-custom-section">
          <h2 className="theme-custom-title">Select Custom Theme:</h2>

          <div className="theme-options-card">
            {themeOptions.map((opt) => {
              const isSelected = theme === opt.id;
              return (
                <div
                  key={opt.id}
                  className={`theme-option-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => setTheme(opt.id)}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setTheme(opt.id);
                    }
                  }}
                >
                  <div className={`theme-radio-outer ${isSelected ? 'active' : ''}`}>
                    {isSelected && <div className="theme-radio-inner" />}
                  </div>
                  <span className="theme-option-label">{opt.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5. Save Button */}
        <div className="theme-save-wrap">
          <button
            type="button"
            className="theme-save-btn"
            onClick={saveSettings}
            title="Save Theme Settings"
          >
            Save
          </button>
        </div>

        {/* ── Toast confirmation ── */}
        {toastMessage && (
          <div className="theme-toast" role="alert">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: 'var(--primary)' }}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{toastMessage}</span>
          </div>
        )}
      </main>
    </div>
  );
}
