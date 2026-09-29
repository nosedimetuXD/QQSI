// Team Client JavaScript — Pulsador de equipos sincronizado con el servidor (Socket.IO)
// El modo de la pantalla lo decide el estado del servidor: nunca hay un conmutador manual.
document.addEventListener('DOMContentLoaded', () => {
  const socket = window.QQSI_CONFIG ? window.QQSI_CONFIG.getSocket() : io();

  const DEFAULT_TEAMS = [
    { id: 'sistemas', name: 'Ingeniería de Sistemas', shortName: 'Sistemas', color: '#0140B9', tableNum: '01', eliminated: false },
    { id: 'software', name: 'Ingeniería de Software', shortName: 'Software', color: '#286EDD', tableNum: '02', eliminated: false },
    { id: 'alimentos', name: 'Ingeniería de Alimentos', shortName: 'Alimentos', color: '#0437A6', tableNum: '03', eliminated: false },
    { id: 'quimica', name: 'Ingeniería Química', shortName: 'Química', color: '#9333ea', tableNum: '04', eliminated: false },
    { id: 'civil', name: 'Ingeniería Civil', shortName: 'Civil', color: '#FC6123', tableNum: '05', eliminated: false },
    { id: 'petroquimica', name: 'Téc. Procesos Petroquímicos', shortName: 'Petroquímica', color: '#032D8D', tableNum: '06', eliminated: false }
  ];

  const TABLE_NUMBERS = { sistemas: '01', software: '02', alimentos: '03', quimica: '04', civil: '05', petroquimica: '06' };
  const ROUND_NAMES = ['Ronda 1: Nivel Fácil', 'Ronda 2: Nivel Normal', 'Ronda 3: Nivel Difícil', 'Ronda 4: Nivel Experto'];
  const LETTERS = ['A', 'B', 'C', 'D'];

  const COLORS = {
    success: '#10B981',
    error: '#EF4444',
    accent: '#286EDD',
    led: '#6CA8E4',
    warning: '#F5B43C'
  };

  const $ = (id) => document.getElementById(id);

  function getTableNum(team) {
    if (!team) return '--';
    return team.tableNum || TABLE_NUMBERS[team.id] || '--';
  }

  // Auth & screens
  const teamAuthModal = $('teamAuthModal');
  const teamAuthForm = $('teamAuthForm');
  const modalTeamName = $('modalTeamName');
  const inputTeamPassword = $('inputTeamPassword');
  const teamAuthError = $('teamAuthError');
  const btnCancelTeamAuth = $('btnCancelTeamAuth');
  const btnSubmitTeamAuth = $('btnSubmitTeamAuth');

  const teamSelectScreen = $('teamSelectScreen');
  const eliminatedScreen = $('eliminatedScreen');
  const positionsScreen = $('positionsScreen');
  const teamInfoScreen = $('teamInfoScreen');
  const helpScreen = $('helpScreen');
  const mainDashboardView = $('mainDashboardView');
  const teamsListContainer = $('teamsListContainer');
  const positionsList = $('positionsList');
  const positionsRoundTag = $('positionsRoundTag');
  const mobileTabBar = $('mobile-tab-bar');

  // Header
  const headerStatusDot = $('header-status-dot');
  const teamHeaderName = $('teamHeaderName');
  const teamHeaderTable = $('teamHeaderTable');
  const headerScoreVal = $('header-score-val');
  const headerTeamIdentity = $('header-team-identity');

  // Round card
  const roundTitleText = $('round-title-text');
  const roundSubtitleText = $('round-subtitle-text');
  const roundTimer = $('round-timer');

  // Readiness bar
  const teamsReadinessBar = $('teams-readiness-bar');
  const teamsReadyCount = $('teams-ready-count');
  const teamsChipsContainer = $('teams-chips-container');

  // Buzzer
  const mainBuzzer = $('main-buzzer');
  const buzzerCoreIcon = $('buzzer-core-icon');
  const buzzerLabel = $('buzzer-label');
  const buzzerSubText = $('buzzer-sub-text');

  // Question
  const questionBadge = $('question-badge');
  const questionTitleText = $('question-title-text');
  const questionMath = $('question-math');

  // Answers
  const answersContainer = $('answers-container');
  const answersLockOverlay = $('answers-lock-overlay');
  const lockBadgeText = $('lock-badge-text');
  const answersPanel = $('answers-panel');
  const openQuestionNote = $('open-question-note');
  const optionHelper = $('option-helper');
  const answerActionBar = $('answer-action-bar');
  const overlaySocketStatus = $('overlay-socket-status');
  const overlayLatency = $('overlay-latency');
  const btnSubmit = $('btn-submit');
  const btnSubmitText = $('btn-submit-text');
  const btnClear = $('btn-clear');
  const inlineMsg = $('inline-msg');

  // Result banner
  const resultBanner = $('result-banner');
  const rbIcon = $('rb-icon');
  const rbTitle = $('rb-title');
  const rbSub = $('rb-sub');

  // Telemetry
  const statusIndicator = $('status-indicator');
  const statusMsg = $('status-msg');
  const statusSub = $('status-sub');
  const telemetryTimerVal = $('telemetry-timer-val');

  // Team info tab
  const infoTeamName = $('infoTeamName');
  const infoTable = $('infoTable');
  const infoScore = $('infoScore');
  const infoReady = $('infoReady');
  const infoConn = $('infoConn');
  const infoRound = $('infoRound');
  const btnLogoutTeam = $('btnLogoutTeam');

  // ---------- State ----------
  let selectedTeamId = localStorage.getItem('qqsi_selected_team') || null;
  let savedTeamPassword = localStorage.getItem('qqsi_team_password') || null;
  let isAuthenticated = false;
  let pendingTeamId = null;

  let activeTab = 'buzzer';
  let currentMode = 1; // 1 = check-in / espera, 2 = competencia
  let checkInReady = false;
  let pendingReady = null; // valor optimista mientras llega el próximo state_update
  let selectedOption = null;
  let submitting = false; // envío en vuelo (antes de submission_confirmed)
  let lastQuestionKey = null;
  let inlineMsgTimer = null;

  let currentState = {
    teams: DEFAULT_TEAMS,
    currentRoundIndex: 0,
    currentQuestionIndex: 0,
    questionState: 'idle',
    currentQuestion: null,
    submissions: [],
    roundScores: {},
    readyTeams: []
  };

  // ---------- Helpers ----------
  function playTone(frequency, duration, type = 'sine') {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  function hapticFeedback(pattern = [35, 20, 35]) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  function formatTime(seconds) {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setDot(el, color) {
    if (!el) return;
    el.style.background = color;
    el.style.boxShadow = `0 0 10px ${color}`;
  }

  function showInlineMsg(text, kind = 'error', ms = 4000) {
    if (!inlineMsg) return;
    inlineMsg.textContent = text;
    inlineMsg.classList.toggle('is-info', kind === 'info');
    inlineMsg.classList.add('is-visible');
    clearTimeout(inlineMsgTimer);
    if (ms) inlineMsgTimer = setTimeout(hideInlineMsg, ms);
  }

  function hideInlineMsg() {
    if (!inlineMsg) return;
    inlineMsg.classList.remove('is-visible');
    inlineMsg.textContent = '';
  }

  function getTeams() {
    return (currentState.teams && currentState.teams.length) ? currentState.teams : DEFAULT_TEAMS;
  }

  function getCurrentTeam() {
    return getTeams().find(t => t.id === selectedTeamId) || null;
  }

  function getScore(team) {
    if (!team) return 0;
    return (currentState.roundScores && currentState.roundScores[team.id] !== undefined)
      ? currentState.roundScores[team.id]
      : (team.score || 0);
  }

  function getMySubmission() {
    return (currentState.submissions || []).find(s => s.teamId === selectedTeamId) || null;
  }

  function getQuestion() {
    return currentState.currentQuestion || null;
  }

  function questionHasOptions(q) {
    return !!(q && Array.isArray(q.options) && q.options.length >= 2);
  }

  function serverTracksReady() {
    return Array.isArray(currentState.readyTeams);
  }

  function isTeamReady(teamId) {
    if (teamId === selectedTeamId && pendingReady !== null) return pendingReady;
    if (serverTracksReady()) return currentState.readyTeams.includes(teamId);
    return teamId === selectedTeamId ? checkInReady : false;
  }

  function deriveMode() {
    const qs = currentState.questionState;
    if (currentState.showLeaderboard) return 1;
    return (qs === 'running' || qs === 'paused') ? 2 : 1;
  }

  // ---------- Socket events ----------
  socket.on('connect', () => {
    if (overlaySocketStatus) overlaySocketStatus.textContent = 'CONECTADO';
    if (overlayLatency) overlayLatency.textContent = 'EN LÍNEA';
    if (infoConn) infoConn.textContent = 'En línea';
    setDot(headerStatusDot, checkInReady ? COLORS.accent : COLORS.led);
    // Re-autenticar tras reconexión para rehidratar la sesión
    if (selectedTeamId && savedTeamPassword) {
      socket.emit('team_login', { teamId: selectedTeamId, password: savedTeamPassword });
    }
  });

  socket.on('disconnect', () => {
    if (overlaySocketStatus) overlaySocketStatus.textContent = 'RECONECTANDO';
    if (overlayLatency) overlayLatency.textContent = 'SIN CONEXIÓN';
    if (infoConn) infoConn.textContent = 'Reconectando…';
    setDot(headerStatusDot, COLORS.error);
    showInlineMsg('Conexión perdida. Reintentando automáticamente…', 'error', 0);
  });

  socket.on('state_update', (state) => {
    if (!state) return;
    currentState = Object.assign({}, currentState, state);
    if (serverTracksReady()) {
      const serverReady = currentState.readyTeams.includes(selectedTeamId);
      if (pendingReady === null || pendingReady === serverReady) pendingReady = null;
      checkInReady = serverReady;
    }
    if (inlineMsg && inlineMsg.textContent.startsWith('Conexión perdida')) hideInlineMsg();
    updateView();
  });

  socket.on('timer_tick', ({ remaining }) => {
    if (currentState.timer) currentState.timer.remaining = remaining;
    if (roundTimer && currentMode === 2) roundTimer.textContent = formatTime(remaining);
  });

  socket.on('team_login_success', ({ teamId }) => {
    if (btnSubmitTeamAuth) {
      btnSubmitTeamAuth.disabled = false;
      btnSubmitTeamAuth.textContent = 'Ingresar';
    }
    if (pendingTeamId && inputTeamPassword && inputTeamPassword.value.trim()) {
      savedTeamPassword = inputTeamPassword.value.trim();
      localStorage.setItem('qqsi_team_password', savedTeamPassword);
    }
    selectedTeamId = teamId;
    isAuthenticated = true;
    localStorage.setItem('qqsi_selected_team', teamId);
    if (teamAuthModal) teamAuthModal.style.display = 'none';
    pendingTeamId = null;
    if (inputTeamPassword) inputTeamPassword.value = '';
    activeTab = 'buzzer';
    updateView();
  });

  socket.on('team_login_error', (data) => {
    if (btnSubmitTeamAuth) {
      btnSubmitTeamAuth.disabled = false;
      btnSubmitTeamAuth.textContent = 'Ingresar';
    }
    // Si falló la sesión guardada, volver a la selección de carrera
    if (!pendingTeamId) {
      localStorage.removeItem('qqsi_team_password');
      savedTeamPassword = null;
      isAuthenticated = false;
      selectedTeamId = null;
      updateView();
      return;
    }
    if (teamAuthError) {
      teamAuthError.textContent = (data && data.error) || 'Contraseña incorrecta.';
      teamAuthError.style.display = 'block';
    }
  });

  socket.on('submission_confirmed', ({ order, elapsedMs }) => {
    submitting = false;
    hapticFeedback([50, 40, 70]);
    if (statusSub) statusSub.textContent = `Tiempo registrado: ${(elapsedMs / 1000).toFixed(1)} s`;
    if (telemetryTimerVal) telemetryTimerVal.textContent = `${(elapsedMs / 1000).toFixed(1)}s`;
    showInlineMsg(`Respuesta registrada en la posición ${order}º.`, 'info', 3500);
    updateView();
  });

  socket.on('submission_error', (data) => {
    submitting = false;
    showInlineMsg((data && data.message) || 'No se pudo registrar la respuesta.', 'error');
    updateView();
  });

  socket.on('evaluation_updated', ({ teamId, correct }) => {
    if (teamId !== selectedTeamId) return;
    if (correct === true) {
      playTone(880, 0.3, 'triangle');
      hapticFeedback([60, 40, 60]);
    } else if (correct === false) {
      playTone(300, 0.3, 'sawtooth');
      hapticFeedback([120]);
    }
  });

  // Restaurar sesión guardada
  if (selectedTeamId && savedTeamPassword && socket.connected) {
    socket.emit('team_login', { teamId: selectedTeamId, password: savedTeamPassword });
  }

  // ---------- Buzzer / answers ----------
  window.handleBuzzerClick = function() {
    hideInlineMsg();
    if (!isAuthenticated || !selectedTeamId) {
      showInlineMsg('Primero identifica a tu equipo.', 'error');
      return;
    }

    if (currentMode === 1) {
      const next = !isTeamReady(selectedTeamId);
      pendingReady = next;
      checkInReady = next;
      socket.emit('team_ready', { teamId: selectedTeamId, ready: next });
      if (next) {
        playTone(600, 0.12, 'sine');
        setTimeout(() => playTone(880, 0.18, 'sine'), 100);
        hapticFeedback([40, 30, 40]);
      } else {
        playTone(400, 0.1, 'sine');
      }
      updateView();
      return;
    }

    // Competencia: el buzzer envía (si la pregunta tiene opciones, exige una seleccionada)
    doSubmit();
  };

  function doSubmit() {
    if (currentMode !== 2 || !selectedTeamId || submitting) return;
    if (getMySubmission()) return;

    if (currentState.questionState !== 'running') {
      showInlineMsg('El tiempo está en pausa. Espera a que el moderador lo reanude.', 'info');
      return;
    }

    const q = getQuestion();
    if (questionHasOptions(q) && !selectedOption) {
      showInlineMsg('Selecciona una opción (A–D) antes de enviar.', 'error');
      if (optionHelper) optionHelper.style.display = 'block';
      return;
    }

    submitting = true;
    playTone(880, 0.22, 'sine');
    hapticFeedback([50, 40, 70]);

    const payload = { teamId: selectedTeamId };
    if (questionHasOptions(q) && selectedOption) payload.option = selectedOption;
    socket.emit('submit_answer', payload);

    // Salvaguarda: si no hay confirmación, liberar el envío
    setTimeout(() => {
      if (submitting && !getMySubmission()) {
        submitting = false;
        showInlineMsg('Sin confirmación del servidor. Intenta de nuevo.', 'error');
        updateView();
      }
    }, 5000);
    updateView();
  }

  window.submitAnswer = doSubmit;

  window.selectAnswer = function(letter) {
    if (currentMode !== 2 || getMySubmission() || submitting) return;
    if (currentState.questionState !== 'running') return;
    selectedOption = letter;
    hideInlineMsg();
    playTone(520, 0.08, 'sine');
    hapticFeedback(25);
    renderCompetition();
  };

  window.clearSelection = function() {
    if (getMySubmission() || submitting) return;
    selectedOption = null;
    renderCompetition();
  };

  LETTERS.forEach(letter => {
    const el = $('option-' + letter);
    if (el) el.addEventListener('click', () => window.selectAnswer(letter));
  });

  // ---------- Rendering ----------
  function setBuzzerIcon(kind) {
    if (!buzzerCoreIcon) return;
    const glyph = kind === 'check'
      ? '<polyline points="20 6 9 17 4 12"></polyline>'
      : '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>';
    buzzerCoreIcon.innerHTML = `
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="${kind === 'check' ? 3 : 2.5}" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>
    `;
  }

  function lockAnswers(locked, badgeText) {
    if (answersLockOverlay) answersLockOverlay.style.display = locked ? 'flex' : 'none';
    // El panel de bloqueo es más alto que la cuadrícula 2x2: reservar espacio para que no se desborde
    if (answersContainer) answersContainer.style.minHeight = locked ? '280px' : '';
    if (lockBadgeText && badgeText) lockBadgeText.textContent = badgeText;
    if (answersPanel) {
      answersPanel.style.filter = locked ? 'blur(2px)' : 'none';
      answersPanel.style.opacity = locked ? '0.55' : '1';
      answersPanel.style.pointerEvents = locked ? 'none' : 'auto';
      answersPanel.setAttribute('aria-hidden', locked ? 'true' : 'false');
    }
    LETTERS.forEach(l => {
      const el = $('option-' + l);
      if (el) el.tabIndex = locked ? -1 : 0;
    });
  }

  function renderOptionsText(q) {
    const hasOpts = questionHasOptions(q);
    LETTERS.forEach((letter, idx) => {
      const labelEl = $('label-' + letter);
      const cardEl = $('option-' + letter);
      const raw = hasOpts ? (q.options[idx] || '') : '';
      const clean = raw.replace(/^[A-D]\)\s*/i, '');
      if (labelEl) renderMathContent(labelEl, hasOpts ? clean : `Opción ${letter}`);
      if (cardEl) {
        cardEl.style.display = (!hasOpts || idx < q.options.length) ? '' : 'none';
        cardEl.setAttribute('aria-label', hasOpts ? `Opción ${letter}: ${clean}` : `Opción ${letter}`);
      }
    });
  }

  function renderOptionStates(mySub, q) {
    const pickedLetter = mySub ? (mySub.option || null) : selectedOption;
    const correctLetter = q && q.correctOption ? String(q.correctOption).toUpperCase() : null;
    const evaluated = mySub && mySub.correct !== null && mySub.correct !== undefined;

    LETTERS.forEach(letter => {
      const el = $('option-' + letter);
      if (!el) return;
      el.classList.remove('is-selected', 'is-correct', 'is-wrong');
      const isPicked = pickedLetter === letter;
      if (evaluated) {
        if (isPicked && mySub.correct === true) el.classList.add('is-correct');
        else if (isPicked && mySub.correct === false) el.classList.add('is-wrong');
        else if (mySub.correct === false && correctLetter === letter) el.classList.add('is-correct');
      } else if (isPicked) {
        el.classList.add('is-selected');
      }
      el.setAttribute('aria-pressed', isPicked ? 'true' : 'false');
      el.disabled = !!mySub || submitting || currentState.questionState !== 'running';
    });
  }

  function renderResultBanner(mySub) {
    if (!resultBanner) return;
    resultBanner.classList.remove('is-visible', 'is-correct', 'is-wrong', 'is-pending');
    if (!mySub) return;

    const secs = (mySub.elapsedMs / 1000).toFixed(1);
    const optTxt = mySub.option ? `Opción ${mySub.option} · ` : '';
    if (mySub.correct === true) {
      resultBanner.classList.add('is-visible', 'is-correct');
      rbIcon.textContent = '✓';
      rbTitle.textContent = '¡Respuesta correcta!';
      rbSub.textContent = `${optTxt}+${mySub.totalPoints || 0} pts (${mySub.basePoints || 10} + ${mySub.bonusPoints || 0} bono) · ${secs}s`;
    } else if (mySub.correct === false) {
      resultBanner.classList.add('is-visible', 'is-wrong');
      rbIcon.textContent = '✕';
      rbTitle.textContent = 'Respuesta incorrecta';
      rbSub.textContent = `${optTxt}0 pts · ${secs}s`;
    } else {
      resultBanner.classList.add('is-visible', 'is-pending');
      rbIcon.textContent = `${mySub.order || '·'}`;
      rbTitle.textContent = `Entregada en posición ${mySub.order || '-'}º`;
      rbSub.textContent = `${optTxt}${secs}s · Esperando la calificación del juez`;
    }
  }

  function questionKey() {
    return `${currentState.currentRoundIndex}-${currentState.currentQuestionIndex}`;
  }

  function renderMathContent(targetElement, rawText) {
    if (!targetElement) return;
    if (rawText === undefined || rawText === null) {
      if (window.renderMathInElement) {
        try {
          renderMathInElement(targetElement, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\(', right: '\\)', display: false },
              { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false
          });
        } catch (e) {}
      }
      return;
    }

    let text = String(rawText);

    // Si el texto tiene comandos LaTeX sin delimitar, envolver automáticamente
    if (!text.includes('$') && !text.includes('\\(') && !text.includes('\\[') &&
        /\\(implies|frac|sqrt|int|begin|left|right|pm|cdot|alpha|beta|theta|pi|nabla|partial|times|approx|le|ge|neq|in|sum|lim|cases|infty)/.test(text)) {
      text = `$$${text}$$`;
    }

    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    html = html.replace(/\$([^\$]+)\$/g, (m, math) => {
      return '$' + math.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') + '$';
    }).replace(/\$\$([^\$]+)\$\$/g, (m, math) => {
      return '$$' + math.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') + '$$';
    });

    targetElement.innerHTML = html;

    if (window.renderMathInElement) {
      try {
        renderMathInElement(targetElement, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false
        });
      } catch (e) {}
    }
  }

  function renderQuestionText() {
    const q = getQuestion();
    if (q && currentMode === 2) {
      if (questionBadge) questionBadge.textContent = q.title || `Pregunta ${(currentState.currentQuestionIndex || 0) + 1}`;
      if (questionTitleText) renderMathContent(questionTitleText, q.statement || 'Pregunta en curso');
      if (q.math && questionMath) {
        questionMath.style.display = 'block';
        try {
          if (window.katex) katex.render(q.math, questionMath, { displayMode: true, throwOnError: false });
          else questionMath.textContent = q.math;
        } catch (e) {
          questionMath.textContent = q.math;
        }
      } else if (questionMath) {
        questionMath.style.display = 'none';
      }
    } else {
      const mySub = getMySubmission();
      if (questionMath) questionMath.style.display = 'none';
      if (currentState.showLeaderboard) {
        if (questionBadge) questionBadge.textContent = 'Tabla de posiciones';
        if (questionTitleText) questionTitleText.textContent = 'El moderador está mostrando el ranking en la pantalla principal.';
      } else if (currentState.questionState === 'ended' || mySub) {
        if (questionBadge) questionBadge.textContent = 'Pregunta finalizada';
        if (questionTitleText) questionTitleText.textContent = 'Espera la siguiente pregunta. Puedes confirmar tu check-in mientras tanto.';
      } else {
        if (questionBadge) questionBadge.textContent = 'Fase de preparación';
        if (questionTitleText) questionTitleText.textContent = 'Pulsa el botón central para avisar al moderador que tu mesa está lista.';
      }
    }
  }

  function renderCheckIn() {
    const team = getCurrentTeam();
    const tableStr = team ? `Mesa #${getTableNum(team)}` : 'Tu mesa';
    const ready = isTeamReady(selectedTeamId);

    if (roundTitleText) roundTitleText.textContent = 'FASE DE PREPARACIÓN / CHECK-IN';
    if (roundSubtitleText) roundSubtitleText.textContent = ROUND_NAMES[currentState.currentRoundIndex] || `Ronda ${(currentState.currentRoundIndex || 0) + 1}`;
    if (roundTimer) roundTimer.textContent = 'ESPERA';
    if (teamsReadinessBar) teamsReadinessBar.style.display = 'flex';

    if (openQuestionNote) openQuestionNote.style.display = 'none';
    if (answersContainer) answersContainer.style.display = '';
    if (answerActionBar) answerActionBar.style.display = '';
    if (optionHelper) optionHelper.style.display = 'none';
    lockAnswers(true, 'ESPERANDO INICIO DE RONDA');
    renderOptionsText(null);
    renderOptionStates(null, null);
    LETTERS.forEach(l => { const el = $('option-' + l); if (el) el.disabled = true; });

    if (btnSubmit) btnSubmit.disabled = true;
    if (btnSubmitText) btnSubmitText.textContent = 'ESPERANDO INICIO DE RONDA';
    if (btnClear) btnClear.disabled = true;

    if (mainBuzzer) {
      mainBuzzer.disabled = false;
      mainBuzzer.classList.remove('is-competition-buzzed');
      mainBuzzer.classList.toggle('is-ready', ready);
      mainBuzzer.setAttribute('aria-pressed', ready ? 'true' : 'false');
      mainBuzzer.setAttribute('aria-label', ready ? 'Equipo listo. Toca para deshacer el check-in' : 'Confirmar que el equipo está listo');
    }

    if (ready) {
      setBuzzerIcon('check');
      if (buzzerLabel) buzzerLabel.textContent = '¡EQUIPO LISTO!';
      if (buzzerSubText) buzzerSubText.textContent = 'Toca de nuevo para deshacer';
      if (statusMsg) statusMsg.textContent = `✓ ${tableStr} confirmada`;
      if (statusSub) statusSub.textContent = 'Esperando a que el moderador lance la pregunta';
      setDot(statusIndicator, COLORS.accent);
      setDot(headerStatusDot, COLORS.accent);
      if (telemetryTimerVal) telemetryTimerVal.textContent = 'LISTO';
    } else {
      setBuzzerIcon('bolt');
      if (buzzerLabel) buzzerLabel.textContent = 'CONFIRMAR LISTO';
      if (buzzerSubText) buzzerSubText.textContent = 'Toca para confirmar tu mesa';
      if (statusMsg) statusMsg.textContent = 'Check-in pendiente';
      if (statusSub) statusSub.textContent = `${tableStr} sin confirmar · Pulsa el botón central`;
      setDot(statusIndicator, COLORS.warning);
      setDot(headerStatusDot, socket.connected ? COLORS.led : COLORS.error);
      if (telemetryTimerVal) telemetryTimerVal.textContent = 'STANDBY';
    }

    // Resultado de la última pregunta (si la hubo)
    renderResultBanner(getMySubmission());
  }

  function renderCompetition() {
    const q = getQuestion();
    const hasOpts = questionHasOptions(q);
    const mySub = getMySubmission();
    const paused = currentState.questionState === 'paused';

    // Pregunta nueva: limpiar selección local
    const key = questionKey();
    if (key !== lastQuestionKey) {
      lastQuestionKey = key;
      selectedOption = null;
      submitting = false;
    }

    const roundNum = (currentState.currentRoundIndex || 0) + 1;
    const qNum = (currentState.currentQuestionIndex || 0) + 1;
    if (roundTitleText) roundTitleText.textContent = paused ? `RONDA ${roundNum} · EN PAUSA` : `RONDA ${roundNum} · EN CURSO`;
    if (roundSubtitleText) roundSubtitleText.textContent = `Pregunta ${qNum}${hasOpts ? ' · Opción múltiple' : ' · Respuesta abierta'}`;
    if (roundTimer) roundTimer.textContent = currentState.timer ? formatTime(currentState.timer.remaining) : '--:--';
    if (teamsReadinessBar) teamsReadinessBar.style.display = 'none';

    renderQuestionText();

    // Opciones o pregunta abierta
    if (answersContainer) answersContainer.style.display = hasOpts ? '' : 'none';
    if (answerActionBar) answerActionBar.style.display = hasOpts ? '' : 'none';
    if (openQuestionNote) openQuestionNote.style.display = hasOpts || mySub ? 'none' : 'block';
    renderOptionsText(q);
    lockAnswers(paused && !mySub, 'TIEMPO EN PAUSA');
    renderOptionStates(mySub, q);

    const canSubmit = !mySub && !submitting && !paused && (!hasOpts || !!selectedOption);
    if (btnSubmit) btnSubmit.disabled = !canSubmit;
    if (btnClear) btnClear.disabled = !!mySub || submitting || !selectedOption;
    if (optionHelper) optionHelper.style.display = hasOpts && !mySub && !selectedOption && !paused ? 'block' : 'none';

    if (btnSubmitText) {
      if (mySub) btnSubmitText.textContent = `ENTREGADA · POSICIÓN ${mySub.order || '-'}º`;
      else if (submitting) btnSubmitText.textContent = 'ENVIANDO…';
      else if (paused) btnSubmitText.textContent = 'TIEMPO EN PAUSA';
      else if (selectedOption) btnSubmitText.textContent = `CONFIRMAR Y ENVIAR (OPCIÓN ${selectedOption})`;
      else btnSubmitText.textContent = 'SELECCIONA UNA RESPUESTA';
    }

    // Buzzer
    if (mainBuzzer) {
      mainBuzzer.classList.remove('is-ready');
      mainBuzzer.classList.toggle('is-competition-buzzed', !!mySub || submitting);
      mainBuzzer.disabled = !!mySub || submitting || paused;
      mainBuzzer.removeAttribute('aria-pressed');
    }
    setBuzzerIcon('bolt');

    if (mySub || submitting) {
      if (buzzerLabel) buzzerLabel.textContent = mySub ? 'ENTREGADO' : 'ENVIANDO…';
      if (buzzerSubText) buzzerSubText.textContent = mySub ? `Posición ${mySub.order || '-'}º` : 'Registrando tu respuesta';
      if (mainBuzzer) mainBuzzer.setAttribute('aria-label', 'Respuesta ya enviada');
    } else if (paused) {
      if (buzzerLabel) buzzerLabel.textContent = 'EN PAUSA';
      if (buzzerSubText) buzzerSubText.textContent = 'Espera a que se reanude';
      if (mainBuzzer) mainBuzzer.setAttribute('aria-label', 'Tiempo en pausa');
    } else if (hasOpts) {
      if (buzzerLabel) buzzerLabel.textContent = selectedOption ? `ENVIAR ${selectedOption}` : 'ELIGE A–D';
      if (buzzerSubText) buzzerSubText.textContent = selectedOption ? 'Toca para enviar tu respuesta' : 'Selecciona una opción abajo';
      if (mainBuzzer) mainBuzzer.setAttribute('aria-label', selectedOption ? `Enviar opción ${selectedOption}` : 'Selecciona una opción antes de enviar');
    } else {
      if (buzzerLabel) buzzerLabel.textContent = 'PULSAR';
      if (buzzerSubText) buzzerSubText.textContent = 'Toca para pedir la palabra';
      if (mainBuzzer) mainBuzzer.setAttribute('aria-label', 'Pulsar para pedir la palabra');
    }

    // Telemetría
    if (mySub) {
      const secs = (mySub.elapsedMs / 1000).toFixed(1);
      if (statusMsg) statusMsg.textContent = mySub.option ? `Opción ${mySub.option} entregada (${mySub.order}º)` : `Turno capturado (${mySub.order}º)`;
      if (statusSub) statusSub.textContent = `Tiempo registrado: ${secs} s`;
      if (telemetryTimerVal) telemetryTimerVal.textContent = `${secs}s`;
      setDot(statusIndicator, mySub.correct === true ? COLORS.success : mySub.correct === false ? COLORS.error : COLORS.accent);
    } else if (paused) {
      if (statusMsg) statusMsg.textContent = 'Tiempo en pausa';
      if (statusSub) statusSub.textContent = 'El moderador detuvo el cronómetro';
      if (telemetryTimerVal) telemetryTimerVal.textContent = 'PAUSA';
      setDot(statusIndicator, COLORS.warning);
    } else {
      if (statusMsg) statusMsg.textContent = selectedOption ? `Opción ${selectedOption} elegida` : (hasOpts ? 'Elige tu respuesta' : 'Pregunta abierta en curso');
      if (statusSub) statusSub.textContent = hasOpts ? 'Confirma con Enviar o con el botón central' : 'Pulsa el botón central para responder';
      if (telemetryTimerVal) telemetryTimerVal.textContent = 'EN CURSO';
      setDot(statusIndicator, COLORS.success);
    }
    setDot(headerStatusDot, socket.connected ? COLORS.success : COLORS.error);

    renderResultBanner(mySub);
  }

  function renderReadinessChips(teams) {
    if (!teamsChipsContainer) return;
    const active = teams.filter(t => !t.eliminated);
    teamsChipsContainer.innerHTML = teams.map(team => {
      if (team.eliminated) {
        return `<span class="team-chip" style="opacity: 0.5; background: rgba(239, 68, 68, 0.1); color: #FCA5A5; border: 1px solid rgba(239, 68, 68, 0.3);">${escapeHtml(team.shortName)} ✕</span>`;
      }
      const ready = isTeamReady(team.id);
      return `<span class="team-chip ${ready ? 'ready' : 'waiting'}" aria-label="${escapeHtml(team.shortName)}: ${ready ? 'listo' : 'pendiente'}">${escapeHtml(team.shortName)} ${ready ? '✓' : '…'}</span>`;
    }).join('');

    const readyCount = active.filter(t => isTeamReady(t.id)).length;
    if (teamsReadyCount) {
      teamsReadyCount.textContent = serverTracksReady() || pendingReady !== null
        ? `${readyCount} de ${active.length} equipos listos`
        : `${active.length} equipos activos`;
    }
  }

  function renderTeamsList(teams) {
    if (!teamsListContainer) return;
    teamsListContainer.innerHTML = teams.map(team => {
      const isElim = team.eliminated;
      return `
        <button type="button" class="team-select-btn" data-team="${escapeHtml(team.id)}" ${isElim ? 'disabled' : ''}>
          <span style="display: flex; align-items: center; gap: 12px; min-width: 0;">
            <span aria-hidden="true" style="width: 14px; height: 14px; flex-shrink: 0; border-radius: 50%; background: ${team.color}; box-shadow: 0 0 10px ${team.color};"></span>
            <span style="text-align: left; min-width: 0;">
              <span style="display: block; font-size: 14px; font-weight: 700; color: #ffffff;">${escapeHtml(team.name)}</span>
              <span style="display: block; font-size: 12px; color: #A9BCD6;">Mesa asignada #${getTableNum(team)}</span>
            </span>
          </span>
          <span style="font-size: 13px; font-weight: 700; color: ${isElim ? '#FCA5A5' : '#6CA8E4'}; white-space: nowrap;">${isElim ? 'Eliminado' : 'Ingresar →'}</span>
        </button>
      `;
    }).join('');
    teamsListContainer.querySelectorAll('[data-team]').forEach(btn => {
      btn.addEventListener('click', () => window.selectTeamAuth(btn.dataset.team));
    });
  }

  function renderPositionsScreen() {
    if (!positionsList) return;
    const teams = [...getTeams()];
    teams.sort((a, b) => {
      if (!!a.eliminated !== !!b.eliminated) return a.eliminated ? 1 : -1;
      return getScore(b) - getScore(a);
    });
    if (positionsRoundTag) positionsRoundTag.textContent = `En vivo · ${ROUND_NAMES[currentState.currentRoundIndex] || 'Ronda'}`;
    positionsList.innerHTML = teams.map((team, idx) => {
      const isMe = team.id === selectedTeamId;
      return `
        <div class="pos-row${isMe ? ' is-me' : ''}${idx === 0 && !team.eliminated ? ' is-first' : ''}${team.eliminated ? ' is-out' : ''}">
          <div class="pos-left">
            <span class="pos-rank">${team.eliminated ? '—' : '#' + (idx + 1)}</span>
            <span class="pos-dot" style="background: ${team.color};" aria-hidden="true"></span>
            <span class="pos-name">${escapeHtml(team.shortName || team.name)}${isMe ? ' (tu mesa)' : ''}${team.eliminated ? ' · eliminado' : ''}</span>
          </div>
          <span class="pos-score">${getScore(team)} pts</span>
        </div>
      `;
    }).join('');
  }

  function renderTeamInfo() {
    const team = getCurrentTeam();
    if (!team) return;
    if (infoTeamName) infoTeamName.textContent = team.name;
    if (infoTable) infoTable.textContent = `#${getTableNum(team)}`;
    if (infoScore) infoScore.textContent = `${getScore(team)} pts`;
    if (infoReady) infoReady.textContent = team.eliminated ? 'Eliminado' : (isTeamReady(team.id) ? '✓ Listo' : 'Pendiente');
    if (infoConn) infoConn.textContent = socket.connected ? 'En línea' : 'Reconectando…';
    if (infoRound) infoRound.textContent = ROUND_NAMES[currentState.currentRoundIndex] || `Ronda ${(currentState.currentRoundIndex || 0) + 1}`;
  }

  function showOnly(section) {
    [teamSelectScreen, eliminatedScreen, positionsScreen, teamInfoScreen, helpScreen, mainDashboardView].forEach(el => {
      if (el) el.style.display = 'none';
    });
    if (section) section.style.display = 'flex';
  }

  function updateTabButtons() {
    const map = { buzzer: 'tab-btn-buzzer', positions: 'tab-btn-standings', team: 'tab-btn-team', help: 'tab-btn-help' };
    Object.entries(map).forEach(([tab, id]) => {
      const b = $(id);
      if (!b) return;
      const on = tab === activeTab;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
  }

  function updateView() {
    const teams = getTeams();
    const currentTeam = getCurrentTeam();

    renderReadinessChips(teams);

    // Sin sesión: solo la selección de carrera
    if (!selectedTeamId || !currentTeam || !isAuthenticated) {
      showOnly(teamSelectScreen);
      if (mobileTabBar) mobileTabBar.style.display = 'none';
      if (teamHeaderName) teamHeaderName.textContent = 'Seleccionar carrera';
      if (teamHeaderTable) teamHeaderTable.textContent = 'CONCURSO INTERCARRERAS';
      if (headerScoreVal) headerScoreVal.textContent = '0 pts';
      if (headerTeamIdentity) headerTeamIdentity.disabled = true;
      renderTeamsList(teams);
      return;
    }

    if (mobileTabBar) mobileTabBar.style.display = 'flex';
    if (headerTeamIdentity) headerTeamIdentity.disabled = false;
    if (teamHeaderName) teamHeaderName.textContent = currentTeam.eliminated ? `${currentTeam.shortName} (Eliminado)` : currentTeam.name;
    if (teamHeaderTable) teamHeaderTable.textContent = `MESA ASIGNADA #${getTableNum(currentTeam)}`;
    if (headerScoreVal) headerScoreVal.textContent = `${getScore(currentTeam)} pts`;

    currentMode = deriveMode();
    updateTabButtons();

    if (activeTab === 'positions') {
      showOnly(positionsScreen);
      renderPositionsScreen();
      return;
    }
    if (activeTab === 'team') {
      showOnly(teamInfoScreen);
      renderTeamInfo();
      return;
    }
    if (activeTab === 'help') {
      showOnly(helpScreen);
      return;
    }

    if (currentTeam.eliminated) {
      showOnly(eliminatedScreen);
      return;
    }

    showOnly(mainDashboardView);
    if (currentMode === 2) {
      renderCompetition();
    } else {
      renderQuestionText();
      renderCheckIn();
    }
  }

  // ---------- Auth ----------
  window.selectTeamAuth = function(teamId) {
    const team = getTeams().find(t => t.id === teamId);
    if (!team || team.eliminated) return;

    pendingTeamId = teamId;
    if (modalTeamName) modalTeamName.textContent = team.name;
    if (teamAuthError) teamAuthError.style.display = 'none';
    if (inputTeamPassword) inputTeamPassword.value = '';
    if (teamAuthModal) teamAuthModal.style.display = 'flex';
    setTimeout(() => { if (inputTeamPassword) inputTeamPassword.focus(); }, 100);
  };

  if (teamAuthForm) {
    teamAuthForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const pwd = inputTeamPassword ? inputTeamPassword.value.trim() : '';
      if (!pendingTeamId || !pwd) return;

      if (teamAuthError) teamAuthError.style.display = 'none';
      if (btnSubmitTeamAuth) {
        btnSubmitTeamAuth.disabled = true;
        btnSubmitTeamAuth.textContent = 'Verificando…';
      }

      socket.emit('team_login', { teamId: pendingTeamId, password: pwd });

      setTimeout(() => {
        if (teamAuthModal && teamAuthModal.style.display === 'flex' && btnSubmitTeamAuth && btnSubmitTeamAuth.disabled) {
          btnSubmitTeamAuth.disabled = false;
          btnSubmitTeamAuth.textContent = 'Ingresar';
          if (teamAuthError) {
            teamAuthError.textContent = socket.connected
              ? 'El servidor no respondió. Intenta de nuevo.'
              : 'Conectando con el servidor… Reintenta en unos segundos.';
            teamAuthError.style.display = 'block';
          }
        }
      }, 4000);
    });
  }

  function closeAuthModal() {
    if (teamAuthModal) teamAuthModal.style.display = 'none';
    pendingTeamId = null;
    if (inputTeamPassword) inputTeamPassword.value = '';
  }

  if (btnCancelTeamAuth) btnCancelTeamAuth.addEventListener('click', closeAuthModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && teamAuthModal && teamAuthModal.style.display === 'flex') closeAuthModal();
  });

  function logout() {
    if (selectedTeamId && isTeamReady(selectedTeamId)) {
      socket.emit('team_ready', { teamId: selectedTeamId, ready: false });
    }
    localStorage.removeItem('qqsi_selected_team');
    localStorage.removeItem('qqsi_team_password');
    selectedTeamId = null;
    savedTeamPassword = null;
    isAuthenticated = false;
    pendingReady = null;
    checkInReady = false;
    selectedOption = null;
    activeTab = 'buzzer';
    updateView();
  }

  if (btnLogoutTeam) btnLogoutTeam.addEventListener('click', logout);

  if (headerTeamIdentity) {
    headerTeamIdentity.addEventListener('click', () => {
      if (!isAuthenticated) return;
      window.switchMainTab('team');
    });
  }

  // ---------- Tabs ----------
  window.switchMainTab = function(tabName) {
    if (!isAuthenticated) return;
    activeTab = ['buzzer', 'positions', 'team', 'help'].includes(tabName) ? tabName : 'buzzer';
    updateView();
  };

  // Initialize
  updateView();
  window.addEventListener('load', () => updateView());
});
