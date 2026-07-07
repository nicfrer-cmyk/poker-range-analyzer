export type NavSection = "coach" | "tools" | "account";

export type NavItem = {
  href: string;
  label: string;
  icon: string; // simple emoji/glyph key resolved in NavIcon
  section: NavSection;
  mobile?: boolean; // show in bottom nav
};

export const NAV_SECTION_LABEL: Record<NavSection, string> = {
  coach: "המאמן שלי",
  tools: "כלים",
  account: "חשבון",
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "בית", icon: "home", section: "coach", mobile: true },
  { href: "/leaks", label: "דליפות", icon: "target", section: "coach" },
  { href: "/dna", label: "DNA שלי", icon: "dna", section: "coach" },
  { href: "/iq", label: "Poker IQ", icon: "brain", section: "coach" },
  { href: "/skills", label: "עץ מיומנויות", icon: "grid", section: "coach" },
  { href: "/missions", label: "משימות", icon: "checklist", section: "coach", mobile: true },
  { href: "/weekly-review", label: "סיכום שבועי", icon: "chart", section: "coach" },
  { href: "/roadmap", label: "תוכנית 30 יום", icon: "trophy", section: "coach" },
  { href: "/training", label: "אימון", icon: "spade", section: "coach", mobile: true },
  { href: "/analyze", label: "ניתוח חדש", icon: "spade", section: "tools" },
  { href: "/hands", label: "ספריית ידיים", icon: "book", section: "tools", mobile: true },
  { href: "/ranges", label: "ספריית טווחים", icon: "grid", section: "tools" },
  { href: "/opponents", label: "יריבים", icon: "users", section: "tools" },
  { href: "/leaderboard", label: "אתגרים", icon: "star", section: "tools" },
  { href: "/billing", label: "מנוי", icon: "star", section: "account" },
  { href: "/notifications", label: "התראות", icon: "bell", section: "account" },
  { href: "/settings", label: "הגדרות", icon: "gear", section: "account", mobile: true },
];
