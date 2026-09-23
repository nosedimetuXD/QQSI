// Admin Control Panel JavaScript
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // Elements
  const adminHeaderRound = document.getElementById('adminHeaderRound');
  const roundTabsContainer = document.getElementById('roundTabsContainer');
  const selectQuestion = document.getElementById('selectQuestion');
  
  const previewQNumber = document.getElementById('previewQNumber');
  const previewQTime = document.getElementById('previewQTime');
  const previewQStatement = document.getElementById('previewQStatement');
  const previewQMath = document.getElementById('previewQMath');
  const previewQAnswer = document.getElementById('previewQAnswer');
  
  const btnLaunchQuestion = document.getElementById('btnLaunchQuestion');
  const btnPauseResume = document.getElementById('btnPauseResume');
  const pauseResumeText = document.getElementById('pauseResumeText');
  const btnStopQuestion = document.getElementById('btnStopQuestion');
  
  const adminTimerStatus = document.getElementById('adminTimerStatus');
  const adminTimerClock = document.getElementById('adminTimerClock');
  
  const submissionsCounter = document.getElementById('submissionsCounter');
  const submissionsTableBody = document.getElementById('submissionsTableBody');
  const btnApplyPoints = document.getElementById('btnApplyPoints');
  
  const adminStandingsList = document.getElementById('adminStandingsList');
  const selectTeamToEliminate = document.getElementById('selectTeamToEliminate');
  const btnConfirmElimination = document.getElementById('btnConfirmElimination');
  const btnNextRound = document.getElementById('btnNextRound');
  const btnResetGame = document.getElementById('btnResetGame');

  // Insert SVGs
  const screenIconSlot = document.getElementById('screenIconSlot');
  const phoneIconSlot = document.getElementById('phoneIconSlot');
  const resetIconSlot = document.getElementById('resetIconSlot');
  const playIconSlot = document.getElementById('playIconSlot');
  const pauseIconSlot = document.getElementById('pauseIconSlot');
  const stopIconSlot = document.getElementById('stopIconSlot');
  const checkIconSlot2 = document.getElementById('checkIconSlot2');
  const chevronIconSlot = document.getElementById('chevronIconSlot');
  const alertIconSlot = document.getElementById('alertIconSlot');

  if (window.Icons) {
    if (screenIconSlot) screenIconSlot.innerHTML = Icons.screen("w-4 h-4");
    if (phoneIconSlot) phoneIconSlot.innerHTML = Icons.smartphone("w-4 h-4");
    if (resetIconSlot) resetIconSlot.innerHTML = Icons.rotateCcw("w-3.5 h-3.5");
    if (playIconSlot) playIconSlot.innerHTML = Icons.play("w-5 h-5");
    if (pauseIconSlot) pauseIconSlot.innerHTML = Icons.pause("w-4 h-4");
    if (stopIconSlot) stopIconSlot.innerHTML = Icons.stop("w-4 h-4");
    if (checkIconSlot2) checkIconSlot2.innerHTML = Icons.check("w-4 h-4");
    if (chevronIconSlot) chevronIconSlot.innerHTML = Icons.chevronRight("w-4 h-4");
    if (alertIconSlot) alertIconSlot.innerHTML = Icons.alertTriangle("w-4 h-4 text-red-400");
  }

  let questionsData = null;
  let currentState = null;

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Socket Events
  socket.on('questions_data', (data) => {
    questionsData = data;
    renderRoundTabs();
    if (currentState) {
      renderQuestionsDropdown();
      updatePreview();
    }
  });

  socket.on('state_update', (state) => {
    currentState = state;
    renderAdminView(state);
  });

  socket.on('timer_tick', ({ remaining }) => {
    adminTimerClock.textContent = formatTime(remaining);
  });

  socket.on('question_time_up', () => {
    adminTimerClock.textContent = "00:00";
    adminTimerStatus.textContent = "Tiempo Agotado";
    adminTimerStatus.className = "text-sm font-extrabold text-red-400";
  });

  // Render Round Tabs
  function renderRoundTabs() {
    if (!questionsData) return;
    const currentRoundIdx = currentState ? currentState.currentRoundIndex : 0;

    roundTabsContainer.innerHTML = questionsData.rounds.map((round, idx) => `
      <button 
        onclick="window.selectAdminRound(${idx})"
        class="p-2.5 rounded-xl border text-xs font-bold text-left transition flex items-center justify-between ${
          idx === currentRoundIdx
            ? 'bg-blue-600 border-blue-400 text-white shadow-md'
            : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-700/60'
        }">
        <span>${round.name}</span>
        <span class="text-[10px] opacity-75 font-mono">${round.timeLimit}s</span>
      </button>
    `).join('');
  }

  window.selectAdminRound = (roundIdx) => {
    socket.emit('admin_select_round', { roundIndex: roundIdx });
  };

  // Render Questions in Dropdown
  function renderQuestionsDropdown() {
    if (!questionsData || !currentState) return;
    const currentRound = questionsData.rounds[currentState.currentRoundIndex];
    if (!currentRound) return;

    selectQuestion.innerHTML = currentRound.questions.map((q, idx) => `
      <option value="${idx}" ${idx === currentState.currentQuestionIndex ? 'selected' : ''}>
        ${q.title}: ${q.statement.substring(0, 50)}...
      </option>
    `).join('');
  }

  selectQuestion.addEventListener('change', (e) => {
    const questionIndex = parseInt(e.target.value, 10);
    socket.emit('admin_select_question', {
      roundIndex: currentState.currentRoundIndex,
      questionIndex
    });
  });

  function updatePreview() {
    if (!questionsData || !currentState) return;
    const currentRound = questionsData.rounds[currentState.currentRoundIndex];
    if (!currentRound) return;
    const q = currentRound.questions[currentState.currentQuestionIndex];
    if (!q) return;

    previewQNumber.textContent = q.title;
    previewQTime.textContent = `${currentRound.timeLimit}s (${formatTime(currentRound.timeLimit)})`;
    previewQStatement.textContent = q.statement;

    if (q.math) {
      previewQMath.classList.remove('hidden');
      previewQMath.textContent = q.math;
    } else {
      previewQMath.classList.add('hidden');
    }

    previewQAnswer.textContent = q.answerGuide || 'Sin guía específica';
  }

  // Button Handlers
  btnLaunchQuestion.addEventListener('click', () => {
    socket.emit('admin_start_question');
  });

  btnPauseResume.addEventListener('click', () => {
    if (!currentState) return;
    if (currentState.questionState === 'running') {
      socket.emit('admin_pause_timer');
    } else if (currentState.questionState === 'paused') {
      socket.emit('admin_resume_timer');
    }
  });

  btnStopQuestion.addEventListener('click', () => {
    socket.emit('admin_stop_question');
  });

  btnApplyPoints.addEventListener('click', () => {
    socket.emit('admin_confirm_and_apply_points');
  });

  btnConfirmElimination.addEventListener('click', () => {
    const teamId = selectTeamToEliminate.value;
    if (!teamId) return;
    const team = currentState.teams.find(t => t.id === teamId);
    if (confirm(`¿Confirmas la eliminación de "${team.name}" de la competencia?`)) {
      socket.emit('admin_eliminate_team', { teamId });
    }
  });

  btnNextRound.addEventListener('click', () => {
    if (confirm('¿Deseas avanzar a la siguiente ronda? Esto reiniciará los puntajes acumulados para la nueva ronda con los equipos no eliminados.')) {
      socket.emit('admin_next_round');
    }
  });

  btnResetGame.addEventListener('click', () => {
    if (confirm('¿ADVERTENCIA: Deseas reiniciar todo el concurso desde cero? Se restablecerán todos los equipos, rondas y puntajes.')) {
      socket.emit('admin_reset_game');
    }
  });

  window.evaluateTeam = (teamId, isCorrect) => {
    socket.emit('admin_evaluate_submission', { teamId, isCorrect });
  };

  function renderAdminView(state) {
    const activeTeams = state.teams.filter(t => !t.eliminated);
    const roundNames = ["Ronda 1: Nivel Fácil", "Ronda 2: Nivel Normal", "Ronda 3: Nivel Difícil", "Ronda 4: Nivel Experto"];
    adminHeaderRound.textContent = `${roundNames[state.currentRoundIndex] || 'Ronda'} (${activeTeams.length} Equipos Activos)`;

    renderRoundTabs();
    renderQuestionsDropdown();
    updatePreview();

    // Timer status in Admin
    if (state.questionState === 'running') {
      adminTimerStatus.textContent = "Tiempo Corriendo";
      adminTimerStatus.className = "text-sm font-extrabold text-emerald-400";
      pauseResumeText.textContent = "Pausar";
      btnLaunchQuestion.disabled = true;
      btnLaunchQuestion.classList.add('opacity-50');
    } else if (state.questionState === 'paused') {
      adminTimerStatus.textContent = "Tiempo en Pausa";
      adminTimerStatus.className = "text-sm font-extrabold text-amber-400";
      pauseResumeText.textContent = "Reanudar";
      btnLaunchQuestion.disabled = true;
      btnLaunchQuestion.classList.add('opacity-50');
    } else {
      adminTimerStatus.textContent = state.questionState === 'ended' ? "Tiempo Concluido" : "En Espera";
      adminTimerStatus.className = "text-sm font-extrabold text-slate-400";
      pauseResumeText.textContent = "Pausar";
      btnLaunchQuestion.disabled = false;
      btnLaunchQuestion.classList.remove('opacity-50');
    }

    // Render Submissions Table
    submissionsCounter.textContent = `${state.submissions.length} entregas de ${activeTeams.length}`;

    if (state.submissions.length === 0) {
      submissionsTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="p-6 text-center text-slate-500 font-medium">
            No hay entregas para la pregunta actual.
          </td>
        </tr>
      `;
    } else {
      submissionsTableBody.innerHTML = state.submissions.map(sub => {
        const sec = Math.floor(sub.elapsedMs / 1000);
        const timeFormatted = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
        
        let bonusBadge = '';
        if (sub.bonusPoints === 5) bonusBadge = `<span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 text-[10px]">+5 Bono (1º)</span>`;
        else if (sub.bonusPoints === 3) bonusBadge = `<span class="px-1.5 py-0.5 rounded bg-slate-400/20 text-slate-300 font-bold border border-slate-400/40 text-[10px]">+3 Bono (2º)</span>`;
        else if (sub.bonusPoints === 1) bonusBadge = `<span class="px-1.5 py-0.5 rounded bg-amber-700/20 text-amber-400 font-bold border border-amber-700/40 text-[10px]">+1 Bono (3º)</span>`;

        return `
          <tr class="hover:bg-slate-800/40 transition">
            <td class="p-3 font-mono font-bold text-amber-400">#${sub.order}</td>
            <td class="p-3 font-bold text-white flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${sub.color}"></span>
              <span>${sub.teamName}</span>
            </td>
            <td class="p-3 font-mono text-slate-300">${timeFormatted}</td>
            <td class="p-3 text-center">
              <div class="inline-flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-700">
                <button 
                  onclick="window.evaluateTeam('${sub.teamId}', true)"
                  class="px-2.5 py-1 rounded-lg font-bold text-xs transition flex items-center gap-1 ${
                    sub.correct === true 
                      ? 'bg-emerald-600 text-white shadow' 
                      : 'text-slate-400 hover:text-emerald-300'
                  }">
                  ${Icons.check("w-3.5 h-3.5")}
                  <span>Correcto</span>
                </button>
                <button 
                  onclick="window.evaluateTeam('${sub.teamId}', false)"
                  class="px-2.5 py-1 rounded-lg font-bold text-xs transition flex items-center gap-1 ${
                    sub.correct === false 
                      ? 'bg-red-600 text-white shadow' 
                      : 'text-slate-400 hover:text-red-300'
                  }">
                  ${Icons.cross("w-3.5 h-3.5")}
                  <span>Incorrecto</span>
                </button>
              </div>
            </td>
            <td class="p-3 text-right">
              <div class="flex flex-col items-end">
                <span class="font-mono font-black text-sm text-cyan-300">${sub.totalPoints} pts</span>
                ${bonusBadge}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Render Round Standings in Admin
    const sortedTeams = [...state.teams].sort((a, b) => {
      if (a.eliminated && !b.eliminated) return 1;
      if (!a.eliminated && b.eliminated) return -1;
      return (state.roundScores[b.id] || 0) - (state.roundScores[a.id] || 0);
    });

    adminStandingsList.innerHTML = sortedTeams.map((team, idx) => {
      const isEliminated = team.eliminated;
      const score = state.roundScores[team.id] || 0;

      return `
        <div class="flex items-center justify-between p-3 rounded-xl border ${
          isEliminated 
            ? 'bg-slate-900/40 border-slate-800 opacity-40 text-slate-500' 
            : 'bg-slate-900/80 border-slate-700 text-white'
        }">
          <div class="flex items-center gap-2.5">
            <span class="font-mono font-bold text-xs text-slate-400 w-5 text-center">${idx + 1}º</span>
            <div class="w-3 h-3 rounded-full" style="background-color: ${team.color}"></div>
            <span class="font-bold text-sm">${team.name}</span>
            ${isEliminated ? `<span class="text-[10px] font-bold text-red-400 bg-red-950 px-1.5 py-0.5 rounded border border-red-900">Eliminado en R${team.eliminatedInRound}</span>` : ''}
          </div>
          <div class="flex items-center gap-2">
            <span class="font-mono font-black text-cyan-300 text-base">${score}</span>
            <span class="text-[10px] text-slate-400 font-bold uppercase">pts</span>
          </div>
        </div>
      `;
    }).join('');

    // Populate Elimination Dropdown with active teams
    selectTeamToEliminate.innerHTML = activeTeams.map(t => `
      <option value="${t.id}">${t.name} (${state.roundScores[t.id] || 0} pts)</option>
    `).join('');
  }
});
