// src/registerServiceWorker.ts

export function registerServiceWorker() {
  const ENABLE_PWA_CACHE = false;

  if (!ENABLE_PWA_CACHE) {
    // Disabled during active development
    return;
  }

  if (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator
  ) {
    navigator.serviceWorker
      .register('/sw.js')
      .catch(console.error);
  }
}
