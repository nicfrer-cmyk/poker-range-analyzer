// ---------------------------------------------------------------------------
// Support contact address, shown on billing/legal/settings screens.
// Set NEXT_PUBLIC_SUPPORT_EMAIL once a real support inbox exists — falls
// back to a placeholder so those screens still render sensibly before then.
// ---------------------------------------------------------------------------

export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@poker-range-analyzer.com";
