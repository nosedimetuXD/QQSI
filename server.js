const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Load questions bank
const questionsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'questions.json'), 'utf8'));

// Initial default teams
const DEFAULT_TEAMS = [
  { id: 'sistemas', name: 'Ingeniería de Sistemas', shortName: 'Sistemas', color: '#0284c7', eliminated: false, score: 0, eliminatedInRound: null },
  { id: 'alimentos', name: 'Ingeniería de Alimentos', shortName: 'Alimentos', color: '#16a34a', eliminated: false, score: 0, eliminatedInRound: null },
  { id: 'quimica', name: 'Ingeniería Química', shortName: 'Química', color: '#9333ea', eliminated: false, score: 0, eliminatedInRound: null },
  { id: 'civil', name: 'Ingeniería Civil', shortName: 'Civil', color: '#ea580c', eliminated: false, score: 0, eliminatedInRound: null },
  { id: 'petroquimica', name: 'Téc. Procesos Petroquímicos', shortName: 'Petroquímica', color: '#0d9488', eliminated: false, score: 0, eliminatedInRound: null }
];

// Master Game State
let gameState = {
  teams: JSON.parse(JSON.stringify(DEFAULT_TEAMS)),
  currentRoundIndex: 0, // 0: Fácil, 1: Normal, 2: Difícil, 3: Experto
  currentQuestionIndex: 0,
  questionState: 'idle', // 'idle' | 'running' | 'paused' | 'ended' | 'evaluated'
  timer: {
    duration: 120,
    remaining: 120,
    isRunning: false,
    startTime: null,
    endTime: null
  },
  currentQuestion: null,
  submissions: [], // Array of { teamId, teamName, submittedAt, elapsedMs, correct: boolean | null, basePoints: 0, bonusPoints: 0, totalPoints: 0 }
  roundScores: {}, // { teamId: pointsInCurrentRound }
  history: [],
  roundSummary: null
};

// Initialize round scores
function initRoundScores() {
  gameState.roundScores = {};
  gameState.teams.forEach(t => {
    if (!t.eliminated) {
      gameState.roundScores[t.id] = 0;
      t.score = 0; // Reset accumulated score for current round per rules
    }
  });
}
initRoundScores();

// Timer Interval Handler
let timerInterval = null;

function broadcastState() {
  io.emit('state_update', gameState);
}

function startTimer(durationSeconds) {
  if (timerInterval) clearInterval(timerInterval);
  
  gameState.timer.duration = durationSeconds;
  gameState.timer.remaining = durationSeconds;
  gameState.timer.isRunning = true;
  gameState.timer.startTime = Date.now();
  gameState.timer.endTime = Date.now() + durationSeconds * 1000;
  gameState.questionState = 'running';
  
  broadcastState();

  timerInterval = setInterval(() => {
    if (!gameState.timer.isRunning) return;

    const now = Date.now();
    const remainingMs = Math.max(0, gameState.timer.endTime - now);
    const remainingSec = Math.ceil(remainingMs / 1000);
    
    gameState.timer.remaining = remainingSec;
    
    io.emit('timer_tick', {
      remaining: remainingSec,
      duration: gameState.timer.duration
    });

    if (remainingSec <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      gameState.timer.isRunning = false;
      gameState.timer.remaining = 0;
      gameState.questionState = 'ended';
      io.emit('question_time_up');
      broadcastState();
    }
  }, 500);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  gameState.timer.isRunning = false;
  gameState.questionState = 'ended';
  broadcastState();
}

function pauseTimer() {
  if (!gameState.timer.isRunning) return;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  gameState.timer.isRunning = false;
  gameState.questionState = 'paused';
  broadcastState();
}

function resumeTimer() {
  if (gameState.timer.remaining <= 0) return;
  startTimer(gameState.timer.remaining);
}

// Calculate bonuses dynamically: 
// 1st correct gets +5, 2nd correct gets +3, 3rd correct gets +1
function recalculateScores() {
  let correctRank = 0;
  
  // Iterate submissions in the exact chronological order of arrival
  for (let sub of gameState.submissions) {
    if (sub.correct === true) {
      sub.basePoints = 10;
      correctRank++;
      if (correctRank === 1) sub.bonusPoints = 5;
      else if (correctRank === 2) sub.bonusPoints = 3;
      else if (correctRank === 3) sub.bonusPoints = 1;
      else sub.bonusPoints = 0;
      sub.totalPoints = sub.basePoints + sub.bonusPoints;
    } else {
      sub.basePoints = 0;
      sub.bonusPoints = 0;
      sub.totalPoints = 0;
    }
  }
}

// Check if all active non-eliminated teams have submitted
function checkAllActiveSubmitted() {
  const activeTeams = gameState.teams.filter(t => !t.eliminated);
  const submittedTeamIds = new Set(gameState.submissions.map(s => s.teamId));
  const allDone = activeTeams.every(t => submittedTeamIds.has(t.id));
  
  if (allDone && gameState.questionState === 'running') {
    stopTimer();
    io.emit('all_teams_submitted');
  }
}

// Socket connection handling
io.on('connection', (socket) => {
  // Send current state on connection
  socket.emit('state_update', gameState);
  socket.emit('questions_data', questionsData);

  // --- ADMIN ACTIONS ---
  socket.on('admin_select_round', ({ roundIndex }) => {
    if (roundIndex >= 0 && roundIndex < questionsData.rounds.length) {
      gameState.currentRoundIndex = roundIndex;
      gameState.currentQuestionIndex = 0;
      gameState.questionState = 'idle';
      gameState.submissions = [];
      gameState.currentQuestion = questionsData.rounds[roundIndex].questions[0] || null;
      gameState.timer.duration = questionsData.rounds[roundIndex].timeLimit;
      gameState.timer.remaining = gameState.timer.duration;
      initRoundScores();
      broadcastState();
    }
  });

  socket.on('admin_select_question', ({ roundIndex, questionIndex }) => {
    const round = questionsData.rounds[roundIndex];
    if (round && round.questions[questionIndex]) {
      gameState.currentRoundIndex = roundIndex;
      gameState.currentQuestionIndex = questionIndex;
      gameState.currentQuestion = round.questions[questionIndex];
      gameState.questionState = 'idle';
      gameState.submissions = [];
      gameState.timer.duration = round.timeLimit;
      gameState.timer.remaining = round.timeLimit;
      broadcastState();
    }
  });

  socket.on('admin_start_question', () => {
    const round = questionsData.rounds[gameState.currentRoundIndex];
    if (!round) return;
    const question = round.questions[gameState.currentQuestionIndex];
    if (!question) return;

    gameState.currentQuestion = question;
    gameState.submissions = [];
    startTimer(round.timeLimit);
  });

  socket.on('admin_pause_timer', () => {
    pauseTimer();
  });

  socket.on('admin_resume_timer', () => {
    resumeTimer();
  });

  socket.on('admin_stop_question', () => {
    stopTimer();
  });

  socket.on('admin_evaluate_submission', ({ teamId, isCorrect }) => {
    const sub = gameState.submissions.find(s => s.teamId === teamId);
    if (sub) {
      sub.correct = isCorrect;
      recalculateScores();
      broadcastState();
    }
  });

  socket.on('admin_confirm_and_apply_points', () => {
    recalculateScores();
    // Add points to current round scores
    for (let sub of gameState.submissions) {
      if (gameState.roundScores[sub.teamId] !== undefined) {
        gameState.roundScores[sub.teamId] += sub.totalPoints;
      }
      const team = gameState.teams.find(t => t.id === sub.teamId);
      if (team) {
        team.score = gameState.roundScores[sub.teamId];
      }
    }

    // Save in history
    gameState.history.push({
      roundIndex: gameState.currentRoundIndex,
      roundName: questionsData.rounds[gameState.currentRoundIndex].name,
      questionIndex: gameState.currentQuestionIndex,
      questionTitle: gameState.currentQuestion.title,
      submissions: JSON.parse(JSON.stringify(gameState.submissions)),
      roundScores: JSON.parse(JSON.stringify(gameState.roundScores))
    });

    gameState.questionState = 'evaluated';
    broadcastState();
  });

  socket.on('admin_eliminate_team', ({ teamId }) => {
    const team = gameState.teams.find(t => t.id === teamId);
    if (team) {
      team.eliminated = true;
      team.eliminatedInRound = gameState.currentRoundIndex + 1;
      broadcastState();
      io.emit('team_eliminated_announcement', {
        team,
        roundIndex: gameState.currentRoundIndex,
        roundName: questionsData.rounds[gameState.currentRoundIndex].name
      });
    }
  });

  socket.on('admin_next_round', () => {
    if (gameState.currentRoundIndex < questionsData.rounds.length - 1) {
      gameState.currentRoundIndex++;
      gameState.currentQuestionIndex = 0;
      gameState.questionState = 'idle';
      gameState.submissions = [];
      const round = questionsData.rounds[gameState.currentRoundIndex];
      gameState.currentQuestion = round.questions[0] || null;
      gameState.timer.duration = round.timeLimit;
      gameState.timer.remaining = round.timeLimit;
      initRoundScores();
      broadcastState();
    }
  });

  socket.on('admin_reset_game', () => {
    gameState.teams = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
    gameState.currentRoundIndex = 0;
    gameState.currentQuestionIndex = 0;
    gameState.questionState = 'idle';
    gameState.submissions = [];
    gameState.currentQuestion = questionsData.rounds[0].questions[0] || null;
    gameState.timer.duration = questionsData.rounds[0].timeLimit;
    gameState.timer.remaining = questionsData.rounds[0].timeLimit;
    gameState.history = [];
    initRoundScores();
    broadcastState();
  });

  // --- TEAM ACTIONS ---
  socket.on('team_submit', ({ teamId }) => {
    if (gameState.questionState !== 'running') return;
    
    const team = gameState.teams.find(t => t.id === teamId);
    if (!team || team.eliminated) return;

    // Check if team already submitted
    const alreadySubmitted = gameState.submissions.some(s => s.teamId === teamId);
    if (alreadySubmitted) return;

    const submittedAt = Date.now();
    const elapsedMs = gameState.timer.startTime ? (submittedAt - gameState.timer.startTime) : 0;

    const submissionEntry = {
      teamId: team.id,
      teamName: team.name,
      shortName: team.shortName,
      color: team.color,
      submittedAt,
      elapsedMs,
      elapsedSec: Math.floor(elapsedMs / 1000),
      order: gameState.submissions.length + 1,
      correct: null,
      basePoints: 0,
      bonusPoints: 0,
      totalPoints: 0
    };

    gameState.submissions.push(submissionEntry);
    
    // Notify team specifically of successful receipt
    socket.emit('submission_confirmed', {
      order: submissionEntry.order,
      elapsedMs: submissionEntry.elapsedMs
    });

    broadcastState();
    checkAllActiveSubmitted();
  });
});

// API endpoint for raw questions data
app.get('/api/questions', (req, res) => {
  res.json(questionsData);
});

// Helper function to get local IPv4
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (let dev in interfaces) {
    for (let details of interfaces[dev]) {
      if (details.family === 'IPv4' && !details.internal) {
        return details.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIp();

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` ¿QUIÉN QUIERE SER INGENIERO? - SERVIDOR EN TIEMPO REAL`);
  console.log(`=======================================================`);
  console.log(` Local:      http://localhost:${PORT}`);
  console.log(` Red Local:  http://${localIp}:${PORT}`);
  console.log(`-------------------------------------------------------`);
  console.log(` Proyección: http://${localIp}:${PORT}/display.html`);
  console.log(` Equipos:    http://${localIp}:${PORT}/team.html`);
  console.log(` Admin:      http://${localIp}:${PORT}/admin.html`);
  console.log(`=======================================================`);
});
