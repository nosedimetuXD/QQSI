// Team Client JavaScript — Secure Server-Side Auth & Arcade Buzzer
document.addEventListener('DOMContentLoaded', () => {
  const socket = window.QQSI_CONFIG ? window.QQSI_CONFIG.getSocket() : io();

  const DEFAULT_TEAMS = [
    { id: 'sistemas', name: 'Ingeniería de Sistemas', shortName: 'Sistemas', color: '#0284c7', eliminated: false },
    { id: 'alimentos', name: 'Ingeniería de Alimentos', shortName: 'Alimentos', color: '#16a34a', eliminated: false },
    { id: 'quimica', name: 'Ingeniería Química', shortName: 'Química', color: '#9333ea', eliminated: false },
    { id: 'civil', name: 'Ingeniería Civil', shortName: 'Civil', color: '#ea580c', eliminated: false },
    { id: 'petroquimica', name: 'Téc. Procesos Petroquímicos', shortName: 'Petroquímica', color: '#0d9488', eliminated: false }
  ];

  // Auth Modal Elements
  const teamAuthModal = document.getElementById('teamAuthModal');
  const teamAuthForm = document.getElementById('teamAuthForm');
  const modalTeamName = document.getElementById('modalTeamName');
  const inputTeamPassword = document.getElementById('inputTeamPassword');
  const teamAuthError = document.getElementById('teamAuthError');
  const btnCancelTeamAuth = document.getElementById('btnCancelTeamAuth');

  // Dashboard Elements
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
  if (teamTimerIconSlot && window.Icons) teamTimerIconSlot.innerHTML = Icons.timer("w-4 h-4");
  if (buzzerIconSlot && window.Icons) buzzerIconSlot.innerHTML = Icons.send("w-8 h-8");
  if (checkIconSlot && window.Icons) checkIconSlot.innerHTML = Icons.check("w-5 h-5");
  if (eliminatedIconSlot && window.Icons) eliminatedIconSlot.innerHTML = Icons.cross("w-6 h-6");

  let selectedTeamId = localStorage.getItem('qqsi_selected_team') || null;
  let savedTeamPassword = localStorage.getItem('qqsi_team_password') || null;
  let pendingTeamId = null;
  
  let currentState = {
    teams: DEFAULT_TEAMS,
    currentRoundIndex: 0,
    currentQuestionIndex: 0,
    questionState: 'idle',
    currentQuestion: null,
    submissions: []
  };

  function hapticFeedback() {
    if (navigator.vibrate) {
      try { navigator.vibrate([100, 50, 100]); } catch (e) {}
    }
  }

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
    if (teamTimerText) teamTimerText.textContent = formatTime(remaining);
  });

  socket.on('team_login_success', ({ teamId }) => {
    selectedTeamId = teamId;
    localStorage.setItem('qqsi_selected_team', teamId);
    if (pendingTeamId) {
      localStorage.setItem('qqsi_team_password', inputTeamPassword.value.trim());
    }
    teamAuthModal.style.display = 'none';
    pendingTeamId = null;
    inputTeamPassword.value = '';
    updateView();
  });

  socket.on('team_login_error', (data) => {
    teamAuthError.textContent = (data && data.error) || 'Contraseña incorrecta.';
    teamAuthError.style.display = 'block';
  });

  socket.on('submission_confirmed', ({ order, elapsedMs }) => {
    hapticFeedback();
    btnSubmitAnswer.disabled = true;
    btnSubmitAnswer.classList.remove('pulsing');
    deliveryStatusBox.style.display = 'block';
    deliveryOrderText.textContent = `¡Entregado en posición ${order}º!`;
    deliveryTimeText.textContent = `Tiempo registrado: ${(elapsedMs / 1000).toFixed(1)} segundos`;
  });

  // Check saved session on load
  if (selectedTeamId && savedTeamPassword) {
    socket.emit('team_login', { teamId: selectedTeamId, password: savedTeamPassword });
  }

  // Initial View Update
  updateView();

  function updateView() {
    const teams = currentState.teams || DEFAULT_TEAMS;
    const currentTeam = teams.find(t => t.id === selectedTeamId);

    if (currentState.timer && teamTimerText) {
      teamTimerText.textContent = formatTime(currentState.timer.remaining);
    }

    if (!selectedTeamId || !currentTeam) {
      teamSelectScreen.style.display = 'block';
      teamDashboardScreen.style.display = 'none';
      eliminatedScreen.style.display = 'none';
      teamHeaderName.textContent = "Seleccionar Carrera";
      renderTeamsList(teams);
      return;
    }

    if (currentTeam.eliminated) {
      teamSelectScreen.style.display = 'none';
      teamDashboardScreen.style.display = 'none';
      eliminatedScreen.style.display = 'block';
      teamHeaderName.textContent = `${currentTeam.shortName} (Eliminado)`;
      return;
    }

    teamSelectScreen.style.display = 'none';
    teamDashboardScreen.style.display = 'flex';
    eliminatedScreen.style.display = 'none';
    teamHeaderName.textContent = currentTeam.shortName;

    activeTeamName.textContent = currentTeam.name;
    activeTeamColorDot.style.backgroundColor = currentTeam.color;

    const roundNames = ['Ronda 1: Nivel Fácil', 'Ronda 2: Nivel Normal', 'Ronda 3: Nivel Difícil', 'Ronda 4: Nivel Experto'];
    activeTeamRoundBadge.textContent = roundNames[currentState.currentRoundIndex] || `Ronda ${currentState.currentRoundIndex + 1}`;

    const q = currentState.currentQuestion;
    if (q) {
      teamQuestionBanner.textContent = q.title || `Pregunta ${(currentState.currentQuestionIndex || 0) + 1}`;
      teamQuestionStatement.textContent = q.statement || 'Pregunta en curso';

      if (q.math) {
        teamQuestionMath.style.display = 'block';
        try {
          if (window.katex) {
            katex.render(q.math, teamQuestionMath, { displayMode: true, throwOnError: false });
          } else {
            teamQuestionMath.textContent = q.math;
          }
        } catch (e) {
          teamQuestionMath.textContent = q.math;
        }
      } else {
        teamQuestionMath.style.display = 'none';
      }
    } else {
      teamQuestionBanner.textContent = "Sin Pregunta Activa";
      teamQuestionStatement.textContent = "Esperando que el moderador inicie la pregunta...";
      teamQuestionMath.style.display = 'none';
    }

    const alreadySubmitted = (currentState.submissions || []).find(s => s.teamId === selectedTeamId);
    if (alreadySubmitted) {
      btnSubmitAnswer.disabled = true;
      btnSubmitAnswer.classList.remove('pulsing');
      deliveryStatusBox.style.display = 'block';
      deliveryOrderText.textContent = `¡Entregado en posición ${alreadySubmitted.order || 1}º!`;
      deliveryTimeText.textContent = `Tiempo registrado: ${(alreadySubmitted.elapsedMs / 1000).toFixed(1)} segundos`;
    } else if (currentState.questionState === 'running') {
      btnSubmitAnswer.disabled = false;
      btnSubmitAnswer.classList.add('pulsing');
      deliveryStatusBox.style.display = 'none';
    } else {
      btnSubmitAnswer.disabled = true;
      btnSubmitAnswer.classList.remove('pulsing');
      deliveryStatusBox.style.display = 'none';
    }
  }

  function renderTeamsList(teams) {
    teamsListContainer.innerHTML = teams.map(team => {
      const isEliminated = team.eliminated;
      return `
        <button 
          type="button"
          onclick="window.selectTeamAuth('${team.id}')"
          ${isEliminated ? 'disabled' : ''}
          style="width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-radius: 16px; transition: all 0.2s ease; cursor: ${isEliminated ? 'not-allowed' : 'pointer'}; ${
            isEliminated 
              ? 'background: rgba(4, 12, 24, 0.4); opacity: 0.4; border: 1px solid rgba(255,255,255,0.08);' 
              : 'background: rgba(8, 20, 36, 0.9); border: 1.5px solid rgba(255, 255, 255, 0.15); box-shadow: 0 4px 12px rgba(0,0,0,0.3);'
          }">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 16px; height: 16px; border-radius: 9999px; background-color: ${team.color}; flex-shrink: 0;"></div>
            <span style="font-size: 15px; font-weight: 800; color: #ffffff; text-align: left;">${team.name}</span>
          </div>
          <span style="font-size: 12px; font-weight: 800; color: #38bdf8;">${isEliminated ? 'Eliminado' : 'Ingresar →'}</span>
        </button>
      `;
    }).join('');
  }

  window.selectTeamAuth = (teamId) => {
    const teams = currentState.teams || DEFAULT_TEAMS;
    const team = teams.find(t => t.id === teamId);
    if (!team || team.eliminated) return;

    pendingTeamId = teamId;
    modalTeamName.textContent = team.name;
    teamAuthError.style.display = 'none';
    inputTeamPassword.value = '';
    teamAuthModal.style.display = 'flex';
    setTimeout(() => inputTeamPassword.focus(), 100);
  };

  teamAuthForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pwd = inputTeamPassword.value.trim();
    if (!pendingTeamId || !pwd) return;

    socket.emit('team_login', { teamId: pendingTeamId, password: pwd });
  });

  btnCancelTeamAuth.addEventListener('click', () => {
    teamAuthModal.style.display = 'none';
    pendingTeamId = null;
    inputTeamPassword.value = '';
  });

  btnChangeTeam.addEventListener('click', () => {
    localStorage.removeItem('qqsi_selected_team');
    localStorage.removeItem('qqsi_team_password');
    selectedTeamId = null;
    updateView();
  });

  btnSubmitAnswer.addEventListener('click', () => {
    if (!selectedTeamId || currentState.questionState !== 'running') return;
    hapticFeedback();
    socket.emit('submit_answer', { teamId: selectedTeamId });
  });
});
