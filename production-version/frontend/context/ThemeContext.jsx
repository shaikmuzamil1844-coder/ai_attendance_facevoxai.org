import { createContext, useContext, useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'facevoxai_theme_settings';

const DEFAULT_SETTINGS = {
  theme: 'green', // 'default' | 'blue' | 'green' | 'pink'
  darkMode: true, // boolean
  grouped: true,  // boolean: true = grid/grouped, false = list/individual
  iconTheme: true // boolean: true = custom icons, false = default icons
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to parse theme settings from localStorage', e);
    }
    return DEFAULT_SETTINGS;
  });

  const [toastMessage, setToastMessage] = useState(null);

  // Apply attributes to <html> and <body> immediately on state change
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme || 'green');
    root.setAttribute('data-theme-mode', settings.darkMode ? 'dark' : 'light');
    root.setAttribute('data-view-mode', settings.grouped ? 'grid' : 'list');
    root.setAttribute('data-icon-theme', settings.iconTheme ? 'custom' : 'default');

    if (document.body) {
      document.body.style.backgroundColor = settings.darkMode ? 'var(--bg-base, #0A0A0F)' : 'var(--bg-base, #F8FAFC)';
      document.body.style.color = settings.darkMode ? 'var(--text-primary, #F5F5F5)' : 'var(--text-primary, #0F172A)';
    }

    // Auto-save changes so live toggling persists immediately
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to persist theme settings', e);
    }
  }, [settings]);

  const setTheme = (theme) => {
    setSettings((prev) => ({ ...prev, theme }));
  };

  const setDarkMode = (darkMode) => {
    setSettings((prev) => ({ ...prev, darkMode }));
  };

  const setGrouped = (grouped) => {
    setSettings((prev) => ({ ...prev, grouped }));
  };

  const setIconTheme = (iconTheme) => {
    setSettings((prev) => ({ ...prev, iconTheme }));
  };

  const saveSettings = () => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to persist theme settings', e);
    }
    setToastMessage('Theme settings saved.');
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: settings.theme,
        setTheme,
        darkMode: settings.darkMode,
        setDarkMode,
        grouped: settings.grouped,
        setGrouped,
        iconTheme: settings.iconTheme,
        setIconTheme,
        saveSettings,
        toastMessage,
        setToastMessage,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
};
