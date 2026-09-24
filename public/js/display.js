// Display View JavaScript (Projector Screen) - 100% Native DOM & Real-Time Sync
document.addEventListener('DOMContentLoaded', () => {
  const socket = window.QQSI_CONFIG ? window.QQSI_CONFIG.getSocket() : io();

  const DEFAULT_TEAMS = [
    { id: 'sistemas', name: 'Ingeniería de Sistemas', shortName: 'Sistemas', color: '#0284c7', eliminated: false },
    { id: 'alimentos', name: 'Ingeniería de Alimentos', shortName: 'Alimentos', color: '#16a34a', eliminated: false },
    { id: 'quimica', name: 'Ingeniería Química', shortName: 'Química', color: '#9333ea', eliminated: false },
    { id: 'civil', name: 'Ingeniería Civil', shortName: 'Civil', color: '#ea580c', eliminated: false },
    { id: 'petroquimica', name: 'Téc. Procesos Petroquímicos', shortName: 'Petroquímica', color: '#0d9488', eliminated: false }
  ];

  // DOM Elements
  const timerIconSlot = document.getElementById('timerIconSlot');
  const footerUsersIconSlot = document.getElementById('footerUsersIconSlot');
  const timerText = document.getElementById('timerText');
  const timerContainer = document.getElementById('timerContainer');
  
  const headerRoundName = document.getElementById('headerRoundName');
  const headerRoundTeamsCount = document.getElementById('headerRoundTeamsCount');
  
  const lobbyScreen = document.getElementById('lobbyScreen');
  const questionScreen = document.getElementById('questionScreen');
  const resultsScreen = document.getElementById('resultsScreen');
  
  const lobbyTeamsGrid = document.getElementById('lobbyTeamsGrid');
  const questionRibbon = document.getElementById('questionRibbon');
  const questionStatement = document.getElementById('questionStatement');
  const questionMathArea = document.getElementById('questionMathArea');
  const mathTarget = document.getElementById('mathTarget');
  const questionCodeArea = document.getElementById('questionCodeArea');
  const codeTarget = document.getElementById('codeTarget');
  const questionOptionsGrid = document.getElementById('questionOptionsGrid');
  const questionStatusIndicator = document.getElementById('questionStatusIndicator');
  
  const questionResultsBreakdown = document.getElementById('questionResultsBreakdown');
  const questionPointsGrid = document.getElementById('questionPointsGrid');

  const liveSubmissionsList = document.getElementById('liveSubmissionsList');
  const resultsRoundTitle = document.getElementById('resultsRoundTitle');
  const leaderboardList = document.getElementById('leaderboardList');
  const eliminationCallout = document.getElementById('eliminationCallout');

  // Insert SVGs
  const trophyIconSlot = document.getElementById('trophyIconSlot');
  if (timerIconSlot && window.Icons) timerIconSlot.innerHTML = Icons.timer("w-6 h-6");
  if (footerUsersIconSlot && window.Icons) footerUsersIconSlot.innerHTML = Icons.users("w-4 h-4");
  if (trophyIconSlot && window.Icons) trophyIconSlot.innerHTML = Icons.trophy("w-4 h-4");

  let currentState = {
    teams: DEFAULT_TEAMS,
    currentRoundIndex: 0,
    currentQuestionIndex: 0,
    questionState: 'idle',
    currentQuestion: null,
    submissions: [],
    roundScores: {},
    showLeaderboard: false
  };
  let questionsData = window.QUESTIONS_DATA || null;

  // Sound FX via Web Audio API
  const SoundFX = {
    ctx: null,
    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
      }
    },
    playTone(freq, type = 'sine', duration = 0.2, gainLevel = 0.15) {
      try {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(gainLevel, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    },
    buzzer() {
      this.playTone(523.25, 'triangle', 0.15, 0.2);
      setTimeout(() => this.playTone(659.25, 'triangle', 0.25, 0.2), 100);
    },
    celebrate() {
      this.playTone(523.25, 'sine', 0.15, 0.2);
      setTimeout(() => this.playTone(659.25, 'sine', 0.15, 0.2), 120);
      setTimeout(() => this.playTone(783.99, 'sine', 0.25, 0.25), 240);
    },
    urgentTick() {
      this.playTone(1100, 'triangle', 0.08, 0.12);
    }
  };

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Socket Events
  socket.on('questions_data', (data) => {
    questionsData = data;
    updateDisplay();
  });

  socket.on('state_update', (state) => {
    currentState = state;
    updateDisplay();
  });

  socket.on('timer_tick', ({ remaining }) => {
    timerText.textContent = formatTime(remaining);
    if (remaining <= 10 && remaining > 0) {
      timerContainer.classList.add('urgent');
      SoundFX.urgentTick();
    } else {
      timerContainer.classList.remove('urgent');
    }
  });

  socket.on('new_submission', (data) => {
    SoundFX.buzzer();
  });

  socket.on('evaluation_updated', (data) => {
    if (data && data.correct === true) {
      SoundFX.celebrate();
    }
  });

  // Initial immediate render
  updateDisplay();

  function updateDisplay() {
    const state = currentState;
    const teams = state.teams || DEFAULT_TEAMS;
    const activeTeams = teams.filter(t => !t.eliminated);
    
    // Header
    const roundNames = ['Ronda 1: Nivel Fácil', 'Ronda 2: Nivel Normal', 'Ronda 3: Nivel Difícil', 'Ronda 4: Nivel Experto'];
    if (headerRoundName) headerRoundName.textContent = roundNames[state.currentRoundIndex] || `Ronda ${state.currentRoundIndex + 1}`;
    if (headerRoundTeamsCount) headerRoundTeamsCount.textContent = `${activeTeams.length} Equipos Activos`;

    if (state.timer) {
      timerText.textContent = formatTime(state.timer.remaining);
    }

    renderLobbyTeams(teams);
    renderFooterSubmissions(state);

    if (state.showLeaderboard === true || state.questionState === 'evaluated') {
      lobbyScreen.style.display = 'none';
      questionScreen.style.display = 'none';
      resultsScreen.style.display = 'block';
      renderLeaderboard(state);
    } else if (state.questionState === 'idle' && !state.currentQuestion) {
      lobbyScreen.style.display = 'block';
      questionScreen.style.display = 'none';
      resultsScreen.style.display = 'none';
    } else {
      lobbyScreen.style.display = 'none';
      questionScreen.style.display = 'flex';
      resultsScreen.style.display = 'none';
      renderQuestion(state);
    }
  }

  function renderLobbyTeams(teams) {
    lobbyTeamsGrid.innerHTML = teams.map(team => {
      const isEliminated = team.eliminated;
      return `
        <div style="padding: 12px; border-radius: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; ${
          isEliminated 
            ? 'background: rgba(4, 12, 24, 0.4); opacity: 0.4; border: 1px solid rgba(255,255,255,0.08);' 
            : 'background: rgba(8, 20, 36, 0.9); border: 1.5px solid rgba(56, 189, 248, 0.3); box-shadow: 0 4px 12px rgba(0,0,0,0.4);'
        }">
          <div style="width: 40px; height: 40px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; color: #fff; margin-bottom: 8px; background-color: ${team.color}; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">
            ${isEliminated && window.Icons ? Icons.cross("w-5 h-5") : (window.Icons ? Icons.users("w-5 h-5") : '')}
          </div>
          <span style="font-size: 13px; font-weight: 800; color: #ffffff; line-height: 1.2;">${team.shortName}</span>
          ${isEliminated ? '<span style="font-size: 10px; color: #ef4444; font-weight: 800; text-transform: uppercase; margin-top: 4px;">Eliminado</span>' : ''}
        </div>
      `;
    }).join('');
  }

  function renderQuestion(state) {
    let q = state.currentQuestion;
    if (!q && questionsData && questionsData.rounds && questionsData.rounds[state.currentRoundIndex]) {
      q = questionsData.rounds[state.currentRoundIndex].questions[state.currentQuestionIndex || 0];
    }
    if (!q) return;

    questionRibbon.textContent = q.title || `Pregunta ${(state.currentQuestionIndex || 0) + 1}`;
    questionStatement.textContent = q.statement || '';

    if (q.math) {
      questionMathArea.style.display = 'block';
      try {
        if (window.katex) {
          katex.render(q.math, mathTarget, { displayMode: true, throwOnError: false });
        } else {
          mathTarget.textContent = q.math;
        }
      } catch (e) {
        mathTarget.textContent = q.math;
      }
    } else {
      questionMathArea.style.display = 'none';
    }

    if (q.code) {
      questionCodeArea.style.display = 'block';
      codeTarget.textContent = q.code;
      if (window.Prism) Prism.highlightElement(codeTarget);
    } else {
      questionCodeArea.style.display = 'none';
    }

    if (q.options && q.options.length > 0) {
      questionOptionsGrid.style.display = 'grid';
      const letters = ['A', 'B', 'C', 'D'];
      questionOptionsGrid.innerHTML = q.options.map((opt, idx) => `
        <div class="option-card">
          <div class="option-letter">${letters[idx] || (idx + 1)}</div>
          <span>${opt.replace(/^[A-D]\)\s*/, '')}</span>
        </div>
      `).join('');
    } else {
      questionOptionsGrid.style.display = 'none';
    }

    // Question State & Breakdown
    const submissions = state.submissions || [];
    const hasEvaluated = submissions.some(s => s.correct !== null);

    if (state.questionState === 'running') {
      questionStatusIndicator.textContent = "Pregunta en curso — Equipos respondiendo con el pulsador";
      questionStatusIndicator.style.color = "#34d399";
      if (questionResultsBreakdown) questionResultsBreakdown.style.display = 'none';
    } else if (state.questionState === 'paused') {
      questionStatusIndicator.textContent = "Tiempo en pausa";
      questionStatusIndicator.style.color = "#fbbf24";
      if (questionResultsBreakdown) questionResultsBreakdown.style.display = 'none';
    } else if (state.questionState === 'ended' || hasEvaluated) {
      questionStatusIndicator.textContent = hasEvaluated ? "¡Pregunta Calificada! Puntos asignados:" : "Tiempo agotado — Calificando respuestas";
      questionStatusIndicator.style.color = "#38bdf8";

      if (questionResultsBreakdown && (submissions.length > 0 || hasEvaluated)) {
        questionResultsBreakdown.style.display = 'block';
        renderQuestionResultsCards(state);
      }
    } else {
      if (questionResultsBreakdown) questionResultsBreakdown.style.display = 'none';
    }
  }

  function renderQuestionResultsCards(state) {
    const submissions = state.submissions || [];
    const teams = state.teams || DEFAULT_TEAMS;
    const roundScores = state.roundScores || {};

    // Sort submissions: correct first (by points/speed), then incorrect
    const sortedSubmissions = [...submissions].sort((a, b) => {
      if (a.correct === true && b.correct !== true) return -1;
      if (b.correct === true && a.correct !== true) return 1;
      return (b.totalPoints || 0) - (a.totalPoints || 0);
    });

    questionPointsGrid.innerHTML = sortedSubmissions.map((sub, idx) => {
      const team = teams.find(t => t.id === sub.teamId) || { color: '#38bdf8' };
      const isCorrect = sub.correct === true;
      const isWrong = sub.correct === false;
      const seconds = (sub.elapsedMs / 1000).toFixed(1);
      const totalRoundPts = roundScores[sub.teamId] !== undefined ? roundScores[sub.teamId] : (team.score || 0);

      let medalSvg = '';
      if (idx === 0 && window.Icons) medalSvg = Icons.medal1("w-4 h-4");
      else if (idx === 1 && window.Icons) medalSvg = Icons.medal2("w-4 h-4");
      else if (idx === 2 && window.Icons) medalSvg = Icons.medal3("w-4 h-4");

      let cardBorder = 'rgba(56, 189, 248, 0.4)';
      let cardBg = 'rgba(8, 20, 36, 0.95)';
      let pointsBadge = `<span style="color: #94a3b8; font-size: 11px;">Pendiente de juez</span>`;

      if (isCorrect) {
        cardBorder = '#10b981';
        cardBg = 'rgba(5, 150, 105, 0.2)';
        pointsBadge = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
            <span style="font-size: 15px; font-weight: 900; color: #34d399; font-family: monospace;">+${sub.totalPoints || 10} pts</span>
            <span style="font-size: 10px; font-weight: 700; color: #a7f3d0;">(10 + ${sub.bonusPoints || 0} bono)</span>
          </div>
        `;
      } else if (isWrong) {
        cardBorder = '#ef4444';
        cardBg = 'rgba(239, 68, 68, 0.15)';
        pointsBadge = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
            <span style="font-size: 14px; font-weight: 900; color: #f87171; font-family: monospace;">0 pts</span>
            <span style="font-size: 10px; font-weight: 700; color: #fca5a5;">(Incorrecto)</span>
          </div>
        `;
      }

      return `
        <div style="background: ${cardBg}; border: 1.5px solid ${cardBorder}; border-radius: 14px; padding: 12px 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              ${medalSvg}
              <span style="font-size: 13px; font-weight: 900; color: #facc15; font-family: monospace;">#${idx + 1}</span>
            </div>
            <span style="font-size: 11px; color: #94a3b8; font-family: monospace;">${seconds}s</span>
          </div>

          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
            <div style="width: 10px; height: 10px; border-radius: 9999px; background-color: ${team.color}; flex-shrink: 0;"></div>
            <span style="font-size: 14px; font-weight: 800; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sub.teamName}</span>
          </div>

          ${pointsBadge}

          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; font-size: 11px; font-weight: 700;">
            <span style="color: #94a3b8;">Total Ronda:</span>
            <span style="color: #38bdf8; font-family: monospace; font-weight: 900;">${totalRoundPts} pts</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderFooterSubmissions(state) {
    const submissions = state.submissions || [];
    if (submissions.length === 0) {
      liveSubmissionsList.innerHTML = '<span style="font-size: 12px; color: #64748b; font-style: italic;">Esperando pulsaciones...</span>';
      return;
    }

    liveSubmissionsList.innerHTML = submissions.map((sub, idx) => {
      const order = idx + 1;
      const seconds = (sub.elapsedMs / 1000).toFixed(1);
      const isCorrect = sub.correct === true;
      const isWrong = sub.correct === false;
      
      let badgeStyle = 'background: rgba(14, 32, 54, 0.9); border: 1.5px solid #38bdf8; color: #ffffff;';
      let iconHtml = `#${order}`;
      if (isCorrect) {
        badgeStyle = 'background: rgba(5, 150, 105, 0.4); border: 1.5px solid #10b981; color: #6ee7b7;';
        iconHtml = `#${order} (+${sub.totalPoints || 10})`;
      } else if (isWrong) {
        badgeStyle = 'background: rgba(239, 68, 68, 0.3); border: 1.5px solid #ef4444; color: #fca5a5;';
        iconHtml = `#${order} (0)`;
      }

      return `
        <div class="submission-pill" style="${badgeStyle}">
          <span style="font-weight: 900; font-family: monospace;">${iconHtml}</span>
          <span style="font-weight: 800;">${sub.teamName}</span>
          <span style="font-size: 11px; opacity: 0.8; font-family: monospace;">${seconds}s</span>
        </div>
      `;
    }).join('');
  }

  function renderLeaderboard(state) {
    const teams = [...(state.teams || DEFAULT_TEAMS)];
    teams.sort((a, b) => (b.score || 0) - (a.score || 0));

    leaderboardList.innerHTML = teams.map((team, idx) => {
      let medalSvg = '';
      if (idx === 0 && window.Icons) medalSvg = Icons.medal1("w-6 h-6");
      else if (idx === 1 && window.Icons) medalSvg = Icons.medal2("w-6 h-6");
      else if (idx === 2 && window.Icons) medalSvg = Icons.medal3("w-6 h-6");

      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-radius: 14px; background: rgba(8, 20, 36, 0.9); border: 1.5px solid ${idx === 0 ? '#facc15' : 'rgba(255, 255, 255, 0.15)'}; box-shadow: ${idx === 0 ? '0 0 15px rgba(250, 204, 21, 0.3)' : 'none'};">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="display: flex; align-items: center; gap: 6px; min-width: 100px;">
              ${medalSvg}
              <span style="font-size: 16px; font-weight: 900; color: ${idx === 0 ? '#facc15' : '#38bdf8'}; font-family: monospace;">${idx + 1}º Lugar</span>
            </div>
            <div style="width: 14px; height: 14px; border-radius: 9999px; background-color: ${team.color}; flex-shrink: 0;"></div>
            <span style="font-size: 16px; font-weight: 800; color: #ffffff;">${team.name}</span>
          </div>
          <span style="font-size: 22px; font-weight: 900; color: #34d399; font-family: monospace;">${team.score || 0} pts</span>
        </div>
      `;
    }).join('');
  }
});
