// Team Client JavaScript with Immediate Local Fallback & Robust Password Authentication
document.addEventListener('DOMContentLoaded', () => {
  const socket = window.QQSI_CONFIG ? window.QQSI_CONFIG.getSocket() : io();

  const DEFAULT_TEAMS = [
    { id: 'sistemas', name: 'Ingeniería de Sistemas', shortName: 'Sistemas', color: '#0284c7', eliminated: false },
    { id: 'alimentos', name: 'Ingeniería de Alimentos', shortName: 'Alimentos', color: '#16a34a', eliminated: false },
    { id: 'quimica', name: 'Ingeniería Química', shortName: 'Química', color: '#9333ea', eliminated: false },
    { id: 'civil', name: 'Ingeniería Civil', shortName: 'Civil', color: '#ea580c', eliminated: false },
    { id: 'petroquimica', name: 'Téc. Procesos Petroquímicos', shortName: 'Petroquímica', color: '#0d9488', eliminated: false }
  ];

  const TEAM_PASSWORDS = {
    sistemas: ['Sistemas2026*'],
    alimentos: ['Alimentos2026*'],
    quimica: ['Quimica2026*', 'Química2026*'],
    civil: ['Civil2026*'],
    petroquimica: ['Petroquimica2026*', 'Petroquímica2026*', 'ProcesosPetroquimicos2026*']
  };

  function checkTeamPassword(teamId, pwd) {
    if (!teamId || !pwd) return false;
    const valid = TEAM_PASSWORDS[teamId];
    if (!valid) return false;
    return valid.some(v => v.toLowerCase() === pwd.trim().toLowerCase());
  }

  // Auth Modal Elements
  const teamAuthModal = document.getElementById('teamAuthModal');
  const teamAuthForm = document.getElementById('teamAuthForm');
  const modalTeamName = document.getElementById('modalTeamName');
  const inputTeamPassword = document.getElementById('inputTeamPassword');
  const teamAuthError = document.getElementById('teamAuthError');
  const btnCancelTeamAuth = document.getElementById('btnCancelTeamAuth');
  const modalTeamShieldIcon = document.getElementById('modalTeamShieldIcon');

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
  if (modalTeamShieldIcon && window.Icons) modalTeamShieldIcon.innerHTML = Icons.shield("w-6 h-6");
  if (teamTimerIconSlot && window.Icons) teamTimerIconSlot.innerHTML = Icons.timer("w-3.5 h-3.5");
  if (buzzerIconSlot && window.Icons) buzzerIconSlot.innerHTML = Icons.send("w-7 h-7");
  if (checkIconSlot && window.Icons) checkIconSlot.innerHTML = Icons.check("w-5 h-5");
  if (eliminatedIconSlot && window.Icons) eliminatedIconSlot.innerHTML = Icons.cross("w-6 h-6");

  let selectedTeamId = localStorage.getItem('qqsi_selected_team') || null;
  let savedTeamPassword = localStorage.getItem('qqsi_team_password') || null;
  let pendingTeamId = null;
  
  // Initial default state so screen is NEVER blank
  let currentState = {
    teams: DEFAULT_TEAMS,
    currentRoundIndex: 0,
    currentQuestionIndex: 0,
    questionState: 'idle',
    currentQuestion: null,
    submissions: []
  };

  // Haptic feedback
  function hapticAndChime() {
    if (navigator.vibrate) {
      navigator.vibrate([80, 40, 80]);
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
    teamTimerText.textContent = formatTime(remaining);
  });

  socket.on('submission_confirmed', ({ order, elapsedMs }) => {
    hapticAndChime();
    const sec = Math.floor(elapsedMs / 1000);
    const formatted = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    deliveryOrderText.textContent = `#${order}`;
    deliveryTimeText.textContent = formatted;
  });

  socket.on('team_auth_error', ({ error }) => {
    alert(error || 'Error de autenticación de equipo');
    btnSubmitAnswer.disabled = false;
  });

  // Open Auth Modal for Team
  function openTeamAuth(teamId) {
    pendingTeamId = teamId;
    const team = (currentState.teams || DEFAULT_TEAMS).find(t => t.id === teamId);
    modalTeamName.textContent = team ? team.name : 'Equipo';
    inputTeamPassword.value = '';
    teamAuthError.classList.add('hidden');
    teamAuthModal.classList.remove('hidden');
    inputTeamPassword.focus();
  }

  btnCancelTeamAuth.addEventListener('click', () => {
    pendingTeamId = null;
    teamAuthModal.classList.add('hidden');
  });

  teamAuthForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!pendingTeamId) return;

    const pwd = inputTeamPassword.value ? inputTeamPassword.value.trim() : '';
    teamAuthError.classList.add('hidden');

    if (checkTeamPassword(pendingTeamId, pwd)) {
      selectedTeamId = pendingTeamId;
      savedTeamPassword = pwd;
      localStorage.setItem('qqsi_selected_team', selectedTeamId);
      localStorage.setItem('qqsi_team_password', savedTeamPassword);
      teamAuthModal.classList.add('hidden');
      pendingTeamId = null;
      socket.emit('team_login', { teamId: selectedTeamId, password: pwd });
      updateView();
    } else {
      teamAuthError.textContent = 'Contraseña incorrecta para esta carrera';
      teamAuthError.classList.remove('hidden');
    }
  });

  btnChangeTeam.addEventListener('click', () => {
    selectedTeamId = null;
    savedTeamPassword = null;
    localStorage.removeItem('qqsi_selected_team');
    localStorage.removeItem('qqsi_team_password');
    updateView();
  });

  // Submit Answer Button Handler
  btnSubmitAnswer.addEventListener('click', () => {
    if (!selectedTeamId) return;
    if (currentState.questionState !== 'running') return;

    btnSubmitAnswer.disabled = true;
    hapticAndChime();
    socket.emit('team_submit', { 
      teamId: selectedTeamId,
      password: savedTeamPassword
    });
  });

  function updateView() {
    const roundNames = ["Ronda 1: Nivel Fácil", "Ronda 2: Nivel Normal", "Ronda 3: Nivel Difícil", "Ronda 4: Nivel Experto"];
    const roundName = roundNames[currentState.currentRoundIndex || 0] || `Ronda ${(currentState.currentRoundIndex || 0) + 1}`;

    const teams = currentState.teams || DEFAULT_TEAMS;

    // Render team list on selection screen
    teamsListContainer.innerHTML = teams.map(team => {
      const isEliminated = team.eliminated;
      return `
        <button 
          onclick="window.openTeamAuthModal('${team.id}')"
          ${isEliminated ? 'disabled' : ''}
          class="w-full p-3.5 rounded-xl border flex items-center justify-between text-left transition-all ${
            isEliminated 
              ? 'bg-slate-950/60 border-slate-800 opacity-40 cursor-not-allowed text-slate-500' 
              : 'bg-slate-950/90 hover:bg-slate-900 border-slate-700 text-white shadow-md active:scale-98'
          }">
          <div class="flex items-center gap-3">
            <div class="w-3.5 h-3.5 rounded-full shadow" style="background-color: ${team.color}"></div>
            <span class="font-bold text-sm leading-tight">${team.name}</span>
          </div>
          ${isEliminated ? '<span class="text-[10px] font-black uppercase text-red-400">Eliminado</span>' : Icons.chevronRight("w-4 h-4 text-cyan-400")}
        </button>
      `;
    }).join('');

    window.openTeamAuthModal = openTeamAuth;

    // Check if team is authenticated
    const team = teams.find(t => t.id === selectedTeamId);

    if (!team || !savedTeamPassword || !checkTeamPassword(selectedTeamId, savedTeamPassword)) {
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
    const submissions = currentState.submissions || [];
    const submission = submissions.find(s => s.teamId === team.id);

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

  // Initial render so the team list is displayed IMMEDIATELY on load!
  updateView();
});
