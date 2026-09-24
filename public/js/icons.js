// Vector SVG Icon Library (Zero Emojis - 100% Crisp Vector SVGs with Strict Dimension Guarantees)
(function() {
  function getDim(cls, defaultPx = 24) {
    if (!cls) return defaultPx;
    if (cls.includes('w-3.5') || cls.includes('w-3')) return 14;
    if (cls.includes('w-4')) return 16;
    if (cls.includes('w-5')) return 20;
    if (cls.includes('w-6')) return 24;
    if (cls.includes('w-7')) return 28;
    if (cls.includes('w-8')) return 32;
    if (cls.includes('w-10')) return 40;
    if (cls.includes('w-12')) return 48;
    if (cls.includes('w-16')) return 64;
    return defaultPx;
  }

  function svgWrap(content, cls = "w-6 h-6", isFill = false, strokeW = "2") {
    const px = getDim(cls, 24);
    const fillAttr = isFill ? 'fill="currentColor"' : 'fill="none"';
    const strokeAttr = isFill ? '' : `stroke="currentColor" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round"`;
    return `<svg class="${cls}" width="${px}" height="${px}" style="width: ${px}px; height: ${px}px; max-width: ${px}px; max-height: ${px}px; flex-shrink: 0; display: inline-block; vertical-align: middle;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${fillAttr} ${strokeAttr}>${content}</svg>`;
  }

  const Icons = {
    trophy: (cls = "w-6 h-6") => svgWrap(`
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34"/>
      <path d="M18 4H6v7a6 6 0 0 0 12 0V4z"/>
    `, cls, false, "2"),
    
    medal1: (cls = "w-6 h-6") => {
      const px = getDim(cls, 24);
      return `<svg class="${cls}" width="${px}" height="${px}" style="width: ${px}px; height: ${px}px; max-width: ${px}px; max-height: ${px}px; flex-shrink: 0; display: inline-block; vertical-align: middle;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <circle cx="12" cy="14" r="7" fill="#f59e0b" stroke="#b45309" stroke-width="1.5" />
        <path d="M9 12.5h6l-3 3z" fill="#fef3c7" opacity="0.3"/>
        <path d="M8.2 2.5 L12 9 L6.5 9 Z" fill="#ef4444" />
        <path d="M15.8 2.5 L12 9 L17.5 9 Z" fill="#3b82f6" />
        <text x="12" y="16.5" font-size="7" font-weight="900" font-family="sans-serif" fill="#ffffff" text-anchor="middle">1º</text>
      </svg>`;
    },

    medal2: (cls = "w-6 h-6") => {
      const px = getDim(cls, 24);
      return `<svg class="${cls}" width="${px}" height="${px}" style="width: ${px}px; height: ${px}px; max-width: ${px}px; max-height: ${px}px; flex-shrink: 0; display: inline-block; vertical-align: middle;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <circle cx="12" cy="14" r="7" fill="#94a3b8" stroke="#475569" stroke-width="1.5" />
        <path d="M8.2 2.5 L12 9 L6.5 9 Z" fill="#ef4444" />
        <path d="M15.8 2.5 L12 9 L17.5 9 Z" fill="#3b82f6" />
        <text x="12" y="16.5" font-size="7" font-weight="900" font-family="sans-serif" fill="#ffffff" text-anchor="middle">2º</text>
      </svg>`;
    },

    medal3: (cls = "w-6 h-6") => {
      const px = getDim(cls, 24);
      return `<svg class="${cls}" width="${px}" height="${px}" style="width: ${px}px; height: ${px}px; max-width: ${px}px; max-height: ${px}px; flex-shrink: 0; display: inline-block; vertical-align: middle;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <circle cx="12" cy="14" r="7" fill="#d97706" stroke="#92400e" stroke-width="1.5" />
        <path d="M8.2 2.5 L12 9 L6.5 9 Z" fill="#ef4444" />
        <path d="M15.8 2.5 L12 9 L17.5 9 Z" fill="#3b82f6" />
        <text x="12" y="16.5" font-size="7" font-weight="900" font-family="sans-serif" fill="#ffffff" text-anchor="middle">3º</text>
      </svg>`;
    },

    timer: (cls = "w-6 h-6") => svgWrap(`
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    `, cls, false, "2"),

    check: (cls = "w-6 h-6") => svgWrap(`
      <polyline points="20 6 9 17 4 12"/>
    `, cls, false, "2.5"),

    cross: (cls = "w-6 h-6") => svgWrap(`
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    `, cls, false, "2.5"),

    play: (cls = "w-6 h-6") => svgWrap(`
      <polygon points="5 3 19 12 5 21 5 3"/>
    `, cls, true),

    pause: (cls = "w-6 h-6") => svgWrap(`
      <rect x="6" y="4" width="4" height="16" rx="1"/>
      <rect x="14" y="4" width="4" height="16" rx="1"/>
    `, cls, true),

    stop: (cls = "w-6 h-6") => svgWrap(`
      <rect x="4" y="4" width="16" height="16" rx="2"/>
    `, cls, true),

    send: (cls = "w-6 h-6") => svgWrap(`
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    `, cls, false, "2"),

    users: (cls = "w-6 h-6") => svgWrap(`
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    `, cls, false, "2"),

    shield: (cls = "w-6 h-6") => svgWrap(`
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    `, cls, false, "2"),

    award: (cls = "w-6 h-6") => svgWrap(`
      <circle cx="12" cy="8" r="7"/>
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
    `, cls, false, "2"),

    sparkles: (cls = "w-6 h-6") => svgWrap(`
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
    `, cls, false, "2"),

    alertTriangle: (cls = "w-6 h-6") => svgWrap(`
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    `, cls, false, "2"),

    rotateCcw: (cls = "w-6 h-6") => svgWrap(`
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
    `, cls, false, "2"),

    chevronRight: (cls = "w-6 h-6") => svgWrap(`
      <polyline points="9 18 15 12 9 6"/>
    `, cls, false, "2"),

    screen: (cls = "w-6 h-6") => svgWrap(`
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    `, cls, false, "2"),

    smartphone: (cls = "w-6 h-6") => svgWrap(`
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
      <line x1="12" y1="18" x2="12.01" y2="18"/>
    `, cls, false, "2"),

    cpu: (cls = "w-6 h-6") => svgWrap(`
      <rect x="4" y="4" width="16" height="16" rx="2"/>
      <rect x="9" y="9" width="6" height="6"/>
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>
    `, cls, false, "2")
  };

  if (typeof window !== 'undefined') {
    window.Icons = Icons;
  }
})();
