// Global Server Configuration for Vercel (Frontend) <-> Coolify (Backend)
(function() {
  const COOLIFY_BACKEND_URL = 'https://qqsi.147.5.103.87.sslip.io';
  let resolvedUrl = '';

  // 1. Fetch dynamic backend URL from /api/config (reads Vercel Environment Variable BACKEND_URL)
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/config', false);
    xhr.timeout = 1500;
    xhr.send(null);
    if (xhr.status === 200) {
      const data = JSON.parse(xhr.responseText);
      if (data.backendUrl && data.backendUrl.trim() !== '') {
        resolvedUrl = data.backendUrl.trim().replace(/\/$/, '');
      }
    }
  } catch (e) {}

  // 2. Intelligent Fallback:
  // If running on Vercel or resolvedUrl is empty, use Coolify production backend
  if (!resolvedUrl) {
    if (window.location.hostname.includes('vercel.app') || (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1'))) {
      resolvedUrl = COOLIFY_BACKEND_URL;
    } else {
      resolvedUrl = window.location.origin;
    }
  }

  let socketInstance = null;

  window.QQSI_CONFIG = {
    backendUrl: resolvedUrl,
    getSocket() {
      if (!socketInstance) {
        socketInstance = io(resolvedUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 50,
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
