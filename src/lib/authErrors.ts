// ---------------------------------------------------------------------------
// Supabase Auth error → Hebrew message translation
//
// Supabase Auth's error messages always come back in English. This maps the
// common ones to clear Hebrew equivalents so no raw English string ever
// reaches the UI. Unrecognized messages fall back to a generic Hebrew
// message rather than leaking the English text.
// ---------------------------------------------------------------------------

const EXACT_MATCHES: Record<string, string> = {
  "Invalid login credentials": "אימייל או סיסמה שגויים.",
  "Email not confirmed": "יש לאמת את כתובת האימייל לפני ההתחברות — בדוק/י את תיבת המייל.",
  "User already registered": "כבר קיים חשבון עם כתובת האימייל הזו.",
  "Password should be at least 6 characters": "הסיסמה חייבת להכיל לפחות 6 תווים.",
  "Unable to validate email address: invalid format": "כתובת האימייל אינה תקינה.",
  "New password should be different from the old password.":
    "הסיסמה החדשה חייבת להיות שונה מהסיסמה הנוכחית.",
  "Auth session missing!": "פג תוקף הקישור. יש לבקש קישור איפוס סיסמה חדש.",
  "Email rate limit exceeded": "נשלחו יותר מדי בקשות מאותה כתובת אימייל. נסה/י שוב מאוחר יותר.",
  "signups not allowed for this instance": "הרשמה אינה זמינה כרגע. נסה/י שוב מאוחר יותר.",
};

/** Prefixes for messages that carry a dynamic suffix (e.g. a wait time in seconds). */
const PREFIX_MATCHES: [prefix: string, hebrew: string][] = [
  [
    "For security purposes, you can only request this after",
    "מטעמי אבטחה, יש להמתין מעט לפני שליחת בקשה נוספת.",
  ],
  ["Password should be at least", "הסיסמה קצרה מדי — נדרשים יותר תווים."],
];

const FALLBACK = "משהו השתבש. נסה/י שוב, ואם הבעיה חוזרת פנה/י לתמיכה.";

/** Translates a raw Supabase Auth error message into Hebrew. Never returns the raw English
 *  string — unrecognized messages fall back to a generic Hebrew message. */
export function translateAuthError(message: string): string {
  if (EXACT_MATCHES[message]) return EXACT_MATCHES[message];
  const prefixMatch = PREFIX_MATCHES.find(([prefix]) => message.startsWith(prefix));
  if (prefixMatch) return prefixMatch[1];
  return FALLBACK;
}
