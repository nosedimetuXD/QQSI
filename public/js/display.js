// Display View JavaScript (Projector Screen)
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

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
  
  const liveSubmissionsList = document.getElementById('liveSubmissionsList');
  const footerSubmittedCount = document.getElementById('footerSubmittedCount');
  
  const resultsRoundTitle = document.getElementById('resultsRoundTitle');
  const leaderboardList = document.getElementById('leaderboardList');
  const eliminationCallout = document.getElementById('eliminationCallout');

  // Insert SVGs
  if (timerIconSlot && window.Icons) timerIconSlot.innerHTML = Icons.timer("w-6 h-6 text-blue-400");
  if (footerUsersIconSlot && window.Icons) footerUsersIconSlot.innerHTML = Icons.users("w-4 h-4 text-blue-400");

  let currentState = null;
  let questionsData = null;

  // Sound Effects using Web Audio API (Synthesizer - no external audio file dependencies needed)
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
      } catch (e) {
        console.warn('Audio play failed:', e);
      }
    },
    tick() { this.playTone(800, 'sine', 0.05, 0.05); },
    urgentTick() { this.playTone(1100, 'triangle', 0.1, 0.15); },
    buzzer() {
      this.playTone(523.25, 'triangle', 0.15, 0.2); // C5
      setTimeout(() => this.playTone(659.25, 'triangle', 0.25, 0.2), 100); // E5
    },
    timeUp() {
      this.playTone(220, 'sawtooth', 0.5, 0.3); // A3
    }
  };

  // Format seconds to mm:ss
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Socket Events
  socket.on('questions_data', (data) => {
    questionsData = data;
    if (currentState) renderView(currentState);
  });

  socket.on('state_update', (state) => {
    const prevSubmissionsCount = currentState ? currentState.submissions.length : 0;
    currentState = state;
    renderView(state);

    // If new submission arrived, play buzzer chime
    if (state.submissions.length > prevSubmissionsCount) {
      SoundFX.buzzer();
    }
  });

  socket.on('timer_tick', ({ remaining, duration }) => {
    timerText.textContent = formatTime(remaining);
    
    // Urgent pulse styling when less than 30s remaining
    if (remaining <= 30 && remaining > 0) {
      timerContainer.classList.add('timer-urgent', 'border-red-500', 'bg-red-950');
      SoundFX.urgentTick();
    } else {
      timerContainer.classList.remove('timer-urgent', 'border-red-500', 'bg-red-950');
    }
  });

  socket.on('question_time_up', () => {
    SoundFX.timeUp();
    timerText.textContent = "00:00";
  });

  function renderView(state) {
    const activeTeams = state.teams.filter(t => !t.eliminated);
    const roundNames = ["Nivel Fácil", "Nivel Normal", "Nivel Difícil", "Nivel Experto"];
    const roundName = roundNames[state.currentRoundIndex] || `Ronda ${state.currentRoundIndex + 1}`;

    headerRoundName.textContent = `Ronda ${state.currentRoundIndex + 1}: ${roundName}`;
    headerRoundTeamsCount.textContent = `${activeTeams.length} Equipos Activos`;

    // Render Submissions in Footer
    renderFooterSubmissions(state);

    // Screen Routing
    if (state.questionState === 'idle' && !state.currentQuestion) {
      // Show Lobby
      lobbyScreen.classList.remove('hidden');
      questionScreen.classList.add('hidden');
      resultsScreen.classList.add('hidden');
      renderLobbyTeams(state.teams);
    } else if (state.questionState === 'evaluated') {
      // Show Results / Leaderboard
      lobbyScreen.classList.add('hidden');
      questionScreen.classList.add('hidden');
      resultsScreen.classList.remove('hidden');
      renderLeaderboard(state);
    } else {
      // Show Question (running, paused, or ended awaiting evaluation)
      lobbyScreen.classList.add('hidden');
      questionScreen.classList.remove('hidden');
      resultsScreen.classList.add('hidden');
      renderQuestion(state);
    }
  }

  function renderLobbyTeams(teams) {
    lobbyTeamsGrid.innerHTML = teams.map(team => {
      const isEliminated = team.eliminated;
      return `
        <div class="p-3 rounded-xl flex flex-col items-center justify-center text-center transition-all ${
          isEliminated 
            ? 'bg-slate-800/40 opacity-40 border border-slate-700' 
            : 'bg-white/10 border border-white/30 shadow-md backdrop-blur-sm'
        }">
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-white mb-2 shadow" style="background-color: ${team.color}">
            ${isEliminated ? Icons.cross("w-5 h-5") : Icons.users("w-5 h-5")}
          </div>
          <span class="text-xs font-bold text-white leading-tight">${team.shortName}</span>
          ${isEliminated ? '<span class="text-[10px] text-red-300 font-bold uppercase mt-1">Eliminado</span>' : ''}
        </div>
      `;
    }).join('');
  }

  function renderQuestion(state) {
    const q = state.currentQuestion;
    if (!q) return;

    questionRibbon.textContent = q.title || `Pregunta ${state.currentQuestionIndex + 1}`;
    questionStatement.textContent = q.statement || '';

    // Handle Math Display
    if (q.math) {
      questionMathArea.classList.remove('hidden');
      try {
        if (window.katex) {
          katex.render(q.math, mathTarget, {
            displayMode: true,
            throwOnError: false
          });
        } else {
          mathTarget.textContent = q.math;
        }
      } catch (e) {
        mathTarget.textContent = q.math;
      }
    } else {
      questionMathArea.classList.add('hidden');
    }

    // Handle Code Snippet
    if (q.code) {
      questionCodeArea.classList.remove('hidden');
      codeTarget.textContent = q.code;
      if (window.Prism) {
        Prism.highlightElement(codeTarget);
      }
    } else {
      questionCodeArea.classList.add('hidden');
    }

    // Handle Multiple Choice Options
    if (q.options && q.options.length > 0) {
      questionOptionsGrid.classList.remove('hidden');
      questionOptionsGrid.innerHTML = q.options.map((opt) => `
        <div class="option-card flex items-center gap-3">
          <span class="text-lg font-semibold text-white">${opt}</span>
        </div>
      `).join('');
    } else {
      questionOptionsGrid.classList.add('hidden');
    }

    // Status Indicator
    if (state.questionState === 'running') {
      questionStatusIndicator.textContent = "Pregunta en curso - Equipos respondiendo...";
      questionStatusIndicator.className = "text-emerald-300 font-semibold";
    } else if (state.questionState === 'paused') {
      questionStatusIndicator.textContent = "Tiempo en pausa";
      questionStatusIndicator.className = "text-amber-300 font-semibold";
    } else if (state.questionState === 'ended') {
      questionStatusIndicator.textContent = "Tiempo finalizado - Calificando respuestas";
      questionStatusIndicator.className = "text-blue-200 font-semibold";
    }
  }

  function renderFooterSubmissions(state) {
    const activeTeams = state.teams.filter(t => !t.eliminated);
    const submittedMap = new Map(state.submissions.map(s => [s.teamId, s]));

    footerSubmittedCount.textContent = `${state.submissions.length} / ${activeTeams.length} respondieron`;

    liveSubmissionsList.innerHTML = activeTeams.map(team => {
      const sub = submittedMap.get(team.id);
      if (sub) {
        // Medal icon if top 3
        let bonusBadge = '';
        if (sub.order === 1) bonusBadge = Icons.medal1("w-4 h-4");
        else if (sub.order === 2) bonusBadge = Icons.medal2("w-4 h-4");
        else if (sub.order === 3) bonusBadge = Icons.medal3("w-4 h-4");

        const seconds = Math.floor(sub.elapsedMs / 1000);
        const timeFormatted = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

        return `
          <div class="team-sub-badge submitted flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/90 border border-emerald-500/80 text-white shadow-md">
            <span class="text-xs font-black text-emerald-400">#${sub.order}</span>
            <span class="text-xs font-bold">${team.shortName}</span>
            <span class="text-[11px] font-mono text-emerald-300 bg-emerald-900/60 px-1.5 py-0.5 rounded">${timeFormatted}</span>
            ${bonusBadge}
          </div>
        `;
      } else {
        return `
          <div class="team-sub-badge flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-400">
            <span class="w-2 h-2 rounded-full bg-slate-600"></span>
            <span class="text-xs font-semibold">${team.shortName}</span>
            <span class="text-[10px] uppercase tracking-wider text-slate-500">Pendiente</span>
          </div>
        `;
      }
    }).join('');
  }

  function renderLeaderboard(state) {
    const roundNames = ["Nivel Fácil", "Nivel Normal", "Nivel Difícil", "Nivel Experto"];
    resultsRoundTitle.textContent = `Resumen de la ${roundNames[state.currentRoundIndex] || 'Ronda'}`;

    // Sort active teams by current round score descending
    const sortedTeams = [...state.teams.filter(t => !t.eliminated)].sort((a, b) => (state.roundScores[b.id] || 0) - (state.roundScores[a.id] || 0));

    leaderboardList.innerHTML = sortedTeams.map((team, idx) => {
      const score = state.roundScores[team.id] || 0;
      let medal = '';
      if (idx === 0) medal = Icons.medal1("w-6 h-6");
      else if (idx === 1) medal = Icons.medal2("w-6 h-6");
      else if (idx === 2) medal = Icons.medal3("w-6 h-6");
      else medal = `<span class="w-6 text-center font-bold text-slate-400">${idx + 1}º</span>`;

      return `
        <div class="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/80 border border-white/10">
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center">${medal}</div>
            <div class="w-3 h-3 rounded-full" style="background-color: ${team.color}"></div>
            <span class="font-bold text-white text-base">${team.name}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xl font-black font-mono text-cyan-300">${score}</span>
            <span class="text-xs font-bold uppercase text-slate-400">pts</span>
          </div>
        </div>
      `;
    }).join('');
  }
});
