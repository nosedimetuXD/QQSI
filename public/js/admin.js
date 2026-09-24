// Admin Control Panel JavaScript — Secure Server Auth & 3-Column Judge Controls
document.addEventListener('DOMContentLoaded', () => {
  const socket = window.QQSI_CONFIG ? window.QQSI_CONFIG.getSocket() : io();

  // Authentication DOM Elements
  const adminLoginModal = document.getElementById('adminLoginModal');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const inputAdminPassword = document.getElementById('inputAdminPassword');
  const adminLoginError = document.getElementById('adminLoginError');
  const btnLogoutAdmin = document.getElementById('btnLogoutAdmin');

  // Main Admin Elements
  const adminHeaderRound = document.getElementById('adminHeaderRound');
  const roundTabsContainer = document.getElementById('roundTabsContainer');
  const questionsListContainer = document.getElementById('questionsListContainer');
  
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
  const submissionsQueueContainer = document.getElementById('submissionsQueueContainer');
  
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
  const chevronIconSlot = document.getElementById('chevronIconSlot');

  if (window.Icons) {
    if (screenIconSlot) screenIconSlot.innerHTML = Icons.screen("w-4 h-4");
    if (phoneIconSlot) phoneIconSlot.innerHTML = Icons.smartphone("w-4 h-4");
    if (resetIconSlot) resetIconSlot.innerHTML = Icons.rotateCcw("w-3.5 h-3.5");
    if (playIconSlot) playIconSlot.innerHTML = Icons.play("w-5 h-5");
    if (pauseIconSlot) pauseIconSlot.innerHTML = Icons.pause("w-4 h-4");
    if (stopIconSlot) stopIconSlot.innerHTML = Icons.stop("w-4 h-4");
    if (chevronIconSlot) chevronIconSlot.innerHTML = Icons.chevronRight("w-4 h-4");
  }

  let questionsData = window.QUESTIONS_DATA || null;
  let currentState = {
    teams: [
      { id: 'sistemas', name: 'Ingeniería de Sistemas', shortName: 'Sistemas', color: '#0284c7', eliminated: false, score: 0 },
      { id: 'alimentos', name: 'Ingeniería de Alimentos', shortName: 'Alimentos', color: '#16a34a', eliminated: false, score: 0 },
      { id: 'quimica', name: 'Ingeniería Química', shortName: 'Química', color: '#9333ea', eliminated: false, score: 0 },
      { id: 'civil', name: 'Ingeniería Civil', shortName: 'Civil', color: '#ea580c', eliminated: false, score: 0 },
      { id: 'petroquimica', name: 'Téc. Procesos Petroquímicos', shortName: 'Petroquímica', color: '#0d9488', eliminated: false, score: 0 }
    ],
    currentRoundIndex: 0,
    currentQuestionIndex: 0,
    questionState: 'idle',
    submissions: [],
    roundScores: {}
  };
  let currentAdminPassword = sessionStorage.getItem('qqsi_admin_password') || '';

  // Initial immediate render
  if (questionsData) {
    renderRoundTabs();
    renderQuestionsList();
    updatePreview();
  }
  renderAdminView(currentState);

  // Check saved session on load
  if (currentAdminPassword) {
    socket.emit('admin_login', { password: currentAdminPassword });
  } else {
    adminLoginModal.style.display = 'flex';
  }

  const btnSubmitAdminAuth = document.getElementById('btnSubmitAdminAuth');

  // Handle Form Submit
  adminLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pwd = inputAdminPassword.value.trim();
    if (!pwd) return;

    adminLoginError.style.display = 'none';
    currentAdminPassword = pwd;
    if (btnSubmitAdminAuth) {
      btnSubmitAdminAuth.disabled = true;
      btnSubmitAdminAuth.textContent = 'Verificando...';
    }

    socket.emit('admin_login', { password: pwd });

    // 4s timeout safety
    setTimeout(() => {
      if (adminLoginModal.style.display === 'flex' && btnSubmitAdminAuth && btnSubmitAdminAuth.disabled) {
        btnSubmitAdminAuth.disabled = false;
        btnSubmitAdminAuth.textContent = 'Ingresar al Panel';
        if (socket.connected === false) {
          adminLoginError.textContent = 'Conectando con el servidor... Reintenta en 3 segundos.';
          adminLoginError.style.display = 'block';
        }
      }
    }, 4000);
  });

  btnLogoutAdmin.addEventListener('click', () => {
    sessionStorage.removeItem('qqsi_admin_password');
    currentAdminPassword = '';
    window.location.reload();
  });

  socket.on('admin_login_success', () => {
    if (btnSubmitAdminAuth) {
      btnSubmitAdminAuth.disabled = false;
      btnSubmitAdminAuth.textContent = 'Ingresar al Panel';
    }
    sessionStorage.setItem('qqsi_admin_password', currentAdminPassword);
    adminLoginModal.style.display = 'none';
    inputAdminPassword.value = '';
  });

  socket.on('admin_login_error', (data) => {
    if (btnSubmitAdminAuth) {
      btnSubmitAdminAuth.disabled = false;
      btnSubmitAdminAuth.textContent = 'Ingresar al Panel';
    }
    sessionStorage.removeItem('qqsi_admin_password');
    currentAdminPassword = '';
    adminLoginModal.style.display = 'flex';
    adminLoginError.textContent = (data && data.error) || 'Contraseña incorrecta.';
    adminLoginError.style.display = 'block';
  });

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Socket Events
  socket.on('questions_data', (data) => {
    questionsData = data;
    renderRoundTabs();
    renderQuestionsList();
    updatePreview();
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
    adminTimerStatus.style.color = "#ef4444";
  });

  // Render Round Tabs
  function renderRoundTabs() {
    if (!questionsData) return;
    const currentRoundIdx = currentState ? currentState.currentRoundIndex : 0;

    roundTabsContainer.innerHTML = questionsData.rounds.map((round, idx) => `
      <button 
        type="button"
        onclick="window.selectAdminRound(${idx})"
        style="padding: 10px; border-radius: 12px; font-size: 11px; font-weight: 800; text-align: left; transition: all 0.2s; display: flex; align-items: center; justify-content: space-between; cursor: pointer; ${
          idx === currentRoundIdx
            ? 'background: #2563eb; border: 1.5px solid #60a5fa; color: #ffffff; box-shadow: 0 0 10px rgba(37,99,235,0.4);'
            : 'background: rgba(4, 12, 24, 0.7); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8;'
        }">
        <span>${round.name}</span>
        <span style="font-size: 10px; opacity: 0.8; font-family: monospace;">${round.timeLimit}s</span>
      </button>
    `).join('');
  }

  window.selectAdminRound = (roundIdx) => {
    socket.emit('admin_select_round', { roundIndex: roundIdx, adminPassword: currentAdminPassword });
  };

  // Render Questions List in Left Column
  function renderQuestionsList() {
    if (!questionsData || !currentState) return;
    const currentRound = questionsData.rounds[currentState.currentRoundIndex];
    if (!currentRound) return;

    questionsListContainer.innerHTML = currentRound.questions.map((q, idx) => {
      const isSelected = idx === currentState.currentQuestionIndex;
      return `
        <button 
          type="button"
          onclick="window.selectAdminQuestion(${idx})"
          style="width: 100%; text-align: left; padding: 10px 14px; border-radius: 12px; transition: all 0.2s; cursor: pointer; display: flex; align-items: center; gap: 10px; ${
            isSelected
              ? 'background: rgba(56, 189, 248, 0.2); border: 1.5px solid #38bdf8; color: #ffffff;'
              : 'background: rgba(4, 12, 24, 0.6); border: 1px solid rgba(255,255,255,0.08); color: #94a3b8;'
          }">
          <span style="width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; background: ${isSelected ? '#38bdf8' : '#1e293b'}; color: ${isSelected ? '#031428' : '#cbd5e1'}; font-family: monospace; flex-shrink: 0;">
            ${idx + 1}
          </span>
          <span style="font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">
            ${q.statement}
          </span>
        </button>
      `;
    }).join('');
  }

  window.selectAdminQuestion = (qIdx) => {
    socket.emit('admin_select_question', { questionIndex: qIdx, adminPassword: currentAdminPassword });
  };

  // Update Question Preview
  function updatePreview() {
    if (!questionsData || !currentState) return;
    const currentRound = questionsData.rounds[currentState.currentRoundIndex];
    if (!currentRound) return;
    const q = currentRound.questions[currentState.currentQuestionIndex] || currentRound.questions[0];
    if (!q) return;

    previewQNumber.textContent = q.title || `Pregunta ${(currentState.currentQuestionIndex || 0) + 1}`;
    previewQTime.textContent = `${currentRound.timeLimit} segundos`;
    previewQStatement.textContent = q.statement || '';

    if (q.math) {
      previewQMath.style.display = 'block';
      try {
        if (window.katex) {
          katex.render(q.math, previewQMath, { displayMode: true, throwOnError: false });
        } else {
          previewQMath.textContent = q.math;
        }
      } catch (e) {
        previewQMath.textContent = q.math;
      }
    } else {
      previewQMath.style.display = 'none';
    }

    previewQAnswer.textContent = q.answerGuide || 'No especificada.';
  }

  function renderAdminView(state) {
    const roundNames = ['Ronda 1: Nivel Fácil', 'Ronda 2: Nivel Normal', 'Ronda 3: Nivel Difícil', 'Ronda 4: Nivel Experto'];
    const activeTeams = (state.teams || []).filter(t => !t.eliminated);
    adminHeaderRound.textContent = `${roundNames[state.currentRoundIndex]} (${activeTeams.length} Equipos Activos)`;

    renderRoundTabs();
    renderQuestionsList();
    updatePreview();

    // Timer status & buttons
    if (state.timer) {
      adminTimerClock.textContent = formatTime(state.timer.remaining);
    }

    if (state.questionState === 'running') {
      adminTimerStatus.textContent = "Pregunta en Curso";
      adminTimerStatus.style.color = "#34d399";
      btnLaunchQuestion.disabled = true;
      btnPauseResume.disabled = false;
      pauseResumeText.textContent = "Pausar";
      btnStopQuestion.disabled = false;
    } else if (state.questionState === 'paused') {
      adminTimerStatus.textContent = "Pausado";
      adminTimerStatus.style.color = "#fbbf24";
      btnLaunchQuestion.disabled = true;
      btnPauseResume.disabled = false;
      pauseResumeText.textContent = "Reanudar";
      btnStopQuestion.disabled = false;
    } else if (state.questionState === 'ended') {
      adminTimerStatus.textContent = "Pregunta Finalizada";
      adminTimerStatus.style.color = "#ef4444";
      btnLaunchQuestion.disabled = false;
      btnPauseResume.disabled = true;
      btnStopQuestion.disabled = true;
    } else {
      adminTimerStatus.textContent = "En Espera";
      adminTimerStatus.style.color = "#38bdf8";
      btnLaunchQuestion.disabled = false;
      btnPauseResume.disabled = true;
      btnStopQuestion.disabled = true;
    }

    // Submissions
    renderSubmissionsQueue(state);

    // Standings & Elimination
    renderStandings(state);
  }

  function renderSubmissionsQueue(state) {
    const submissions = state.submissions || [];
    const activeTeams = (state.teams || []).filter(t => !t.eliminated);
    submissionsCounter.textContent = `${submissions.length} / ${activeTeams.length}`;

    if (submissions.length === 0) {
      submissionsQueueContainer.innerHTML = `
        <span style="font-size: 12px; color: #64748b; font-style: italic; text-align: center; padding: 24px 0; display: block;">
          Esperando pulsaciones de los equipos...
        </span>
      `;
      return;
    }

    submissionsQueueContainer.innerHTML = submissions.map((sub, idx) => {
      const order = idx + 1;
      const seconds = (sub.elapsedMs / 1000).toFixed(1);
      const isEvaluated = sub.correct !== null;
      const isCorrect = sub.correct === true;
      const isWrong = sub.correct === false;

      return `
        <div style="background: rgba(8, 20, 36, 0.95); border: 1.5px solid ${isCorrect ? '#10b981' : isWrong ? '#ef4444' : 'rgba(255,255,255,0.15)'}; border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 12px; font-weight: 900; color: #38bdf8; font-family: monospace;">#${order}</span>
              <span style="font-size: 13px; font-weight: 800; color: #ffffff;">${sub.teamName}</span>
              <span style="font-size: 11px; color: #94a3b8; font-family: monospace;">(${seconds}s)</span>
            </div>
            ${isCorrect ? `<span style="font-size: 11px; font-weight: 800; color: #34d399;">+${sub.totalPoints} pts (Base 10 + Bono ${sub.bonusPoints})</span>` : ''}
          </div>

          <div style="display: flex; gap: 6px;">
            <button 
              type="button" 
              onclick="window.gradeAnswer(${idx}, true)"
              style="padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; border: none; ${
                isCorrect 
                  ? 'background: #10b981; color: #ffffff;' 
                  : 'background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #10b981;'
              }">
              ✓ Correcto
            </button>
            <button 
              type="button" 
              onclick="window.gradeAnswer(${idx}, false)"
              style="padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; border: none; ${
                isWrong 
                  ? 'background: #ef4444; color: #ffffff;' 
                  : 'background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444;'
              }">
              ✗ Incorrecto
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.gradeAnswer = (submissionIdx, isCorrect) => {
    socket.emit('admin_evaluate_answer', {
      submissionIndex: submissionIdx,
      correct: isCorrect,
      adminPassword: currentAdminPassword
    });
  };

  function renderStandings(state) {
    const teams = [...(state.teams || [])];
    teams.sort((a, b) => (b.score || 0) - (a.score || 0));
    const maxScore = Math.max(...teams.map(t => t.score || 0), 30);

    adminStandingsList.innerHTML = teams.map(team => {
      const pct = Math.round(((team.score || 0) / maxScore) * 100);
      const isEliminated = team.eliminated;

      return `
        <div style="opacity: ${isEliminated ? '0.4' : '1'};">
          <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 800; color: #ffffff; margin-bottom: 2px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 10px; height: 10px; border-radius: 9999px; background-color: ${team.color};"></div>
              <span>${team.shortName}</span>
              ${isEliminated ? '<span style="color: #ef4444; font-size: 10px;">(Eliminado)</span>' : ''}
            </div>
            <span style="font-family: monospace; color: #34d399;">${team.score || 0} pts</span>
          </div>
          <div class="team-progress-bar">
            <div class="team-progress-fill" style="width: ${pct}%; background-color: ${team.color};"></div>
          </div>
        </div>
      `;
    }).join('');

    // Update elimination dropdown
    selectTeamToEliminate.innerHTML = '<option value="">Seleccionar equipo a eliminar...</option>' + 
      teams.filter(t => !t.eliminated).map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  }

  // Button Handlers
  btnLaunchQuestion.addEventListener('click', () => {
    socket.emit('admin_start_timer', { adminPassword: currentAdminPassword });
  });

  btnPauseResume.addEventListener('click', () => {
    socket.emit('admin_pause_timer', { adminPassword: currentAdminPassword });
  });

  btnStopQuestion.addEventListener('click', () => {
    socket.emit('admin_stop_timer', { adminPassword: currentAdminPassword });
  });

  btnConfirmElimination.addEventListener('click', () => {
    const teamId = selectTeamToEliminate.value;
    if (!teamId) return;
    if (confirm(`¿Estás seguro de eliminar a este equipo?`)) {
      socket.emit('admin_eliminate_team', { teamId, adminPassword: currentAdminPassword });
    }
  });

  btnNextRound.addEventListener('click', () => {
    if (confirm('¿Deseas avanzar a la siguiente ronda del concurso?')) {
      socket.emit('admin_next_round', { adminPassword: currentAdminPassword });
    }
  });

  btnResetGame.addEventListener('click', () => {
    if (confirm('¿ATENCIÓN: Deseas reiniciar todo el concurso y restablecer los 5 equipos?')) {
      socket.emit('admin_reset_game', { adminPassword: currentAdminPassword });
    }
  });
});
