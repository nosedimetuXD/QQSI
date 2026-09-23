// Team Client JavaScript
document.addEventListener('DOMContentLoaded', () => {
  const socket = window.QQSI_CONFIG ? window.QQSI_CONFIG.getSocket() : io();

  // Elements
  const teamSelectScreen = document.getElementById('teamSelectScreen');
  const teamDashboardScreen = document.getElementById('teamDashboardScreen');
  const teamsListContainer = document.getElementById('teamsListContainer');
  
  const teamHeaderName = document.getElementById('teamHeaderName');
  const teamTimerText = document.getElementById('teamTimerText');
  const teamTimerIconSlot = document.getElementById('teamTimerIconSlot');
  const buzzerIconSlot = document.getElementById('buzzerIconSlot');
  const checkIconSlot = document.getElementById('checkIconSlot');
  const eliminatedIconSlot = document.getElementById('eliminatedIconSlot');
  
  const activeTeamColorDot = document.getElementById('activeTeamColorDot');
  const activeTeamName = document.getElementById('activeTeamName');
  const activeTeamRoundBadge = document.getElementById('activeTeamRoundBadge');
  const btnChangeTeam = document.getElementById('btnChangeTeam');
  
  const teamQuestionBanner = document.getElementById('teamQuestionBanner');
  const teamQuestionStatement = document.getElementById('teamQuestionStatement');
  const teamQuestionMath = document.getElementById('teamQuestionMath');
  const btnSubmitAnswer = document.getElementById('btnSubmitAnswer');
  const deliveryStatusBox = document.getElementById('deliveryStatusBox');
  const deliveryOrderText = document.getElementById('deliveryOrderText');
  const deliveryTimeText = document.getElementById('deliveryTimeText');
  const eliminatedScreen = document.getElementById('eliminatedScreen');

  // Insert SVGs
  if (teamTimerIconSlot && window.Icons) teamTimerIconSlot.innerHTML = Icons.timer("w-3.5 h-3.5");
  if (buzzerIconSlot && window.Icons) buzzerIconSlot.innerHTML = Icons.send("w-7 h-7");
  if (checkIconSlot && window.Icons) checkIconSlot.innerHTML = Icons.check("w-5 h-5");
  if (eliminatedIconSlot && window.Icons) eliminatedIconSlot.innerHTML = Icons.cross("w-6 h-6");

  let selectedTeamId = localStorage.getItem('qqsi_selected_team') || null;
  let currentState = null;

  // Audio / Vibration feedback
  function hapticAndChime() {
    if (navigator.vibrate) {
      navigator.vibrate([80, 40, 80]);
    }
  }

  // Format seconds to mm:ss
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Socket Events
  socket.on('state_update', (state) => {
    currentState = state;
    updateView();
  });

  socket.on('timer_tick', ({ remaining }) => {
    teamTimerText.textContent = formatTime(remaining);
  });

  socket.on('submission_confirmed', ({ order, elapsedMs }) => {
    hapticAndChime();
    const sec = Math.floor(elapsedMs / 1000);
    const formatted = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    deliveryOrderText.textContent = `#${order}`;
    deliveryTimeText.textContent = formatted;
  });

  // Team Selection Handler
  function selectTeam(teamId) {
    selectedTeamId = teamId;
    localStorage.setItem('qqsi_selected_team', teamId);
    updateView();
  }

  btnChangeTeam.addEventListener('click', () => {
    selectedTeamId = null;
    localStorage.removeItem('qqsi_selected_team');
    updateView();
  });

  // Submit Answer Button Handler
  btnSubmitAnswer.addEventListener('click', () => {
    if (!selectedTeamId || !currentState) return;
    if (currentState.questionState !== 'running') return;

    btnSubmitAnswer.disabled = true;
    hapticAndChime();
    socket.emit('team_submit', { teamId: selectedTeamId });
  });

  function updateView() {
    if (!currentState) return;

    const roundNames = ["Ronda 1: Nivel Fácil", "Ronda 2: Nivel Normal", "Ronda 3: Nivel Difícil", "Ronda 4: Nivel Experto"];
    const roundName = roundNames[currentState.currentRoundIndex] || `Ronda ${currentState.currentRoundIndex + 1}`;

    // Render team list on selection screen
    teamsListContainer.innerHTML = currentState.teams.map(team => {
      const isEliminated = team.eliminated;
      return `
        <button 
          onclick="window.selectTeamId('${team.id}')"
          ${isEliminated ? 'disabled' : ''}
          class="w-full p-3.5 rounded-xl border flex items-center justify-between text-left transition-all ${
            isEliminated 
              ? 'bg-slate-800/40 border-slate-700 opacity-40 cursor-not-allowed text-slate-400' 
              : 'bg-white/15 hover:bg-white/30 active:scale-98 border-white/30 text-white shadow-md'
          }">
          <div class="flex items-center gap-3">
            <div class="w-3.5 h-3.5 rounded-full shadow" style="background-color: ${team.color}"></div>
            <span class="font-bold text-sm leading-tight">${team.name}</span>
          </div>
          ${isEliminated ? '<span class="text-[10px] font-black uppercase text-red-400">Eliminado</span>' : Icons.chevronRight("w-4 h-4 text-blue-200")}
        </button>
      `;
    }).join('');

    // Global hook for onclick
    window.selectTeamId = selectTeam;

    // Check if team is selected
    const team = currentState.teams.find(t => t.id === selectedTeamId);

    if (!team) {
      teamSelectScreen.classList.remove('hidden');
      teamDashboardScreen.classList.add('hidden');
      teamHeaderName.textContent = "Seleccionar Equipo";
      return;
    }

    // Show Dashboard
    teamSelectScreen.classList.add('hidden');
    teamDashboardScreen.classList.remove('hidden');
    teamHeaderName.textContent = team.shortName;
    activeTeamName.textContent = team.name;
    activeTeamColorDot.style.backgroundColor = team.color;
    activeTeamRoundBadge.textContent = roundName;

    // Check if team is eliminated
    if (team.eliminated) {
      eliminatedScreen.classList.remove('hidden');
      btnSubmitAnswer.disabled = true;
      btnSubmitAnswer.classList.add('hidden');
      deliveryStatusBox.classList.add('hidden');
      teamQuestionStatement.textContent = "Has sido eliminado de esta ronda.";
      return;
    } else {
      eliminatedScreen.classList.add('hidden');
      btnSubmitAnswer.classList.remove('hidden');
    }

    // Check submission status for current question
    const submission = currentState.submissions.find(s => s.teamId === team.id);

    if (currentState.questionState === 'running') {
      const q = currentState.currentQuestion;
      teamQuestionBanner.textContent = q ? (q.title || "Pregunta en Curso") : "Pregunta en Curso";
      teamQuestionStatement.textContent = q ? q.statement : "Pregunta activa";

      if (submission) {
        // Already submitted
        btnSubmitAnswer.disabled = true;
        btnSubmitAnswer.classList.add('hidden');
        deliveryStatusBox.classList.remove('hidden');
        deliveryOrderText.textContent = `#${submission.order}`;
        const sec = Math.floor(submission.elapsedMs / 1000);
        deliveryTimeText.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      } else {
        // Can submit
        btnSubmitAnswer.disabled = false;
        btnSubmitAnswer.classList.remove('hidden');
        deliveryStatusBox.classList.add('hidden');
      }
    } else if (currentState.questionState === 'ended' || currentState.questionState === 'evaluated') {
      teamQuestionBanner.textContent = "Pregunta Finalizada";
      btnSubmitAnswer.disabled = true;
      if (submission) {
        btnSubmitAnswer.classList.add('hidden');
        deliveryStatusBox.classList.remove('hidden');
        deliveryOrderText.textContent = `#${submission.order}`;
      } else {
        btnSubmitAnswer.classList.remove('hidden');
        deliveryStatusBox.classList.add('hidden');
        teamQuestionStatement.textContent = "El tiempo para responder esta pregunta ha concluido.";
      }
    } else {
      // Idle / Paused
      teamQuestionBanner.textContent = "En Espera";
      teamQuestionStatement.textContent = "Esperando que el moderador lance la siguiente pregunta...";
      btnSubmitAnswer.disabled = true;
      deliveryStatusBox.classList.add('hidden');
      btnSubmitAnswer.classList.remove('hidden');
    }
  }
});
