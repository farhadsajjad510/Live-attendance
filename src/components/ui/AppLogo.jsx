// AppLogo — official Live Attendance logo component.
// Single source of truth for logo rendering across Login, Sidebar, Dashboard, etc.

export default function AppLogo({ size = 32, className = '', style = {} }) {
  return (
    <img
      src="/logo.png"
      alt="Live Attendance"
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        display: 'block',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
