require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const os = require('os');
const validator = require('./utils/validator');

const app = express();
const server = http.createServer(app);

// Environment Configuration
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'production';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'LinoTeto';

const TEAM_PASSWORDS = {
  sistemas: [process.env.PASSWORD_SISTEMAS || 'Sistemas2026*'],
  software: [process.env.PASSWORD_SOFTWARE || 'Software2026*'],
  alimentos: [process.env.PASSWORD_ALIMENTOS || 'Alimentos2026*'],
  quimica: [process.env.PASSWORD_QUIMICA || 'Quimica2026*', 'Química2026*'],
  civil: [process.env.PASSWORD_CIVIL || 'Civil2026*'],
  petroquimica: [process.env.PASSWORD_PETROQUIMICA || 'Petroquimica2026*', 'Petroquímica2026*']
};

// Configurable Allowed Origins for CORS
const rawAllowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim().replace(/\/$/, ''))
  : ['*'];

const isWildcardCors = rawAllowedOrigins.includes('*');

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || isWildcardCors || rawAllowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Allow localhost variants in development
      if (NODE_ENV !== 'production' && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive fallback for seamless Vercel <-> Coolify preview branches
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Comprehensive Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Páginas HTML con versión en los JS/CSS locales (?v=...): cada arranque del servidor
// cambia la versión, así ningún navegador reutiliza archivos viejos tras una actualización.
const ASSET_VERSION = Date.now().toString(36);
const PAGE_ROUTES = { '/': 'index.html', '/index.html': 'index.html', '/admin.html': 'admin.html', '/display.html': 'display.html', '/team.html': 'team.html' };
app.get(Object.keys(PAGE_ROUTES), (req, res, next) => {
  fs.readFile(path.join(__dirname, 'public', PAGE_ROUTES[req.path]), 'utf8', (err, html) => {
    if (err) return next();
    const versioned = html.replace(/((?:src|href)=")(\/(?:js|css)\/[^"?#]+\.(?:js|css))"/g, `$1$2?v=${ASSET_VERSION}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(versioned);
  });
});

// Serve Static Assets with Cache Control
// HTML/JS/CSS siempre se revalidan (ETag) para que una actualización se vea al recargar;
// solo las imágenes y fuentes se guardan en caché.
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: NODE_ENV === 'production' ? '1h' : '0',
  setHeaders: (res, filePath) => {
    if (/\.(html|js|css|json)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));
app.use(express.json({ limit: '100kb' }));

// Healthcheck / Config API
app.get('/api/config', (req, res) => {
  res.json({
    status: 'ok',
    backendUrl: (process.env.BACKEND_URL || '').trim().replace(/\/$/, '')
  });
});

// Load Questions Bank with Error Handling
// QUESTIONS_FILE permite apuntar a otro archivo (las pruebas usan una copia temporal)
const QUESTIONS_FILE = process.env.QUESTIONS_FILE
  ? path.resolve(process.env.QUESTIONS_FILE)
  : path.join(__dirname, 'data', 'questions.json');

let questionsData = { rounds: [] };
try {
  // Volumen persistente vacío (p. ej. Coolify): se siembra con el banco incluido en la imagen
  const bundledFile = path.join(__dirname, 'data', 'questions.json');
  if (!fs.existsSync(QUESTIONS_FILE) && QUESTIONS_FILE !== bundledFile && fs.existsSync(bundledFile)) {
    fs.mkdirSync(path.dirname(QUESTIONS_FILE), { recursive: true });
    fs.copyFileSync(bundledFile, QUESTIONS_FILE);
    console.log(`[QQSI Server] Banco inicial copiado a ${QUESTIONS_FILE}`);
  }
  if (fs.existsSync(QUESTIONS_FILE)) {
    questionsData = JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf8'));
  }
} catch (err) {
  console.error('[QQSI Server] Error cargando banco de preguntas:', err.message);
}

// Guardado atómico del banco (escribe a un temporal y lo renombra)
function saveQuestions() {
  try {
    const tmp = QUESTIONS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(questionsData, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, QUESTIONS_FILE);
    return true;
  } catch (err) {
    console.error('[QQSI Server] Error guardando banco de preguntas:', err.message);
    return false;
  }
}

// Texto multilínea: conserva saltos de línea y tabulaciones (código), quita otros controles
function cleanText(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLen);
}

const QUESTION_TYPES = ['text', 'math', 'code', 'multiple_choice'];

// Valida y normaliza una pregunta enviada desde el editor del moderador
function sanitizeQuestion(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'Datos de pregunta inválidos.' };

  const statement = cleanText(raw.statement, 600);
  if (statement.length < 3) return { error: 'El enunciado es obligatorio (mínimo 3 caracteres).' };

  const q = { statement };
  const math = cleanText(raw.math, 400);
  const code = cleanText(raw.code, 2000);
  const answerGuide = cleanText(raw.answerGuide, 800);
  if (math) q.math = math;
  if (code) {
    q.code = code;
    q.codeLang = /^[a-z+#]{1,12}$/i.test(raw.codeLang || '') ? String(raw.codeLang).toLowerCase() : 'cpp';
  }

  // Sin prefijo "A) ": la letra la pone cada pantalla
  const rawOptions = Array.isArray(raw.options) ? raw.options.slice(0, 4).map(o => cleanText(o, 200).replace(/^[A-D]\)\s*/, '')) : [];
  const hasOptions = rawOptions.some(Boolean);
  if (hasOptions) {
    if (rawOptions.length !== 4 || rawOptions.some(o => !o)) {
      return { error: 'Las preguntas de opción múltiple necesitan las 4 opciones (A, B, C y D).' };
    }
    const correct = normalizeOption(raw.correctOption);
    if (!correct) return { error: 'Marca cuál opción es la correcta.' };
    q.options = rawOptions;
    q.correctOption = correct;
  }

  if (!answerGuide && !hasOptions) {
    return { error: 'Escribe la guía de respuesta para el juez.' };
  }
  q.answerGuide = answerGuide || `Opción ${q.correctOption}: ${q.options[q.correctOption.charCodeAt(0) - 65]}`;

  const requested = QUESTION_TYPES.includes(raw.type) && raw.type !== 'multiple_choice' ? raw.type : null;
  q.type = hasOptions ? 'multiple_choice' : (requested || (code ? 'code' : (math ? 'math' : 'text')));
  return { question: q };
}

// Numeración secuencial "Pregunta N" dentro de una ronda
function renumberRound(round) {
  round.questions.forEach((q, i) => {
    q.number = i + 1;
    q.title = `Pregunta ${i + 1}`;
  });
}

// La pregunta en curso (o en pausa) no se puede modificar ni eliminar
function isQuestionLocked(roundIndex, questionIndex) {
  return gameState.currentRoundIndex === roundIndex &&
    gameState.currentQuestionIndex === questionIndex &&
    (gameState.questionState === 'running' || gameState.questionState === 'paused');
}

// Validation Helpers
function isValidAdminPassword(pwd) {
  if (!pwd || typeof pwd !== 'string') return false;
  return validator.cleanString(pwd) === ADMIN_PASSWORD;
}

function isValidTeamPassword(teamId, pwd) {
  if (!validator.isValidTeamId(teamId) || !pwd || typeof pwd !== 'string') return false;
  const validList = TEAM_PASSWORDS[teamId.toLowerCase()];
  if (!validList) return false;
  const cleaned = validator.cleanString(pwd).toLowerCase();
  return validList.some(v => v.toLowerCase() === cleaned);
}

// Master Teams Setup
const DEFAULT_TEAMS = [
  { id: 'sistemas', name: 'Ingeniería de Sistemas', shortName: 'Sistemas', color: '#0284c7', eliminated: false, score: 0, eliminatedInRound: null },
  { id: 'software', name: 'Ingeniería de Software', shortName: 'Software', color: '#06b6d4', eliminated: false, score: 0, eliminatedInRound: null },
  { id: 'alimentos', name: 'Ingeniería de Alimentos', shortName: 'Alimentos', color: '#16a34a', eliminated: false, score: 0, eliminatedInRound: null },
  { id: 'quimica', name: 'Ingeniería Química', shortName: 'Química', color: '#9333ea', eliminated: false, score: 0, eliminatedInRound: null },
  { id: 'civil', name: 'Ingeniería Civil', shortName: 'Civil', color: '#ea580c', eliminated: false, score: 0, eliminatedInRound: null },
  { id: 'petroquimica', name: 'Téc. Procesos Petroquímicos', shortName: 'Petroquímica', color: '#0d9488', eliminated: false, score: 0, eliminatedInRound: null }
];

// Master Game State
let gameState = {
  teams: JSON.parse(JSON.stringify(DEFAULT_TEAMS)),
  currentRoundIndex: 0,
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
  roundScores: {},
  history: [],
  roundSummary: null,
  readyTeams: [], // IDs de equipos que confirmaron presencia (check-in)
  showLeaderboard: false
};

// Normaliza la opción enviada por un equipo ('A'-'D') o null si no es válida
function normalizeOption(opt) {
  if (typeof opt !== 'string') return null;
  const letter = opt.trim().toUpperCase();
  return ['A', 'B', 'C', 'D'].includes(letter) ? letter : null;
}

function initRoundScores() {
  gameState.roundScores = {};
  gameState.teams.forEach(t => {
    if (!t.eliminated) {
      gameState.roundScores[t.id] = 0;
      t.score = 0;
    }
  });
}
initRoundScores();

// Timer Logic
let timerInterval = null;

// Estado público: sin pregunta en idle y sin respuestas hasta que la pregunta termina
function publicState() {
  const payload = JSON.parse(JSON.stringify(gameState));
  if (payload.questionState === 'idle') {
    payload.currentQuestion = null;
  } else if (payload.currentQuestion && payload.questionState !== 'ended') {
    delete payload.currentQuestion.correctOption;
    delete payload.currentQuestion.answerGuide;
  }
  return payload;
}

function broadcastState() {
  io.emit('state_update', publicState());
}

function startTimer(durationSeconds) {
  if (timerInterval) clearInterval(timerInterval);
  
  gameState.timer.duration = durationSeconds;
  gameState.timer.remaining = durationSeconds;
  gameState.timer.isRunning = true;
  gameState.timer.startTime = Date.now();
  gameState.timer.endTime = Date.now() + durationSeconds * 1000;
  
  timerInterval = setInterval(() => {
    if (gameState.timer.isRunning) {
      gameState.timer.remaining--;
      io.emit('timer_tick', { remaining: gameState.timer.remaining });
      
      if (gameState.timer.remaining <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        gameState.timer.remaining = 0;
        gameState.timer.isRunning = false;
        gameState.questionState = 'ended';
        io.emit('question_time_up');
        broadcastState();
      }
    }
  }, 1000);
}

function pauseTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  gameState.timer.isRunning = false;
  gameState.questionState = 'paused';
  broadcastState();
}

function resumeTimer() {
  if (gameState.timer.remaining > 0) {
    gameState.timer.isRunning = true;
    gameState.questionState = 'running';
    gameState.timer.endTime = Date.now() + gameState.timer.remaining * 1000;
    
    timerInterval = setInterval(() => {
      if (gameState.timer.isRunning) {
        gameState.timer.remaining--;
        io.emit('timer_tick', { remaining: gameState.timer.remaining });
        
        if (gameState.timer.remaining <= 0) {
          clearInterval(timerInterval);
          timerInterval = null;
          gameState.timer.remaining = 0;
          gameState.timer.isRunning = false;
          gameState.questionState = 'ended';
          io.emit('question_time_up');
          broadcastState();
        }
      }
    }, 1000);
    broadcastState();
  }
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  gameState.timer.isRunning = false;
  gameState.questionState = 'ended';
  // Sincronizar a todos los clientes con el tiempo restante congelado
  io.emit('timer_tick', { remaining: gameState.timer.remaining });
  broadcastState();
}

function archiveCurrentQuestionSubmissions() {
  if (!gameState.submissions || gameState.submissions.length === 0) return;
  
  const existingIdx = gameState.history.findIndex(
    h => h.roundIndex === gameState.currentRoundIndex && h.questionIndex === gameState.currentQuestionIndex
  );
  
  const historyEntry = {
    roundIndex: gameState.currentRoundIndex,
    questionIndex: gameState.currentQuestionIndex,
    submissions: JSON.parse(JSON.stringify(gameState.submissions))
  };

  if (existingIdx >= 0) {
    gameState.history[existingIdx] = historyEntry;
  } else {
    gameState.history.push(historyEntry);
  }
}

function recalculateScores() {
  const currentRound = questionsData.rounds[gameState.currentRoundIndex];
  if (!currentRound) return;
  
  const correctSubmissions = gameState.submissions.filter(s => s.correct === true);
  const SPEED_BONUSES = [5, 3, 1];
  
  gameState.submissions.forEach(sub => {
    if (sub.correct === true) {
      sub.basePoints = 10;
      const rankIdx = correctSubmissions.indexOf(sub);
      sub.bonusPoints = (rankIdx >= 0 && rankIdx < SPEED_BONUSES.length) ? SPEED_BONUSES[rankIdx] : 0;
      sub.totalPoints = sub.basePoints + sub.bonusPoints;
    } else if (sub.correct === false) {
      sub.basePoints = 0;
      sub.bonusPoints = 0;
      sub.totalPoints = 0;
    } else {
      sub.basePoints = 0;
      sub.bonusPoints = 0;
      sub.totalPoints = 0;
    }
  });

  const roundPointsByTeam = {};
  gameState.teams.forEach(t => {
    if (!t.eliminated) roundPointsByTeam[t.id] = 0;
  });

  // 1. Accumulate points from previous questions in this round
  gameState.history.forEach(item => {
    if (item.roundIndex === gameState.currentRoundIndex && item.questionIndex !== gameState.currentQuestionIndex) {
      item.submissions.forEach(sub => {
        if (sub.totalPoints && roundPointsByTeam[sub.teamId] !== undefined) {
          roundPointsByTeam[sub.teamId] += sub.totalPoints;
        }
      });
    }
  });

  // 2. Accumulate points from the current active question
  gameState.submissions.forEach(sub => {
    if (sub.totalPoints && roundPointsByTeam[sub.teamId] !== undefined) {
      roundPointsByTeam[sub.teamId] += sub.totalPoints;
    }
  });

  gameState.roundScores = roundPointsByTeam;
  gameState.teams.forEach(t => {
    if (roundPointsByTeam[t.id] !== undefined) {
      t.score = roundPointsByTeam[t.id];
    }
  });
}

// Socket.IO Real-Time Engine
io.on('connection', (socket) => {
  const clientIp = socket.handshake.address;

  // Send Initial Snapshot (sin respuestas)
  socket.emit('state_update', publicState());

  // 1. Admin Authentication with Rate Limiting
  socket.on('admin_login', (data) => {
    if (!validator.checkRateLimit(`admin_${clientIp}`, 6, 15000)) {
      return socket.emit('admin_login_error', { error: 'Demasiados intentos. Espera 15 segundos.' });
    }
    const clean = validator.sanitizePayload(data);
    if (isValidAdminPassword(clean.password)) {
      socket.emit('admin_login_success', { ok: true });
      // El banco completo (con respuestas) solo viaja a moderadores autenticados
      socket.join('admins');
      socket.emit('questions_data', questionsData);
    } else {
      socket.emit('admin_login_error', { error: 'Contraseña de administrador incorrecta.' });
    }
  });

  // 2. Team Authentication with Rate Limiting
  socket.on('team_login', (data) => {
    const clean = validator.sanitizePayload(data);
    const rateKey = `team_${clientIp}_${clean.teamId}`;
    if (!validator.checkRateLimit(rateKey, 8, 15000)) {
      return socket.emit('team_login_error', { error: 'Demasiados intentos. Espera un momento.' });
    }
    if (isValidTeamPassword(clean.teamId, clean.password)) {
      socket.emit('team_login_success', { teamId: clean.teamId });
    } else {
      socket.emit('team_login_error', { error: 'Contraseña de carrera incorrecta.' });
    }
  });

  // 2.1 Check-in de Equipos (Quórum de Preparación)
  socket.on('team_ready', (data) => {
    const clean = validator.sanitizePayload(data);
    if (!validator.isValidTeamId(clean.teamId)) return;
    const teamId = clean.teamId.toLowerCase().trim();
    const team = gameState.teams.find(t => t.id === teamId);
    if (!team || team.eliminated) return;

    const isReady = gameState.readyTeams.includes(teamId);
    if (clean.ready === true && !isReady) {
      gameState.readyTeams.push(teamId);
    } else if (clean.ready === false && isReady) {
      gameState.readyTeams = gameState.readyTeams.filter(id => id !== teamId);
    }
    broadcastState();
  });

  // 3. Admin Round Selection
  socket.on('admin_select_round', (data) => {
    const clean = validator.sanitizePayload(data);
    if (!isValidAdminPassword(clean.adminPassword)) return;
    if (!validator.isValidNumber(clean.roundIndex, 0, questionsData.rounds.length - 1)) return;

    gameState.currentRoundIndex = clean.roundIndex;
    gameState.currentQuestionIndex = 0;
    gameState.questionState = 'idle';
    gameState.submissions = [];
    const round = questionsData.rounds[clean.roundIndex];
    if (round) {
      gameState.timer.duration = round.timeLimit;
      gameState.timer.remaining = round.timeLimit;
    }
    initRoundScores();
    broadcastState();
  });

  // 4. Admin Question Selection
  socket.on('admin_select_question', (data) => {
    const clean = validator.sanitizePayload(data);
    if (!isValidAdminPassword(clean.adminPassword)) return;
    const currentRound = questionsData.rounds[gameState.currentRoundIndex];
    if (!currentRound) return;
    if (!validator.isValidNumber(clean.questionIndex, 0, currentRound.questions.length - 1)) return;

    // Archive current question before switching
    archiveCurrentQuestionSubmissions();
    recalculateScores();

    gameState.currentQuestionIndex = clean.questionIndex;
    gameState.questionState = 'idle';

    // Check if newly selected question has saved submissions in history
    const saved = gameState.history.find(
      h => h.roundIndex === gameState.currentRoundIndex && h.questionIndex === clean.questionIndex
    );
    gameState.submissions = saved ? JSON.parse(JSON.stringify(saved.submissions)) : [];

    gameState.currentQuestion = currentRound.questions[clean.questionIndex];
    gameState.timer.duration = currentRound.timeLimit;
    gameState.timer.remaining = currentRound.timeLimit;
    recalculateScores();
    broadcastState();
  });

  // 4.1 Admin Next Question Navigation
  socket.on('admin_next_question', (data) => {
    const clean = validator.sanitizePayload(data);
    if (!isValidAdminPassword(clean.adminPassword)) return;
    const currentRound = questionsData.rounds[gameState.currentRoundIndex];
    if (!currentRound) return;

    // Archive current question submissions before moving
    archiveCurrentQuestionSubmissions();
    recalculateScores();

    if (gameState.currentQuestionIndex < currentRound.questions.length - 1) {
      gameState.currentQuestionIndex++;
      gameState.questionState = 'idle';

      const saved = gameState.history.find(
        h => h.roundIndex === gameState.currentRoundIndex && h.questionIndex === gameState.currentQuestionIndex
      );
      gameState.submissions = saved ? JSON.parse(JSON.stringify(saved.submissions)) : [];

      gameState.currentQuestion = currentRound.questions[gameState.currentQuestionIndex];
      gameState.timer.duration = currentRound.timeLimit;
      gameState.timer.remaining = currentRound.timeLimit;
      recalculateScores();
      broadcastState();
    }
  });

  // 5. Admin Timer Controls
  socket.on('admin_start_timer', (data) => {
    const clean = validator.sanitizePayload(data);
    if (!isValidAdminPassword(clean.adminPassword)) return;
    const currentRound = questionsData.rounds[gameState.currentRoundIndex];
    if (!currentRound) return;

    if (gameState.questionState !== 'paused') {
      gameState.submissions = [];
    }
    gameState.questionState = 'running';
    gameState.currentQuestion = currentRound.questions[gameState.currentQuestionIndex];
    startTimer(currentRound.timeLimit);
    recalculateScores();
    broadcastState();
    io.emit('question_started', {
      question: gameState.currentQuestion,
      round: currentRound
    });
  });

  socket.on('admin_pause_timer', (data) => {
    const clean = validator.sanitizePayload(data);
    if (!isValidAdminPassword(clean.adminPassword)) return;
    if (gameState.questionState === 'running') {
      pauseTimer();
    } else if (gameState.questionState === 'paused') {
      resumeTimer();
    }
  });

  socket.on('admin_stop_timer', (data) => {
    const clean = validator.sanitizePayload(data);
    if (!isValidAdminPassword(clean.adminPassword)) return;
    stopTimer();
  });

  // 6. Team Answer Submission (Buzzer)
  socket.on('submit_answer', (data) => {
    const clean = validator.sanitizePayload(data);
    if (!validator.isValidTeamId(clean.teamId)) return;
    if (gameState.questionState !== 'running') {
      return socket.emit('submission_error', { message: 'La pregunta no está activa.' });
    }

    const team = gameState.teams.find(t => t.id === clean.teamId);
    if (!team || team.eliminated) {
      return socket.emit('submission_error', { message: 'El equipo está eliminado o no es válido.' });
    }

    const alreadySubmitted = gameState.submissions.some(s => s.teamId === clean.teamId);
    if (alreadySubmitted) {
      return socket.emit('submission_error', { message: 'Tu equipo ya entregó la respuesta.' });
    }

    const elapsedMs = gameState.timer.startTime ? Date.now() - gameState.timer.startTime : 0;
    const submission = {
      teamId: team.id,
      teamName: team.shortName || team.name,
      submittedAt: Date.now(),
      elapsedMs: Math.max(0, elapsedMs),
      option: normalizeOption(clean.option),
      correct: null,
      basePoints: 0,
      bonusPoints: 0,
      totalPoints: 0,
      order: gameState.submissions.length + 1
    };

    gameState.submissions.push(submission);
    recalculateScores();

    socket.emit('submission_confirmed', {
      order: submission.order,
      elapsedMs: submission.elapsedMs
    });

    io.emit('new_submission', {
      teamId: team.id,
      teamName: team.shortName,
      option: submission.option,
      order: submission.order,
      elapsedMs: submission.elapsedMs
    });

    broadcastState();
  });

  // 7. Admin Answer Evaluation
  socket.on('admin_evaluate_answer', (data) => {
    const clean = validator.sanitizePayload(data);
    if (!isValidAdminPassword(clean.adminPassword)) return;
    if (!validator.isValidNumber(clean.submissionIndex, 0, gameState.submissions.length - 1)) return;

    const sub = gameState.submissions[clean.submissionIndex];
    if (sub) {
      sub.correct = clean.correct === true;
      recalculateScores();
      archiveCurrentQuestionSubmissions();
      broadcastState();
      io.emit('evaluation_updated', {
        teamId: sub.teamId,
        correct: sub.correct
      });
    }
  });

  // 7.1 Admin Toggle Leaderboard Screen
  socket.on('admin_toggle_results', (data) => {
    const clean = validator.sanitizePayload(data);
    if (!isValidAdminPassword(clean.adminPassword)) return;
    gameState.showLeaderboard = clean.showLeaderboard !== undefined ? clean.showLeaderboard : !gameState.showLeaderboard;
    broadcastState();
  });

  // 7.2 Banco de preguntas: crear / editar
  socket.on('admin_question_save', (data, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    if (!data || !isValidAdminPassword(data.adminPassword)) return reply({ ok: false, error: 'No autorizado.' });

    const roundIndex = data.roundIndex;
    if (!validator.isValidNumber(roundIndex, 0, questionsData.rounds.length - 1)) {
      return reply({ ok: false, error: 'Ronda inválida.' });
    }
    const round = questionsData.rounds[roundIndex];
    const isNew = data.questionIndex === null || data.questionIndex === undefined;
    if (!isNew && !validator.isValidNumber(data.questionIndex, 0, round.questions.length - 1)) {
      return reply({ ok: false, error: 'La pregunta ya no existe.' });
    }
    if (!isNew && isQuestionLocked(roundIndex, data.questionIndex)) {
      return reply({ ok: false, error: 'No puedes editar la pregunta mientras está en curso. Termínala primero.' });
    }
    if (isNew && round.questions.length >= 50) {
      return reply({ ok: false, error: 'Esta ronda ya tiene el máximo de 50 preguntas.' });
    }

    const result = sanitizeQuestion(data.question);
    if (result.error) return reply({ ok: false, error: result.error });

    let questionIndex;
    if (isNew) {
      result.question.id = `${round.id}-${Date.now().toString(36)}`;
      round.questions.push(result.question);
      questionIndex = round.questions.length - 1;
    } else {
      questionIndex = data.questionIndex;
      result.question.id = round.questions[questionIndex].id;
      round.questions[questionIndex] = result.question;
    }
    renumberRound(round);

    if (gameState.currentRoundIndex === roundIndex && gameState.currentQuestionIndex === questionIndex && gameState.currentQuestion) {
      gameState.currentQuestion = round.questions[questionIndex];
    }

    const saved = saveQuestions();
    io.to('admins').emit('questions_data', questionsData);
    broadcastState();
    reply({ ok: true, questionIndex, saved, warning: saved ? null : 'Guardado solo en memoria: no se pudo escribir el archivo.' });
  });

  // 7.3 Banco de preguntas: eliminar
  socket.on('admin_question_delete', (data, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    if (!data || !isValidAdminPassword(data.adminPassword)) return reply({ ok: false, error: 'No autorizado.' });

    const { roundIndex, questionIndex } = data;
    if (!validator.isValidNumber(roundIndex, 0, questionsData.rounds.length - 1)) {
      return reply({ ok: false, error: 'Ronda inválida.' });
    }
    const round = questionsData.rounds[roundIndex];
    if (!validator.isValidNumber(questionIndex, 0, round.questions.length - 1)) {
      return reply({ ok: false, error: 'La pregunta ya no existe.' });
    }
    if (round.questions.length <= 1) {
      return reply({ ok: false, error: 'Cada ronda necesita al menos una pregunta.' });
    }
    if (isQuestionLocked(roundIndex, questionIndex)) {
      return reply({ ok: false, error: 'No puedes eliminar la pregunta mientras está en curso. Termínala primero.' });
    }

    round.questions.splice(questionIndex, 1);
    renumberRound(round);

    // Reindexar el historial de entregas de esa ronda
    gameState.history = gameState.history
      .filter(h => !(h.roundIndex === roundIndex && h.questionIndex === questionIndex))
      .map(h => (h.roundIndex === roundIndex && h.questionIndex > questionIndex)
        ? Object.assign({}, h, { questionIndex: h.questionIndex - 1 })
        : h);

    if (gameState.currentRoundIndex === roundIndex) {
      if (gameState.currentQuestionIndex === questionIndex) {
        const nextIdx = Math.min(questionIndex, round.questions.length - 1);
        gameState.currentQuestionIndex = nextIdx;
        gameState.questionState = 'idle';
        const savedSubs = gameState.history.find(h => h.roundIndex === roundIndex && h.questionIndex === nextIdx);
        gameState.submissions = savedSubs ? JSON.parse(JSON.stringify(savedSubs.submissions)) : [];
        gameState.currentQuestion = round.questions[nextIdx];
      } else if (gameState.currentQuestionIndex > questionIndex) {
        gameState.currentQuestionIndex--;
      }
      recalculateScores();
    }

    const saved = saveQuestions();
    io.to('admins').emit('questions_data', questionsData);
    broadcastState();
    reply({ ok: true, saved, warning: saved ? null : 'Eliminada solo en memoria: no se pudo escribir el archivo.' });
  });

  // 8. Admin Elimination Management
  socket.on('admin_eliminate_team', (data) => {
    const clean = validator.sanitizePayload(data);
    if (!isValidAdminPassword(clean.adminPassword)) return;
    if (!validator.isValidTeamId(clean.teamId)) return;

    const team = gameState.teams.find(t => t.id === clean.teamId);
    if (team) {
      team.eliminated = true;
      team.eliminatedInRound = gameState.currentRoundIndex + 1;
      gameState.readyTeams = gameState.readyTeams.filter(id => id !== team.id);
      broadcastState();
      io.emit('team_eliminated', {
        teamId: team.id,
        teamName: team.name,
        round: gameState.currentRoundIndex + 1
      });
    }
  });

  // 9. Admin Next Round / Reset
  socket.on('admin_next_round', (data) => {
    const clean = validator.sanitizePayload(data);
    if (!isValidAdminPassword(clean.adminPassword)) return;
    if (gameState.currentRoundIndex < questionsData.rounds.length - 1) {
      archiveCurrentQuestionSubmissions();
      gameState.currentRoundIndex++;
      gameState.currentQuestionIndex = 0;
      gameState.questionState = 'idle';
      gameState.submissions = [];
      const nextRound = questionsData.rounds[gameState.currentRoundIndex];
      if (nextRound) {
        gameState.timer.duration = nextRound.timeLimit;
        gameState.timer.remaining = nextRound.timeLimit;
        gameState.currentQuestion = nextRound.questions[0];
      }
      gameState.readyTeams = [];
      initRoundScores();
      broadcastState();
    }
  });

  socket.on('admin_reset_game', (data) => {
    const clean = validator.sanitizePayload(data);
    if (!isValidAdminPassword(clean.adminPassword)) return;

    gameState.teams = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
    gameState.currentRoundIndex = 0;
    gameState.currentQuestionIndex = 0;
    gameState.questionState = 'idle';
    gameState.submissions = [];
    gameState.history = [];
    gameState.readyTeams = [];
    gameState.showLeaderboard = false;
    const firstRound = questionsData.rounds[0];
    if (firstRound) {
      gameState.timer.duration = firstRound.timeLimit;
      gameState.timer.remaining = firstRound.timeLimit;
    }
    initRoundScores();
    broadcastState();
  });
});

// Global Express Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[QQSI Server Error]:', err.stack || err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: NODE_ENV === 'development' ? err.message : 'Error interno en el servidor.'
  });
});

// Start Server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(` ¿QUIÉN QUIERE SER INGENIERO? — SERVIDOR EN VIVO`);
  console.log(` Puerto: ${PORT} | Entorno: ${NODE_ENV}`);
  console.log(` Orígenes Permitidos: ${rawAllowedOrigins.join(', ')}`);
  console.log(` Rondas cargadas: ${questionsData.rounds.length}`);
  console.log(`====================================================`);
});
