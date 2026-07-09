// ---------------------------------------------------------------------------
// Clears every Cache Storage bucket the service worker (public/sw.js) has
// created for this app. Used on sign-out and account deletion so a shared/
// public computer doesn't keep serving a previous user's cached authenticated
// pages after they've logged out.
// ---------------------------------------------------------------------------

export async function clearAppCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch {
    // Best-effort — never block sign-out/deletion on cache cleanup failing.
  }
}
