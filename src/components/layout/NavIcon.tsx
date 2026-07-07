import type { NavItem } from "@/lib/nav";

const paths: Record<NavItem["icon"], React.ReactNode> = {
  home: (
    <path d="M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
  ),
  spade: (
    <path d="M12 3c-3 3.5-7 6.5-7 10.2A4.8 4.8 0 0 0 9.7 18a4 4 0 0 1-1.2 3h7a4 4 0 0 1-1.2-3 4.8 4.8 0 0 0 4.7-4.8C19 9.5 15 6.5 12 3Z" />
  ),
  book: (
    <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5v-18Z" />
  ),
  chart: <path d="M4 20V10m6 10V4m6 16v-7" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  users: (
    <path d="M17 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 5 18.5V20M14.5 6.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm4.5 13.5v-1.2a3 3 0 0 0-2-2.8m-1-8.6a3 3 0 0 1 0 5.8" />
  ),
  star: (
    <path d="m12 3 2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6L12 3Z" />
  ),
  trophy: (
    <path d="M8 4h8v4a4 4 0 0 1-8 0V4ZM5 5H3v2a3 3 0 0 0 3 3M19 5h2v2a3 3 0 0 1-3 3M12 12v3m0 0c-1.5 0-2.5.8-2.5 2.5H14.5C14.5 15.8 13.5 15 12 15Zm-3 5.5h6" />
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M4.2 6.3l1.8 1.6M18 16.1l1.8 1.6M2.5 12h2.4M19.1 12h2.4M4.2 17.7l1.8-1.6M18 7.9l1.8-1.6" />
    </>
  ),
};

export function NavIcon({ icon, className }: { icon: NavItem["icon"]; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-5 w-5"}
    >
      {paths[icon]}
    </svg>
  );
}
