export type NavItem = {
  href: string;
  label: string;
  icon: string; // simple emoji/glyph key resolved in NavIcon
  mobile?: boolean; // show in bottom nav
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "home", mobile: true },
  { href: "/analyze", label: "New Analysis", icon: "spade", mobile: true },
  { href: "/hands", label: "Hand Library", icon: "book", mobile: true },
  { href: "/session", label: "Session Review", icon: "chart", mobile: true },
  { href: "/training", label: "Training", icon: "target" },
  { href: "/ranges", label: "Range Library", icon: "grid" },
  { href: "/opponents", label: "Opponents", icon: "users" },
  { href: "/billing", label: "Subscription", icon: "star" },
  { href: "/settings", label: "Settings", icon: "gear", mobile: true },
];
