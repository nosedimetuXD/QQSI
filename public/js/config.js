// Global Server Configuration for Vercel (Frontend) <-> Coolify (Backend)
(function() {
  const STORAGE_KEY = 'qqsi_backend_url';
  let resolvedUrl = '';

  // 1. Check local storage override
  const manualOverride = localStorage.getItem(STORAGE_KEY);
  if (manualOverride && manualOverride.trim() !== '') {
    resolvedUrl = manualOverride.trim().replace(/\/$/, '');
  } else {
    // 2. Try fetching from /api/config
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
      console.warn('[QQSI] Could not fetch /api/config:', e);
    }

    // 3. Fallback to same origin
    if (!resolvedUrl) {
      resolvedUrl = window.location.origin;
    }
  }

  console.log('[QQSI Config] Servidor Backend resuelto:', resolvedUrl);

  let socketInstance = null;

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
      if (!socketInstance) {
        socketInstance = io(resolvedUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 20,
          reconnectionDelay: 1000
        });

        socketInstance.on('connect', () => {
          console.log('[QQSI Socket] Conectado exitosamente con ID:', socketInstance.id);
          const dot = document.getElementById('qqsi-conn-dot');
          if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
        });

        socketInstance.on('connect_error', (err) => {
          console.warn('[QQSI Socket] Error de conexión con el backend:', err.message);
          const dot = document.getElementById('qqsi-conn-dot');
          if (dot) dot.className = 'w-2 h-2 rounded-full bg-red-400 animate-ping';
        });
      }
      return socketInstance;
    }
  };

  // Helper connection bar at bottom of page
  document.addEventListener('DOMContentLoaded', () => {
    const isVercel = window.location.hostname.includes('vercel.app');
    if (isVercel || localStorage.getItem(STORAGE_KEY)) {
      const bar = document.createElement('div');
      bar.id = 'qqsi-server-bar';
      bar.className = 'fixed bottom-1.5 left-2 z-50 text-[11px] bg-slate-950/90 text-slate-300 px-3 py-1 rounded-xl border border-slate-800 flex items-center gap-2 backdrop-blur shadow-xl';
      bar.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-amber-400" id="qqsi-conn-dot"></span>
        <span class="font-mono text-slate-200" id="qqsi-conn-label">Servidor: ${resolvedUrl}</span>
        <button onclick="window.promptServerUrl()" class="text-cyan-400 underline hover:text-cyan-300 font-bold ml-1">Configurar Backend</button>
      `;
      document.body.appendChild(bar);
    }
  });

  window.promptServerUrl = function() {
    const current = resolvedUrl;
    const newUrl = prompt('Ingresa la URL del servidor backend en Coolify (con https://, ej: https://qqsi-backend.tudominio.com):', current);
    if (newUrl && newUrl.trim() !== '') {
      window.QQSI_CONFIG.setBackendUrl(newUrl);
    }
  };
})();
