export type NavItem = {
  href: string;
  label: string;
  icon: string; // simple emoji/glyph key resolved in NavIcon
  mobile?: boolean; // show in bottom nav
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "בית", icon: "home", mobile: true },
  { href: "/analyze", label: "ניתוח חדש", icon: "spade", mobile: true },
  { href: "/hands", label: "ספריית ידיים", icon: "book", mobile: true },
  { href: "/leaderboard", label: "אתגרים", icon: "trophy", mobile: true },
  { href: "/session", label: "סקירת סשן", icon: "chart" },
  { href: "/training", label: "אימון", icon: "target" },
  { href: "/ranges", label: "ספריית טווחים", icon: "grid" },
  { href: "/opponents", label: "יריבים", icon: "users" },
  { href: "/billing", label: "מנוי", icon: "star" },
  { href: "/settings", label: "הגדרות", icon: "gear", mobile: true },
];
