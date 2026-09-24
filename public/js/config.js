// Global Server Configuration for Vercel (Frontend) <-> Coolify (Backend)
(function() {
  let resolvedUrl = '';

  // 1. Fetch backend URL from /api/config (reads Vercel Environment Variable BACKEND_URL)
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/config', false);
    xhr.timeout = 2000;
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

  // 2. Fallback to same origin
  if (!resolvedUrl) {
    resolvedUrl = window.location.origin;
  }

  console.log('[QQSI Config] Backend conectado a:', resolvedUrl);

  let socketInstance = null;

  window.QQSI_CONFIG = {
    backendUrl: resolvedUrl,
    getSocket() {
      if (!socketInstance) {
        socketInstance = io(resolvedUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 25,
          reconnectionDelay: 1000
        });

        socketInstance.on('connect', () => {
          console.log('[QQSI Socket] Conectado exitosamente');
        });

        socketInstance.on('connect_error', (err) => {
          console.warn('[QQSI Socket] Error de conexión:', err.message);
        });
      }
      return socketInstance;
    }
  };
})();
