// Display View JavaScript (Projector Screen) - 100% Native DOM & Real-Time Sync
document.addEventListener('DOMContentLoaded', () => {
  const socket = window.QQSI_CONFIG ? window.QQSI_CONFIG.getSocket() : io();

  const DEFAULT_TEAMS = [
    { id: 'sistemas', name: 'Ingeniería de Sistemas', shortName: 'Sistemas', color: '#0140B9', eliminated: false },
    { id: 'software', name: 'Ingeniería de Software', shortName: 'Software', color: '#286EDD', eliminated: false },
    { id: 'alimentos', name: 'Ingeniería de Alimentos', shortName: 'Alimentos', color: '#0437A6', eliminated: false },
    { id: 'quimica', name: 'Ingeniería Química', shortName: 'Química', color: '#9333ea', eliminated: false },
    { id: 'civil', name: 'Ingeniería Civil', shortName: 'Civil', color: '#FC6123', eliminated: false },
    { id: 'petroquimica', name: 'Téc. Procesos Petroquímicos', shortName: 'Petroquímica', color: '#032D8D', eliminated: false }
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
  const lobbyQuorum = document.getElementById('lobbyQuorum');
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

  // Anillo circular del cronómetro
  const timerArc = document.getElementById('timerArc');
  const RING_LENGTH = 2 * Math.PI * 27;
  let timerDuration = 0;

  function updateTimerRing(remaining) {
    if (!timerArc) return;
    const ratio = timerDuration > 0 ? Math.max(0, Math.min(1, remaining / timerDuration)) : 1;
    timerArc.style.strokeDashoffset = String(RING_LENGTH * (1 - ratio));
  }

  socket.on('timer_tick', ({ remaining }) => {
    timerText.textContent = formatTime(remaining);
    updateTimerRing(remaining);
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
      timerDuration = state.timer.duration || timerDuration || state.timer.remaining;
      updateTimerRing(state.timer.remaining);
    }

    renderLobbyTeams(teams, state.readyTeams || []);
    renderFooterSubmissions(state);

    if (state.showLeaderboard === true || state.questionState === 'evaluated') {
      lobbyScreen.style.display = 'none';
      questionScreen.style.display = 'none';
      resultsScreen.style.display = 'block';
      renderLeaderboard(state);
    } else if (state.questionState === 'idle' || !state.currentQuestion) {
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

  function renderLobbyTeams(teams, readyTeams) {
    const activeCount = teams.filter(t => !t.eliminated).length;
    const readyCount = teams.filter(t => !t.eliminated && readyTeams.includes(t.id)).length;
    if (lobbyQuorum) {
      lobbyQuorum.textContent = `${readyCount} / ${activeCount} listos`;
      lobbyQuorum.dataset.full = String(activeCount > 0 && readyCount === activeCount);
    }
    // Filas equilibradas: hasta 6 en una fila, si no dos filas parejas
    const cols = teams.length <= 6 ? teams.length : Math.ceil(teams.length / 2);
    lobbyTeamsGrid.style.setProperty('--cols', Math.max(cols, 1));
    lobbyTeamsGrid.innerHTML = teams.map(team => {
      const isEliminated = team.eliminated;
      const isReady = !isEliminated && readyTeams.includes(team.id);
      const stateLabel = isEliminated ? 'Eliminado' : (isReady ? 'Listo ✓' : 'Esperando');
      return `
        <div class="team-chip${isEliminated ? ' is-out' : ''}${isReady ? ' is-ready' : ''}">
          <div class="team-chip-avatar" style="background-color: ${team.color};">
            ${isEliminated && window.Icons ? Icons.cross("w-5 h-5") : (window.Icons ? Icons.users("w-5 h-5") : '')}
          </div>
          <div>
            <span class="team-chip-name">${team.shortName}</span>
            <span class="team-chip-state">${stateLabel}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderMathContent(targetElement, rawText) {
    if (!targetElement) return;
    targetElement.textContent = rawText || '';
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

  function renderQuestion(state) {
    let q = state.currentQuestion;
    if (!q && questionsData && questionsData.rounds && questionsData.rounds[state.currentRoundIndex]) {
      q = questionsData.rounds[state.currentRoundIndex].questions[state.currentQuestionIndex || 0];
    }
    if (!q) return;

    questionRibbon.textContent = q.title || `Pregunta ${(state.currentQuestionIndex || 0) + 1}`;
    renderMathContent(questionStatement, q.statement || '');

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
      // Revelación semántica: solo tras calificar (no se filtra la elección durante la pregunta)
      // Solo al terminar la pregunta, para no dar pistas a los equipos que aún no responden
      const questionEnded = state.questionState === 'ended';
      const evaluated = questionEnded ? (state.submissions || []).filter(sub => sub.correct !== null && sub.option) : [];
      const correctSet = new Set(evaluated.filter(sub => sub.correct === true).map(sub => sub.option));
      const wrongSet = new Set(evaluated.filter(sub => sub.correct === false).map(sub => sub.option));
      const revealAnswer = questionEnded && q.correctOption;
      if (revealAnswer) correctSet.add(String(q.correctOption).toUpperCase());

      questionOptionsGrid.innerHTML = q.options.map((opt, idx) => {
        const letter = letters[idx] || String(idx + 1);
        const isCorrect = correctSet.has(letter);
        const isWrong = !isCorrect && wrongSet.has(letter);
        const tag = isCorrect ? '<span class="option-tag">✓ Correcta</span>' : (isWrong ? '<span class="option-tag">✕ Incorrecta</span>' : '');
        return `
          <div class="option-card${isCorrect ? ' is-correct' : ''}${isWrong ? ' is-wrong' : ''}">
            <div class="option-letter">${letter}</div>
            <span class="option-text">${opt.replace(/^[A-D]\)\s*/, '')}</span>
            ${tag}
          </div>
        `;
      }).join('');
    } else {
      questionOptionsGrid.style.display = 'none';
    }

    // Question State & Breakdown
    const submissions = state.submissions || [];
    const hasEvaluated = submissions.some(s => s.correct !== null);

    if (state.questionState === 'running') {
      questionStatusIndicator.textContent = "Pregunta en curso — Equipos respondiendo con el pulsador";
      questionStatusIndicator.dataset.tone = "active";
      if (questionResultsBreakdown) questionResultsBreakdown.style.display = 'none';
    } else if (state.questionState === 'paused') {
      questionStatusIndicator.textContent = "Tiempo en pausa";
      questionStatusIndicator.dataset.tone = "warning";
      if (questionResultsBreakdown) questionResultsBreakdown.style.display = 'none';
    } else if (state.questionState === 'ended' || hasEvaluated) {
      questionStatusIndicator.textContent = hasEvaluated ? "¡Pregunta calificada! Puntos asignados" : "Tiempo agotado — Calificando respuestas";
      questionStatusIndicator.dataset.tone = hasEvaluated ? "success" : "neutral";

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
      const team = teams.find(t => t.id === sub.teamId) || { color: '#4C90DE' };
      const isCorrect = sub.correct === true;
      const isWrong = sub.correct === false;
      const seconds = (sub.elapsedMs / 1000).toFixed(1);
      const totalRoundPts = roundScores[sub.teamId] !== undefined ? roundScores[sub.teamId] : (team.score || 0);

      // Medalla solo para los 3 primeros aciertos; la etiqueta muestra el orden de llegada
      let medalSvg = '';
      if (isCorrect && idx === 0 && window.Icons) medalSvg = Icons.medal1("w-4 h-4");
      else if (isCorrect && idx === 1 && window.Icons) medalSvg = Icons.medal2("w-4 h-4");
      else if (isCorrect && idx === 2 && window.Icons) medalSvg = Icons.medal3("w-4 h-4");

      let stateClass = '';
      let pointsHtml = `<span class="result-note">Pendiente de juez</span>`;
      if (isCorrect) {
        stateClass = ' is-correct';
        pointsHtml = `
          <span class="result-points">+${sub.totalPoints || 10} pts</span>
          <span class="result-note">10 + ${sub.bonusPoints || 0} bono</span>
        `;
      } else if (isWrong) {
        stateClass = ' is-wrong';
        pointsHtml = `
          <span class="result-points">0 pts</span>
          <span class="result-note">Incorrecta</span>
        `;
      }

      return `
        <div class="result-card${stateClass}">
          <div class="result-top">
            <span class="result-rank">${medalSvg}Llegó ${sub.order || idx + 1}.º</span>
            <span class="result-time">${seconds}s</span>
          </div>
          <div class="result-team">
            <span class="team-dot" style="background-color: ${team.color};"></span>
            <span>${sub.teamName}</span>
            ${sub.option && sub.correct !== null ? `<span class="result-option">${sub.option}</span>` : ''}
          </div>
          <div class="result-top">${pointsHtml}</div>
          <div class="result-foot">
            <span>Total ronda</span>
            <strong>${totalRoundPts} pts</strong>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderFooterSubmissions(state) {
    const submissions = state.submissions || [];
    if (submissions.length === 0) {
      liveSubmissionsList.innerHTML = '<span class="muted" style="font-size: 13px;">Esperando pulsaciones…</span>';
      return;
    }

    // Con muchas entregas se omiten los segundos para que quepan todas en la barra
    const compact = submissions.length > 4;
    liveSubmissionsList.innerHTML = submissions.map((sub, idx) => {
      const order = idx + 1;
      const seconds = (sub.elapsedMs / 1000).toFixed(1);
      const isCorrect = sub.correct === true;
      const isWrong = sub.correct === false;

      let stateClass = '';
      let orderLabel = `${order}.º`;
      if (isCorrect) {
        stateClass = ' is-correct';
        orderLabel = `${order}.º +${sub.totalPoints || 10}`;
      } else if (isWrong) {
        stateClass = ' is-wrong';
        orderLabel = `${order}.º ✕`;
      }

      return `
        <div class="submission-pill${stateClass}">
          <span class="order">${orderLabel}</span>
          <span>${sub.teamName}</span>
          ${compact ? '' : `<span class="secs">${seconds}s</span>`}
        </div>
      `;
    }).join('');
  }

  function renderLeaderboard(state) {
    const allTeams = [...(state.teams || DEFAULT_TEAMS)];
    const activeTeams = allTeams.filter(t => !t.eliminated);
    const eliminatedTeams = allTeams.filter(t => t.eliminated);

    activeTeams.sort((a, b) => (b.score || 0) - (a.score || 0));
    eliminatedTeams.sort((a, b) => (b.score || 0) - (a.score || 0));

    let html = '';

    if (activeTeams.length > 0) {
      html += activeTeams.map((team, idx) => {
        // Empates comparten puesto (1, 2, 2, 4…)
        const score = team.score || 0;
        const place = 1 + activeTeams.filter(t => (t.score || 0) > score).length;
        const tied = activeTeams.filter(t => (t.score || 0) === score).length > 1;
        let medalSvg = '';
        if (place === 1 && window.Icons) medalSvg = Icons.medal1("w-6 h-6");
        else if (place === 2 && window.Icons) medalSvg = Icons.medal2("w-6 h-6");
        else if (place === 3 && window.Icons) medalSvg = Icons.medal3("w-6 h-6");

        const isChampion = !tied && place === 1 && (activeTeams.length === 1 || state.currentRoundIndex === 3);
        const placeLabel = isChampion ? '¡Ganador!' : `${place}.º lugar${tied ? ' (empate)' : ''}`;

        return `
          <div class="lb-row${place === 1 ? ' is-first' : ''}" style="--i: ${idx};">
            <span class="lb-place">${medalSvg}${placeLabel}</span>
            <span class="lb-team">
              <span class="team-dot" style="width: 14px; height: 14px; background-color: ${team.color};"></span>
              <span>${team.name}</span>
            </span>
            <span class="lb-score">${team.score || 0}<small>pts</small></span>
          </div>
        `;
      }).join('');
    } else {
      html += `<span class="empty-note">No hay equipos activos en esta ronda.</span>`;
    }

    if (eliminatedTeams.length > 0) {
      html += `
        <div class="lb-out">
          <span class="eyebrow">Equipos eliminados</span>
          ${eliminatedTeams.map(team => `
            <div class="lb-out-row">
              <div>
                <span class="team-dot" style="background-color: ${team.color};"></span>
                <span>${team.name}</span>
                <span class="tag-out">Eliminado</span>
              </div>
              <span class="mono muted">${team.score || 0} pts</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    leaderboardList.innerHTML = html;
  }
});
