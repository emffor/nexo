import type { AppTheme } from "../lib/preferences";

interface NexoLogoProps {
  theme?: AppTheme;
  width?: number;
  height?: number;
  className?: string;
}

export function NexoLogo({
  theme = "light",
  width = 24,
  height = 24,
  className = "",
}: NexoLogoProps) {
  const isDark = theme === "dark";
  const pillarColor = isDark ? "#FFFFFF" : "#0A0A0A";
  const accentColor = "#4976F4";

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Nexo"
      className={className}
    >
      <rect x="3" y="3" width="6" height="26" rx="3" fill={pillarColor} />
      <rect x="23" y="3" width="6" height="26" rx="3" fill={pillarColor} />
      <path d="M6 9L26 23" stroke={accentColor} strokeWidth="4" strokeLinecap="round" />
      <circle cx="6" cy="9" r="4" fill={accentColor} />
      <circle cx="26" cy="23" r="4" fill={accentColor} />
    </svg>
  );
}
