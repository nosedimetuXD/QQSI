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
    adminTimerStatus.style.color = "var(--error)";
  });

  // Render Round Tabs
  function renderRoundTabs() {
    if (!questionsData) return;
    const currentRoundIdx = currentState ? currentState.currentRoundIndex : 0;

    roundTabsContainer.innerHTML = questionsData.rounds.map((round, idx) => `
      <button type="button" onclick="window.selectAdminRound(${idx})" class="round-tab${idx === currentRoundIdx ? ' is-active' : ''}">
        <span>${round.name}</span>
        <span class="mono">${round.timeLimit}s</span>
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

    const bankCount = document.getElementById('bankCount');
    if (bankCount) bankCount.textContent = `${currentRound.questions.length} preguntas`;
    const locked = currentState.questionState === 'running' || currentState.questionState === 'paused';
    const pencil = window.Icons ? Icons.pencil('w-4 h-4') : '✎';
    const trash = window.Icons ? Icons.trash('w-4 h-4') : '✕';

    questionsListContainer.innerHTML = currentRound.questions.map((q, idx) => {
      const isSelected = idx === currentState.currentQuestionIndex;
      const rowLocked = locked && isSelected;
      const lockTitle = rowLocked ? ' (termina la pregunta en curso primero)' : '';
      return `
        <div class="q-row${isSelected ? ' is-active' : ''}">
          <button type="button" onclick="window.selectAdminQuestion(${idx})" class="q-item${isSelected ? ' is-active' : ''}">
            <span class="q-num">${idx + 1}</span>
            <span class="q-label">${q.statement}</span>
          </button>
          <button type="button" class="q-act" onclick="window.adminEditQuestion(${idx})" ${rowLocked ? 'disabled' : ''} aria-label="Editar pregunta ${idx + 1}" title="Editar pregunta ${idx + 1}${lockTitle}">${pencil}</button>
          <button type="button" class="q-act is-danger" onclick="window.adminDeleteQuestion(${idx})" ${rowLocked ? 'disabled' : ''} aria-label="Eliminar pregunta ${idx + 1}" title="Eliminar pregunta ${idx + 1}${lockTitle}">${trash}</button>
        </div>
      `;
    }).join('');
    renderMathContent(questionsListContainer, null);
  }

  window.selectAdminQuestion = (qIdx) => {
    socket.emit('admin_select_question', { questionIndex: qIdx, adminPassword: currentAdminPassword });
  };

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
    const readyCount = activeTeams.filter(t => (state.readyTeams || []).includes(t.id)).length;
    adminHeaderRound.textContent = `${roundNames[state.currentRoundIndex]} · ${activeTeams.length} equipos · ${readyCount}/${activeTeams.length} con check-in`;

    renderRoundTabs();
    renderQuestionsList();
    updatePreview();

    // Timer status & buttons
    if (state.timer) {
      adminTimerClock.textContent = formatTime(state.timer.remaining);
    }

    if (state.questionState === 'running') {
      adminTimerStatus.textContent = "Pregunta en Curso";
      adminTimerStatus.style.color = "var(--accent-led)";
      btnLaunchQuestion.disabled = true;
      btnPauseResume.disabled = false;
      pauseResumeText.textContent = "Pausar";
      btnStopQuestion.disabled = false;
    } else if (state.questionState === 'paused') {
      adminTimerStatus.textContent = "Pausado";
      adminTimerStatus.style.color = "var(--warning)";
      btnLaunchQuestion.disabled = true;
      btnPauseResume.disabled = false;
      pauseResumeText.textContent = "Reanudar";
      btnStopQuestion.disabled = false;
    } else if (state.questionState === 'ended') {
      adminTimerStatus.textContent = "Pregunta Finalizada";
      adminTimerStatus.style.color = "var(--error)";
      btnLaunchQuestion.disabled = false;
      btnPauseResume.disabled = true;
      btnStopQuestion.disabled = true;
    } else {
      adminTimerStatus.textContent = "En Espera";
      adminTimerStatus.style.color = "var(--accent-led)";
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
      } else {
        nextQuestionText.textContent = `Avanzar a Siguiente Pregunta (${(state.currentQuestionIndex || 0) + 2}/${totalQuestionsInRound}) →`;
        btnNextQuestion.disabled = false;
      }
    }

    // Toggle leaderboard button state
    if (toggleLeaderboardText && btnToggleLeaderboard) {
      if (state.showLeaderboard) {
        toggleLeaderboardText.textContent = 'Ocultar Ranking';
        btnToggleLeaderboard.classList.add('is-danger');
      } else {
        toggleLeaderboardText.textContent = 'Proyectar Ranking';
        btnToggleLeaderboard.classList.remove('is-danger');
      }
    }
  }

  function renderSubmissionsQueue(state) {
    // La clave viene del banco privado del moderador (el estado público no la incluye)
    const bankRound = questionsData && questionsData.rounds[state.currentRoundIndex];
    const q = bankRound ? bankRound.questions[state.currentQuestionIndex] : null;
    const correctOption = q && q.correctOption ? String(q.correctOption).toUpperCase() : null;
    const submissions = state.submissions || [];
    const activeTeams = (state.teams || []).filter(t => !t.eliminated);
    submissionsCounter.textContent = `${submissions.length} / ${activeTeams.length}`;

    if (submissions.length === 0) {
      submissionsQueueContainer.innerHTML = `<span class="empty-note">Esperando pulsaciones de los equipos…</span>`;
      return;
    }

    submissionsQueueContainer.innerHTML = submissions.map((sub, idx) => {
      const order = idx + 1;
      const seconds = (sub.elapsedMs / 1000).toFixed(1);
      const isEvaluated = sub.correct !== null;
      const isCorrect = sub.correct === true;
      const isWrong = sub.correct === false;
      const matches = correctOption && sub.option ? sub.option === correctOption : null;
      const matchClass = matches === true ? ' is-match' : (matches === false ? ' is-miss' : '');
      const matchLabel = matches === true ? ' · coincide ✓' : (matches === false ? ` · clave ${correctOption}` : '');

      return `
        <div class="sub-row${isCorrect ? ' is-correct' : isWrong ? ' is-wrong' : ''}">
          <div class="sub-info">
            <div class="sub-line">
              <span class="sub-order">#${order}</span>
              <span class="sub-name">${sub.teamName}</span>
              <span class="sub-secs">${seconds}s</span>
              ${sub.option ? `<span class="sub-option${matchClass}" title="Opción elegida por el equipo">Opción ${sub.option}${matchLabel}</span>` : ''}
            </div>
            ${isCorrect ? `<span class="sub-pts">✓ +${sub.totalPoints} pts (+${sub.bonusPoints} bono)</span>` : ''}
            ${isWrong ? `<span class="sub-bad">✕ Incorrecta · 0 pts</span>` : ''}
          </div>
          <div class="sub-actions">
            <button type="button" onclick="window.gradeAnswer(${idx}, true)" title="Calificar como correcto" class="eval-btn ok${isCorrect ? ' is-on' : ''}" aria-pressed="${isCorrect}">✓ Correcto</button>
            <button type="button" onclick="window.gradeAnswer(${idx}, false)" title="Calificar como incorrecto" class="eval-btn ko${isWrong ? ' is-on' : ''}" aria-pressed="${isWrong}">✕ Incorrecto</button>
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
            <div class="standing-head">
              <div>
                <span class="team-dot" style="background-color: ${team.color};"></span>
                <span>${team.shortName}</span>
              </div>
              <span class="mono">${team.score || 0} pts</span>
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
        <div class="standings-out">
          <span class="eyebrow">Eliminados</span>
          ${eliminatedTeams.map(team => `
            <div class="standing-out-row">
              <div>
                <span class="team-dot" style="width: 8px; height: 8px; background-color: ${team.color};"></span>
                <span>${team.shortName}</span>
                <span class="tag-out">Eliminado</span>
              </div>
              <span class="mono">${team.score || 0} pts</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    adminStandingsList.innerHTML = html;

    // Update elimination dropdown
    // Conservar la selección del moderador entre actualizaciones de estado
    const previousSelection = selectTeamToEliminate.value;
    selectTeamToEliminate.innerHTML = '<option value="">Seleccionar equipo a eliminar...</option>' +
      activeTeams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    if (activeTeams.some(t => t.id === previousSelection)) selectTeamToEliminate.value = previousSelection;
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

  // Confirmaciones con el modal del panel (sin diálogos nativos del navegador)
  btnConfirmElimination.addEventListener('click', async () => {
    const teamId = selectTeamToEliminate.value;
    if (!teamId) return;
    const team = (currentState.teams || []).find(t => t.id === teamId);
    const ok = await appConfirm({
      title: '¿Eliminar equipo?',
      message: `${team ? team.name : 'El equipo'} quedará fuera del concurso y ya no podrá responder.`,
      confirmLabel: 'Sí, eliminar equipo'
    });
    if (ok) socket.emit('admin_eliminate_team', { teamId, adminPassword: currentAdminPassword });
  });

  btnNextRound.addEventListener('click', async () => {
    const ok = await appConfirm({
      title: '¿Avanzar a la siguiente ronda?',
      message: 'Se cierra la ronda actual y los equipos pasan a la siguiente con sus puntos acumulados.',
      confirmLabel: 'Sí, avanzar',
      danger: false
    });
    if (ok) socket.emit('admin_next_round', { adminPassword: currentAdminPassword });
  });

  btnResetGame.addEventListener('click', async () => {
    const ok = await appConfirm({
      title: '¿Reiniciar todo el concurso?',
      message: 'Se borran puntajes, entregas, check-ins y eliminaciones de los 6 equipos. Esta acción no se puede deshacer.',
      confirmLabel: 'Sí, reiniciar todo'
    });
    if (ok) socket.emit('admin_reset_game', { adminPassword: currentAdminPassword });
  });

  // ==========================================================================
  // EDITOR DEL BANCO DE PREGUNTAS (crear / editar / eliminar)
  // ==========================================================================
  const LETTERS = ['A', 'B', 'C', 'D'];
  const ROUND_LABELS = ['Ronda 1: Nivel Fácil', 'Ronda 2: Nivel Normal', 'Ronda 3: Nivel Difícil', 'Ronda 4: Nivel Experto'];
  const $ = (id) => document.getElementById(id);

  const editorModal = $('questionEditorModal');
  const editorForm = $('questionEditorForm');
  const editorTitle = $('editorTitle');
  const editorEyebrow = $('editorEyebrow');
  const editorRound = $('editorRound');
  const editorStatement = $('editorStatement');
  const editorOptionsRow = $('editorOptionsRow');
  const editorExtra = $('editorExtra');
  const editorMath = $('editorMath');
  const editorMathPreview = $('editorMathPreview');
  const editorCode = $('editorCode');
  const editorGuide = $('editorGuide');
  const editorGuideReq = $('editorGuideReq');
  const editorError = $('editorError');
  const btnSaveQuestion = $('btnSaveQuestion');
  const deleteModal = $('deleteConfirmModal');
  const deleteDesc = $('deleteDesc');
  const deleteError = $('deleteError');
  const btnConfirmDelete = $('btnConfirmDelete');
  const adminToast = $('adminToast');

  let editing = null; // { roundIndex, questionIndex|null }
  let lastFocus = null;
  let toastTimer = null;

  function showToast(message, isWarning) {
    adminToast.textContent = message;
    adminToast.classList.toggle('is-warning', !!isWarning);
    adminToast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => adminToast.classList.remove('is-visible'), 3500);
  }

  function openModal(modal, focusEl) {
    lastFocus = document.activeElement;
    modal.style.display = 'flex';
    setTimeout(() => focusEl && focusEl.focus(), 30);
  }

  function closeModal(modal) {
    modal.style.display = 'none';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function selectedKind() {
    const el = editorForm.querySelector('input[name="editorKind"]:checked');
    return el ? el.value : 'open';
  }

  function applyKind() {
    const isChoice = selectedKind() === 'choice';
    editorOptionsRow.hidden = !isChoice;
    editorGuideReq.style.display = isChoice ? 'none' : '';
  }

  function renderMathPreview() {
    const tex = editorMath.value.trim();
    if (!tex) { editorMathPreview.innerHTML = ''; return; }
    try {
      if (window.katex) katex.render(tex, editorMathPreview, { displayMode: true, throwOnError: false });
      else editorMathPreview.textContent = tex;
    } catch (e) {
      editorMathPreview.textContent = tex;
    }
  }

  function setEditorError(message, field) {
    editorForm.querySelectorAll('[aria-invalid="true"]').forEach(el => el.removeAttribute('aria-invalid'));
    editorError.textContent = message || '';
    editorError.style.display = message ? 'block' : 'none';
    if (field) {
      field.setAttribute('aria-invalid', 'true');
      field.focus();
    }
  }

  function isCurrentLocked(roundIndex, questionIndex) {
    return currentState &&
      currentState.currentRoundIndex === roundIndex &&
      currentState.currentQuestionIndex === questionIndex &&
      (currentState.questionState === 'running' || currentState.questionState === 'paused');
  }

  function openEditor(roundIndex, questionIndex) {
    if (!questionsData) return;
    const isNew = questionIndex === null;
    const q = isNew ? null : questionsData.rounds[roundIndex].questions[questionIndex];
    editing = { roundIndex, questionIndex };

    editorRound.innerHTML = questionsData.rounds.map((r, i) =>
      `<option value="${i}">${ROUND_LABELS[i] || r.name}</option>`).join('');
    editorRound.value = String(roundIndex);
    editorRound.disabled = !isNew;

    editorTitle.textContent = isNew ? 'Nueva pregunta' : `Editar ${q.title || 'pregunta'}`;
    editorEyebrow.textContent = isNew ? 'Banco de preguntas' : (ROUND_LABELS[roundIndex] || 'Banco de preguntas');

    editorStatement.value = q ? (q.statement || '') : '';
    editorMath.value = q ? (q.math || '') : '';
    editorCode.value = q ? (q.code || '') : '';
    editorGuide.value = q ? (q.answerGuide || '') : '';

    const hasOptions = !!(q && Array.isArray(q.options) && q.options.length);
    editorForm.querySelector(`input[name="editorKind"][value="${hasOptions ? 'choice' : 'open'}"]`).checked = true;
    LETTERS.forEach((letter, idx) => {
      $('editorOpt' + letter).value = hasOptions ? (q.options[idx] || '').replace(/^[A-D]\)\s*/, '') : '';
      $('editorCorrect' + letter).checked = hasOptions && String(q.correctOption || '').toUpperCase() === letter;
    });

    editorExtra.open = !!(editorMath.value || editorCode.value);
    applyKind();
    renderMathPreview();
    setEditorError('');
    btnSaveQuestion.disabled = false;
    btnSaveQuestion.textContent = isNew ? 'Crear pregunta' : 'Guardar cambios';
    openModal(editorModal, editorStatement);
  }

  function collectQuestion() {
    const isChoice = selectedKind() === 'choice';
    const question = {
      statement: editorStatement.value.trim(),
      math: editorMath.value.trim(),
      code: editorCode.value.replace(/\s+$/, ''),
      answerGuide: editorGuide.value.trim()
    };
    if (question.code) question.codeLang = 'cpp';

    if (question.statement.length < 3) return { error: 'Escribe el enunciado (mínimo 3 caracteres).', field: editorStatement };

    if (isChoice) {
      question.options = LETTERS.map(l => $('editorOpt' + l).value.trim());
      const emptyIdx = question.options.findIndex(o => !o);
      if (emptyIdx >= 0) return { error: `Completa la opción ${LETTERS[emptyIdx]}.`, field: $('editorOpt' + LETTERS[emptyIdx]) };
      const checked = editorForm.querySelector('input[name="editorCorrect"]:checked');
      if (!checked) return { error: 'Marca cuál opción es la correcta.', field: $('editorCorrectA') };
      question.correctOption = checked.value;
    } else {
      if (!question.answerGuide) return { error: 'Escribe la guía de respuesta para el juez.', field: editorGuide };
      const inlineMath = /\$[^$]+\$|\\\(|\\\[/.test(question.statement);
      question.type = question.code ? 'code' : ((question.math || inlineMath) ? 'math' : 'text');
    }
    return { question };
  }

  editorForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!editing) return;
    const result = collectQuestion();
    if (result.error) return setEditorError(result.error, result.field);
    setEditorError('');

    const isNew = editing.questionIndex === null;
    const roundIndex = isNew ? Number(editorRound.value) : editing.roundIndex;
    btnSaveQuestion.disabled = true;
    btnSaveQuestion.textContent = 'Guardando…';

    socket.timeout(6000).emit('admin_question_save', {
      adminPassword: currentAdminPassword,
      roundIndex,
      questionIndex: isNew ? null : editing.questionIndex,
      question: result.question
    }, (err, res) => {
      btnSaveQuestion.disabled = false;
      btnSaveQuestion.textContent = isNew ? 'Crear pregunta' : 'Guardar cambios';
      if (err) return setEditorError('El servidor no respondió. Revisa la conexión e inténtalo de nuevo.');
      if (!res || !res.ok) return setEditorError((res && res.error) || 'No se pudo guardar la pregunta.');
      closeModal(editorModal);
      editing = null;
      showToast(res.warning || (isNew ? `Pregunta creada en ${ROUND_LABELS[roundIndex] || 'la ronda'}.` : 'Cambios guardados.'), !!res.warning);
    });
  });

  editorForm.querySelectorAll('input[name="editorKind"]').forEach(el => el.addEventListener('change', applyKind));
  editorMath.addEventListener('input', renderMathPreview);
  $('btnCloseEditor').addEventListener('click', () => closeModal(editorModal));
  $('btnCancelEditor').addEventListener('click', () => closeModal(editorModal));

  $('btnNewQuestion').addEventListener('click', () => {
    openEditor(currentState ? currentState.currentRoundIndex : 0, null);
  });

  function editQuestionAt(i) {
    if (!questionsData || !currentState) return;
    const r = currentState.currentRoundIndex;
    if (!questionsData.rounds[r] || !questionsData.rounds[r].questions[i]) return;
    if (isCurrentLocked(r, i)) return showToast('Termina la pregunta en curso antes de editarla.', true);
    openEditor(r, i);
  }

  window.adminEditQuestion = editQuestionAt;
  window.adminDeleteQuestion = (i) => deleteQuestionAt(i);
  $('btnEditQuestion').addEventListener('click', () => currentState && editQuestionAt(currentState.currentQuestionIndex));
  $('btnDeleteQuestion').addEventListener('click', () => currentState && deleteQuestionAt(currentState.currentQuestionIndex));

  function deleteQuestionAt(i) {
    if (!questionsData || !currentState) return;
    const r = currentState.currentRoundIndex;
    const q = questionsData.rounds[r] && questionsData.rounds[r].questions[i];
    if (!q) return;
    if (isCurrentLocked(r, i)) return showToast('Termina la pregunta en curso antes de eliminarla.', true);
    editing = { roundIndex: r, questionIndex: i };
    const preview = q.statement.length > 90 ? q.statement.slice(0, 90) + '…' : q.statement;
    if (confirmResolver) settleConfirm(false);
    $('deleteTitle').textContent = '¿Eliminar pregunta?';
    btnConfirmDelete.textContent = 'Sí, eliminar';
    btnConfirmDelete.classList.add('btn-danger');
    btnConfirmDelete.classList.remove('btn-glow-blue');
    deleteDesc.textContent = `${q.title} de ${ROUND_LABELS[r] || 'la ronda'}: "${preview}". Esta acción no se puede deshacer.`;
    deleteError.style.display = 'none';
    btnConfirmDelete.disabled = false;
    openModal(deleteModal, $('btnCancelDelete'));
  }

  // Confirmación genérica reutilizando el modal de borrado
  let confirmResolver = null;
  function appConfirm({ title, message, confirmLabel, danger = true }) {
    if (confirmResolver) confirmResolver(false);
    $('deleteTitle').textContent = title;
    deleteDesc.textContent = message;
    btnConfirmDelete.textContent = confirmLabel;
    btnConfirmDelete.classList.toggle('btn-danger', danger);
    btnConfirmDelete.classList.toggle('btn-glow-blue', !danger);
    btnConfirmDelete.disabled = false;
    deleteError.style.display = 'none';
    openModal(deleteModal, $('btnCancelDelete'));
    return new Promise(resolve => { confirmResolver = resolve; });
  }

  function settleConfirm(result) {
    if (!confirmResolver) return false;
    const resolve = confirmResolver;
    confirmResolver = null;
    closeModal(deleteModal);
    resolve(result);
    return true;
  }

  $('btnCancelDelete').addEventListener('click', () => {
    if (!settleConfirm(false)) closeModal(deleteModal);
  });

  btnConfirmDelete.addEventListener('click', () => {
    if (settleConfirm(true)) return;
    if (!editing) return;
    btnConfirmDelete.disabled = true;
    socket.timeout(6000).emit('admin_question_delete', {
      adminPassword: currentAdminPassword,
      roundIndex: editing.roundIndex,
      questionIndex: editing.questionIndex
    }, (err, res) => {
      btnConfirmDelete.disabled = false;
      if (err || !res || !res.ok) {
        deleteError.textContent = err ? 'El servidor no respondió. Inténtalo de nuevo.' : ((res && res.error) || 'No se pudo eliminar.');
        deleteError.style.display = 'block';
        return;
      }
      closeModal(deleteModal);
      editing = null;
      showToast(res.warning || 'Pregunta eliminada.', !!res.warning);
    });
  });

  // Escape cierra el modal abierto
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (deleteModal.style.display === 'flex') { if (!settleConfirm(false)) closeModal(deleteModal); }
    else if (editorModal.style.display === 'flex') closeModal(editorModal);
  });

  // Solo con la pregunta seleccionada fuera de curso se puede editar/eliminar
  if (window.Icons) {
    $('plusIconSlot').innerHTML = Icons.plus('w-4 h-4');
    $('editIconSlot').innerHTML = Icons.pencil('w-4 h-4');
    $('trashIconSlot').innerHTML = Icons.trash('w-4 h-4');
  }
  const btnEditQuestion = $('btnEditQuestion');
  const btnDeleteQuestion = $('btnDeleteQuestion');
  function syncEditorButtons(state) {
    const locked = isCurrentLocked(state.currentRoundIndex, state.currentQuestionIndex);
    btnEditQuestion.disabled = locked || !questionsData;
    btnDeleteQuestion.disabled = locked || !questionsData;
    const title = locked ? 'Termina la pregunta en curso para modificarla' : '';
    btnEditQuestion.title = title;
    btnDeleteQuestion.title = title;
  }
  socket.on('state_update', syncEditorButtons);
  socket.on('questions_data', () => syncEditorButtons(currentState));
  syncEditorButtons(currentState);
  window.addEventListener('load', () => updatePreview());
});
