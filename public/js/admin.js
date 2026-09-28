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
  const btnNextQuestion = document.getElementById('btnNextQuestion');
  const nextQuestionText = document.getElementById('nextQuestionText');
  
  const adminTimerStatus = document.getElementById('adminTimerStatus');
  const adminTimerClock = document.getElementById('adminTimerClock');
  
  const submissionsCounter = document.getElementById('submissionsCounter');
  const submissionsQueueContainer = document.getElementById('submissionsQueueContainer');
  
  const adminStandingsList = document.getElementById('adminStandingsList');
  const btnToggleLeaderboard = document.getElementById('btnToggleLeaderboard');
  const toggleLeaderboardText = document.getElementById('toggleLeaderboardText');
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
      { id: 'sistemas', name: 'Ingeniería de Sistemas', shortName: 'Sistemas', color: '#0140B9', eliminated: false, score: 0 },
      { id: 'software', name: 'Ingeniería de Software', shortName: 'Software', color: '#286EDD', eliminated: false, score: 0 },
      { id: 'alimentos', name: 'Ingeniería de Alimentos', shortName: 'Alimentos', color: '#0437A6', eliminated: false, score: 0 },
      { id: 'quimica', name: 'Ingeniería Química', shortName: 'Química', color: '#9333ea', eliminated: false, score: 0 },
      { id: 'civil', name: 'Ingeniería Civil', shortName: 'Civil', color: '#FC6123', eliminated: false, score: 0 },
      { id: 'petroquimica', name: 'Téc. Procesos Petroquímicos', shortName: 'Petroquímica', color: '#032D8D', eliminated: false, score: 0 }
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
    adminTimerStatus.style.color = "#D42900";
  });

  // Render Round Tabs
  function renderRoundTabs() {
    if (!questionsData) return;
    const currentRoundIdx = currentState ? currentState.currentRoundIndex : 0;

    roundTabsContainer.innerHTML = questionsData.rounds.map((round, idx) => `
      <button 
        type="button"
        onclick="window.selectAdminRound(${idx})"
        style="padding: 10px 12px; border-radius: 14px; font-size: 11px; font-weight: 800; text-align: left; transition: transform var(--transition-liquid), box-shadow var(--transition-liquid), border-color var(--transition-liquid); display: flex; align-items: center; justify-content: space-between; cursor: pointer; ${
          idx === currentRoundIdx
            ? 'background: linear-gradient(135deg, #0437A6 0%, #032D8D 100%); border: 1.5px solid #6CA8E4; border-top: 1.5px solid #6CA8E4; color: #ffffff; box-shadow: 0 0 15px rgba(37,99,235,0.5), inset 0 1px 1px rgba(255,255,255,0.5);'
            : 'background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(6,17,33,0.7) 100%); border: 1px solid rgba(255,255,255,0.12); border-top: 1px solid rgba(255,255,255,0.25); color: #8ba3c4;'
        }">
        <span>${round.name}</span>
        <span style="font-size: 10px; opacity: 0.85; font-family: monospace;">${round.timeLimit}s</span>
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
          style="width: 100%; text-align: left; padding: 10px 14px; border-radius: 14px; transition: transform var(--transition-liquid), border-color var(--transition-liquid), box-shadow var(--transition-liquid); cursor: pointer; display: flex; align-items: center; gap: 10px; ${
            isSelected
              ? 'background: linear-gradient(135deg, rgba(76, 144, 222, 0.25) 0%, rgba(14, 34, 61, 0.8) 100%); border: 1.5px solid #4C90DE; border-top: 1.5px solid rgba(255,255,255,0.7); color: #ffffff; box-shadow: 0 0 12px rgba(76, 144, 222, 0.3), inset 0 1px 1px rgba(255,255,255,0.4);'
              : 'background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(12, 27, 61, 0.65) 100%); border: 1px solid rgba(255,255,255,0.1); border-top: 1px solid rgba(255,255,255,0.2); color: #8ba3c4;'
          }">
          <span style="width: 24px; height: 24px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; background: ${isSelected ? 'linear-gradient(180deg, #4C90DE, #0140B9)' : 'rgba(255,255,255,0.1)'}; color: ${isSelected ? '#031428' : '#b8cde0'}; font-family: monospace; flex-shrink: 0; box-shadow: ${isSelected ? '0 0 8px rgba(76, 144, 222, 0.5)' : 'none'};">
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

  // Update Question Preview
  function updatePreview() {
    if (!questionsData || !currentState) return;
    const currentRound = questionsData.rounds[currentState.currentRoundIndex];
    if (!currentRound) return;
    const q = currentRound.questions[currentState.currentQuestionIndex] || currentRound.questions[0];
    if (!q) return;

    previewQNumber.textContent = q.title || `Pregunta ${(currentState.currentQuestionIndex || 0) + 1}`;
    previewQTime.textContent = `${currentRound.timeLimit} segundos`;
    renderMathContent(previewQStatement, q.statement || '');

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

    renderMathContent(previewQAnswer, q.answerGuide || 'No especificada.');
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
      adminTimerStatus.style.color = "#4C90DE";
      btnLaunchQuestion.disabled = true;
      btnPauseResume.disabled = false;
      pauseResumeText.textContent = "Pausar";
      btnStopQuestion.disabled = false;
    } else if (state.questionState === 'paused') {
      adminTimerStatus.textContent = "Pausado";
      adminTimerStatus.style.color = "#FF7326";
      btnLaunchQuestion.disabled = true;
      btnPauseResume.disabled = false;
      pauseResumeText.textContent = "Reanudar";
      btnStopQuestion.disabled = false;
    } else if (state.questionState === 'ended') {
      adminTimerStatus.textContent = "Pregunta Finalizada";
      adminTimerStatus.style.color = "#D42900";
      btnLaunchQuestion.disabled = false;
      btnPauseResume.disabled = true;
      btnStopQuestion.disabled = true;
    } else {
      adminTimerStatus.textContent = "En Espera";
      adminTimerStatus.style.color = "#4C90DE";
      btnLaunchQuestion.disabled = false;
      btnPauseResume.disabled = true;
      btnStopQuestion.disabled = true;
    }

    // Submissions
    renderSubmissionsQueue(state);

    // Standings & Elimination
    renderStandings(state);

    // Next Question Button State
    if (btnNextQuestion && nextQuestionText && questionsData) {
      const currentRound = questionsData.rounds[state.currentRoundIndex];
      const totalQuestionsInRound = currentRound ? currentRound.questions.length : 0;
      const isLastQuestion = state.currentQuestionIndex >= totalQuestionsInRound - 1;

      if (isLastQuestion) {
        nextQuestionText.textContent = 'Última Pregunta de la Ronda';
        btnNextQuestion.disabled = true;
        btnNextQuestion.style.opacity = '0.5';
        btnNextQuestion.style.cursor = 'not-allowed';
      } else {
        nextQuestionText.textContent = `Avanzar a Siguiente Pregunta (${(state.currentQuestionIndex || 0) + 2}/${totalQuestionsInRound}) →`;
        btnNextQuestion.disabled = false;
        btnNextQuestion.style.opacity = '1';
        btnNextQuestion.style.cursor = 'pointer';
      }
    }

    // Toggle leaderboard button state
    if (toggleLeaderboardText && btnToggleLeaderboard) {
      if (state.showLeaderboard) {
        toggleLeaderboardText.textContent = 'Ocultar Ranking';
        btnToggleLeaderboard.style.background = 'rgba(212, 41, 0, 0.2)';
        btnToggleLeaderboard.style.borderColor = '#D42900';
        btnToggleLeaderboard.style.color = '#DF440C';
      } else {
        toggleLeaderboardText.textContent = 'Proyectar Ranking';
        btnToggleLeaderboard.style.background = 'rgba(76, 144, 222, 0.15)';
        btnToggleLeaderboard.style.borderColor = '#4C90DE';
        btnToggleLeaderboard.style.color = '#4C90DE';
      }
    }
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
        <div style="background: rgba(12, 27, 61, 0.95); border: 1.5px solid ${isCorrect ? '#286EDD' : isWrong ? '#D42900' : 'rgba(255,255,255,0.15)'}; border-radius: 12px; padding: 8px 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; box-sizing: border-box; width: 100%;">
          <div style="min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="font-size: 11px; font-weight: 900; color: #4C90DE; font-family: monospace;">#${order}</span>
              <span style="font-size: 12px; font-weight: 800; color: #ffffff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${sub.teamName}</span>
              <span style="font-size: 10px; color: #8ba3c4; font-family: monospace;">(${seconds}s)</span>
            </div>
            ${isCorrect ? `<span style="font-size: 10px; font-weight: 800; color: #4C90DE; display: block; margin-top: 2px;">+${sub.totalPoints} pts (+${sub.bonusPoints} bono)</span>` : ''}
          </div>

          <div style="display: flex; gap: 4px; flex-shrink: 0;">
            <button 
              type="button" 
              onclick="window.gradeAnswer(${idx}, true)"
              title="Calificar como Correcto"
              style="padding: 5px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; cursor: pointer; border: none; white-space: nowrap; ${
                isCorrect 
                  ? 'background: #286EDD; color: #ffffff;' 
                  : 'background: rgba(40, 110, 221, 0.2); color: #4C90DE; border: 1px solid #286EDD;'
              }">
              ✓ Correcto
            </button>
            <button 
              type="button" 
              onclick="window.gradeAnswer(${idx}, false)"
              title="Calificar como Incorrecto"
              style="padding: 5px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; cursor: pointer; border: none; white-space: nowrap; ${
                isWrong 
                  ? 'background: #D42900; color: #ffffff;' 
                  : 'background: rgba(212, 41, 0, 0.2); color: #DF440C; border: 1px solid #D42900;'
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
    const allTeams = [...(state.teams || [])];
    const activeTeams = allTeams.filter(t => !t.eliminated);
    const eliminatedTeams = allTeams.filter(t => t.eliminated);

    activeTeams.sort((a, b) => (b.score || 0) - (a.score || 0));
    eliminatedTeams.sort((a, b) => (b.score || 0) - (a.score || 0));

    const maxScore = Math.max(...allTeams.map(t => t.score || 0), 30);

    let html = '';

    if (activeTeams.length > 0) {
      html += activeTeams.map(team => {
        const pct = Math.round(((team.score || 0) / maxScore) * 100);
        return `
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 800; color: #ffffff; margin-bottom: 2px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 10px; height: 10px; border-radius: 9999px; background-color: ${team.color};"></div>
                <span>${team.shortName}</span>
              </div>
              <span style="font-family: monospace; color: #4C90DE;">${team.score || 0} pts</span>
            </div>
            <div class="team-progress-bar">
              <div class="team-progress-fill" style="width: ${pct}%; background-color: ${team.color};"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    if (eliminatedTeams.length > 0) {
      html += `
        <div style="margin-top: 12px; padding-top: 8px; border-top: 1px dashed rgba(255, 255, 255, 0.15);">
          <span style="font-size: 10px; font-weight: 800; color: #8ba3c4; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 6px;">Eliminados:</span>
          ${eliminatedTeams.map(team => `
            <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #8ba3c4; margin-bottom: 4px; opacity: 0.7;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 8px; height: 8px; border-radius: 9999px; background-color: ${team.color};"></div>
                <span>${team.shortName}</span>
                <span style="color: #D42900; font-size: 9px; font-weight: 800;">(Eliminado)</span>
              </div>
              <span style="font-family: monospace;">${team.score || 0} pts</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    adminStandingsList.innerHTML = html;

    // Update elimination dropdown
    selectTeamToEliminate.innerHTML = '<option value="">Seleccionar equipo a eliminar...</option>' + 
      activeTeams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
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

  if (btnNextQuestion) {
    btnNextQuestion.addEventListener('click', () => {
      socket.emit('admin_next_question', { adminPassword: currentAdminPassword });
    });
  }

  if (btnToggleLeaderboard) {
    btnToggleLeaderboard.addEventListener('click', () => {
      socket.emit('admin_toggle_results', { adminPassword: currentAdminPassword });
    });
  }

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
