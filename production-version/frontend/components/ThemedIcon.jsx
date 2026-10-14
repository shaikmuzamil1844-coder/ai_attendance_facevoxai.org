import { useTheme } from '../context/ThemeContext';

export default function ThemedIcon({ name, fallback = '●', size = 18, className = '' }) {
  const { iconTheme } = useTheme();

  // If custom icon theme is disabled, use default fallback emoji
  if (!iconTheme) {
    return (
      <span className={`nav-icon-default ${className}`} style={{ fontSize: size }}>
        {fallback}
      </span>
    );
  }

  // Modern SVG Icons for custom icon theme
  const svgStyle = {
    width: size,
    height: size,
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
    display: 'inline-block',
    verticalAlign: 'middle',
  };

  switch (name) {
    case 'dashboard':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24" className={className}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'departments':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24" className={className}>
          <path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 3l9 7H3l9-7z" />
        </svg>
      );
    case 'courses':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24" className={className}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case 'semesters':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24" className={className}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'classrooms':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24" className={className}>
          <path d="M3 21h18M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M14 12v.01" />
        </svg>
      );
    case 'faculty':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24" className={className}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'students':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24" className={className}>
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      );
    case 'attendance':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24" className={className}>
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      );
    case 'subjects':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24" className={className}>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      );
    case 'timetable':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'analytics':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24" className={className}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case 'reports':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24" className={className}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case 'atRisk':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24" className={className}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'sessions':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24" className={className}>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case 'history':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 14 14" />
        </svg>
      );
    case 'enroll':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24" className={className}>
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <path d="M12 9v6M9 12h6" />
        </svg>
      );
    case 'profile':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24" className={className}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'themes':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24" className={className}>
          <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
          <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
          <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
          <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C21.996 6.5 17.5 2 12 2z" />
        </svg>
      );
    default:
      return (
        <span className={`nav-icon-default ${className}`} style={{ fontSize: size }}>
          {fallback}
        </span>
      );
  }
}
