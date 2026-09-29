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

  // 2. Fallback:
  // - En Vercel (solo estáticos) el backend de sockets vive en Coolify.
  // - En cualquier otro host (localhost, IP de la LAN, Coolify) el mismo servidor
  //   Node sirve páginas y sockets, así que se usa el mismo origen (modo LAN offline).
  if (!resolvedUrl) {
    resolvedUrl = window.location.hostname.endsWith('vercel.app')
      ? COOLIFY_BACKEND_URL
      : window.location.origin;
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
