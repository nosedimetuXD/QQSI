// Global Server Configuration for Vercel (Frontend) <-> Coolify (Backend)
(function() {
  // Key for local storage
  const STORAGE_KEY = 'qqsi_backend_url';

  // Determine Default Backend URL
  function resolveBackendUrl() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved.replace(/\/$/, '');

    // If hosted locally or on the same server, use same origin
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || window.location.port === '3000') {
      return window.location.origin;
    }

    // Default fallback when hosted on Vercel without prior config
    return window.location.origin;
  }

  const backendUrl = resolveBackendUrl();

  window.QQSI_CONFIG = {
    backendUrl,
    setBackendUrl(url) {
      if (!url) return;
      const cleanUrl = url.trim().replace(/\/$/, '');
      localStorage.setItem(STORAGE_KEY, cleanUrl);
      window.location.reload();
    },
    getSocket() {
      const url = resolveBackendUrl();
      console.log('[QQSI] Conectando Socket.IO a:', url);
      return io(url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
      });
    }
  };

  // Check connection status UI helper
  document.addEventListener('DOMContentLoaded', () => {
    // If hosted on Vercel and connecting to a different origin or failing, add a discreet Server Config button
    const isVercel = window.location.hostname.includes('vercel.app');
    if (isVercel || localStorage.getItem(STORAGE_KEY)) {
      const bar = document.createElement('div');
      bar.id = 'qqsi-server-bar';
      bar.className = 'fixed bottom-1 left-2 z-50 text-[10px] bg-slate-900/90 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-2 backdrop-blur shadow-lg';
      bar.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-emerald-400" id="qqsi-conn-dot"></span>
        <span class="font-mono" id="qqsi-conn-label">Servidor: ${resolveBackendUrl()}</span>
        <button onclick="window.promptServerUrl()" class="text-blue-400 underline hover:text-blue-300 font-bold ml-1">Cambiar</button>
      `;
      document.body.appendChild(bar);
    }
  });

  window.promptServerUrl = function() {
    const current = resolveBackendUrl();
    const newUrl = prompt('Ingresa la URL del servidor backend en Coolify (ej. https://qqsi-backend.tudominio.com):', current);
    if (newUrl && newUrl.trim() !== '') {
      window.QQSI_CONFIG.setBackendUrl(newUrl);
    }
  };
})();
