// Global Server Configuration for Vercel (Frontend) <-> Coolify (Backend) via Environment Variables
(function() {
  const STORAGE_KEY = 'qqsi_backend_url';
  let resolvedUrl = '';

  // 1. Check local storage override if manually set
  const manualOverride = localStorage.getItem(STORAGE_KEY);
  if (manualOverride && manualOverride.trim() !== '') {
    resolvedUrl = manualOverride.trim().replace(/\/$/, '');
  } else {
    // 2. Fetch from Vercel / server environment variable endpoint (/api/config)
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', '/api/config', false); // Synchronous fetch during init
      xhr.timeout = 2500;
      xhr.send(null);
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        if (data.backendUrl && data.backendUrl.trim() !== '') {
          resolvedUrl = data.backendUrl.trim().replace(/\/$/, '');
        }
      }
    } catch (e) {
      console.warn('[QQSI] Could not fetch /api/config, falling back to window.location.origin');
    }

    // 3. Fallback to same origin if not set
    if (!resolvedUrl) {
      resolvedUrl = window.location.origin;
    }
  }

  console.log('[QQSI Config] Servidor Backend resuelto:', resolvedUrl);

  window.QQSI_CONFIG = {
    backendUrl: resolvedUrl,
    setBackendUrl(url) {
      if (!url) return;
      const cleanUrl = url.trim().replace(/\/$/, '');
      localStorage.setItem(STORAGE_KEY, cleanUrl);
      window.location.reload();
    },
    clearOverride() {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    },
    getSocket() {
      return io(resolvedUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 1000
      });
    }
  };
})();
