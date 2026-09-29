// Prueba end-to-end del sistema QQSI.
// Levanta su propio servidor (puerto aislado) y ejercita el contrato Socket.IO completo.
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');
const os = require('os');
const assert = require('assert');
const { io } = require('socket.io-client');

const PORT = process.env.TEST_PORT || 3999;
const URL = `http://localhost:${PORT}`;
const ADMIN_PW = 'testpw';
const TEAM_PW = { civil: 'Civil2026*', sistemas: 'Sistemas2026*', software: 'Software2026*' };

let serverProc = null;
const sockets = [];

// Copia temporal del banco: las pruebas de CRUD nunca tocan data/questions.json
const QUESTIONS_TMP = path.join(os.tmpdir(), `qqsi-questions-test-${process.pid}.json`);
fs.copyFileSync(path.join(__dirname, 'data', 'questions.json'), QUESTIONS_TMP);
const readBankFile = () => JSON.parse(fs.readFileSync(QUESTIONS_TMP, 'utf8'));

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const ok = (msg) => console.log(`✓ ${msg}`);

function startServer() {
  return new Promise((resolve, reject) => {
    serverProc = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
      env: { ...process.env, PORT: String(PORT), ADMIN_PASSWORD: ADMIN_PW, NODE_ENV: 'test', QUESTIONS_FILE: QUESTIONS_TMP },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';
    serverProc.stderr.on('data', d => { stderr += d; });
    serverProc.on('exit', code => { if (code) reject(new Error(`Servidor terminó (${code}): ${stderr}`)); });

    const deadline = Date.now() + 10000;
    const ping = () => {
      http.get(URL + '/api/config', res => { res.resume(); resolve(); })
        .on('error', () => (Date.now() > deadline ? reject(new Error('Servidor no respondió')) : setTimeout(ping, 150)));
    };
    ping();
  });
}

function connect() {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  s.lastState = null;
  s.bank = null;
  s.on('state_update', st => { s.lastState = st; });
  s.on('questions_data', d => { s.bank = d; });
  sockets.push(s);
  return new Promise((resolve, reject) => {
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
  });
}

function once(socket, event, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout esperando "${event}"`)), timeout);
    socket.once(event, data => { clearTimeout(t); resolve(data); });
  });
}

async function waitFor(fn, label, timeout = 3000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const v = fn();
    if (v) return v;
    await wait(30);
  }
  throw new Error(`Condición no alcanzada: ${label}`);
}

// Espera hasta que el último estado del observador cumpla la condición
async function waitState(observer, predicate, label, timeout = 3000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (observer.lastState && predicate(observer.lastState)) return observer.lastState;
    await wait(30);
  }
  throw new Error(`Estado esperado no alcanzado: ${label}`);
}

async function run() {
  console.log('=== PRUEBAS END-TO-END QQSI ===');
  await startServer();
  ok(`Servidor de prueba levantado en ${URL}`);

  // HTTP
  await new Promise((resolve, reject) => {
    http.get(URL + '/', res => {
      res.resume();
      assert.strictEqual(res.statusCode, 200);
      resolve();
    }).on('error', reject);
  });
  ok('GET / responde 200');

  const observer = await connect();
  await waitState(observer, s => Array.isArray(s.readyTeams), 'estado inicial con readyTeams');
  assert.deepStrictEqual(observer.lastState.readyTeams, []);
  ok('Estado inicial incluye readyTeams vacío');

  // 1. Autenticación de administrador
  const admin = await connect();
  admin.emit('admin_login', { password: 'incorrecta' });
  const loginErr = await once(admin, 'admin_login_error');
  assert.ok(loginErr.error);
  ok('admin_login con contraseña incorrecta → admin_login_error');

  admin.emit('admin_login', { password: ADMIN_PW });
  await once(admin, 'admin_login_success');
  await waitFor(() => admin.bank, 'banco recibido por el admin');
  ok('admin_login correcto → admin_login_success y recibe el banco de preguntas');

  // 2. Autenticación de equipos
  const civil = await connect();
  const sistemas = await connect();
  const software = await connect();

  civil.emit('team_login', { teamId: 'civil', password: 'mala' });
  await once(civil, 'team_login_error');
  ok('team_login con contraseña incorrecta → team_login_error');

  for (const [sock, id] of [[civil, 'civil'], [sistemas, 'sistemas'], [software, 'software']]) {
    sock.emit('team_login', { teamId: id, password: TEAM_PW[id] });
    const res = await once(sock, 'team_login_success');
    assert.strictEqual(res.teamId, id);
  }
  ok('team_login correcto para civil, sistemas y software');

  // 3. Check-in (quórum)
  civil.emit('team_ready', { teamId: 'civil', ready: true });
  sistemas.emit('team_ready', { teamId: 'sistemas', ready: true });
  software.emit('team_ready', { teamId: 'software', ready: true });
  await waitState(observer, s => s.readyTeams.length === 3, '3 equipos listos');
  civil.emit('team_ready', { teamId: 'civil', ready: true }); // duplicado no debe repetirse
  software.emit('team_ready', { teamId: 'software', ready: false });
  await waitState(observer, s => s.readyTeams.length === 2 && !s.readyTeams.includes('software'), 'software desmarcado');
  assert.deepStrictEqual([...observer.lastState.readyTeams].sort(), ['civil', 'sistemas']);
  software.emit('team_ready', { teamId: 'software', ready: true });
  await waitState(observer, s => s.readyTeams.includes('software'), 'software listo otra vez');
  ok('team_ready true/false se refleja en state.readyTeams sin duplicados');

  // 4. Lanzar pregunta con opciones (f-4, índice 3 de la ronda 1)
  admin.emit('admin_select_question', { questionIndex: 3, adminPassword: ADMIN_PW });
  await waitState(observer, s => s.currentQuestionIndex === 3, 'pregunta 4 seleccionada');
  admin.emit('admin_start_timer', { adminPassword: ADMIN_PW });
  const running = await waitState(observer, s => s.questionState === 'running', 'questionState running');
  assert.ok(running.currentQuestion && running.currentQuestion.options.length === 4);
  assert.strictEqual(running.currentQuestion.correctOption, undefined, 'la clave no debe viajar a los equipos');
  assert.strictEqual(running.currentQuestion.answerGuide, undefined, 'la guía no debe viajar a los equipos');
  assert.strictEqual(observer.bank, null, 'un cliente no autenticado nunca recibe el banco');
  ok('admin_start_timer → "running" sin filtrar correctOption ni answerGuide al público');

  // 5. Entregas con opción (orden: software A, civil d, sistemas D)
  software.emit('submit_answer', { teamId: 'software', option: 'A' });
  await once(software, 'submission_confirmed');
  civil.emit('submit_answer', { teamId: 'civil', option: 'd' });
  await once(civil, 'submission_confirmed');
  sistemas.emit('submit_answer', { teamId: 'sistemas', option: 'Z' });
  await once(sistemas, 'submission_confirmed');
  const subsState = await waitState(observer, s => s.submissions.length === 3, '3 entregas');
  const [s1, s2, s3] = subsState.submissions;
  assert.strictEqual(s1.teamId, 'software'); assert.strictEqual(s1.order, 1); assert.strictEqual(s1.option, 'A');
  assert.strictEqual(s2.teamId, 'civil'); assert.strictEqual(s2.order, 2); assert.strictEqual(s2.option, 'D');
  assert.strictEqual(s3.teamId, 'sistemas'); assert.strictEqual(s3.order, 3); assert.strictEqual(s3.option, null);
  ok('submit_answer guarda orden y opción normalizada (A, d→D, inválida→null)');

  civil.emit('submit_answer', { teamId: 'civil', option: 'B' });
  const dup = await once(civil, 'submission_error');
  assert.ok(/ya entregó/i.test(dup.message));
  ok('Entrega duplicada rechazada con submission_error');

  // 6. Evaluación y bonos: el bono de velocidad solo aplica a correctas
  admin.emit('admin_evaluate_answer', { submissionIndex: 0, correct: false, adminPassword: ADMIN_PW });
  admin.emit('admin_evaluate_answer', { submissionIndex: 1, correct: true, adminPassword: ADMIN_PW });
  admin.emit('admin_evaluate_answer', { submissionIndex: 2, correct: true, adminPassword: ADMIN_PW });
  const evalState = await waitState(observer, s => s.submissions.every(x => x.correct !== null), 'todas evaluadas');
  const byTeam = Object.fromEntries(evalState.submissions.map(x => [x.teamId, x]));
  assert.strictEqual(byTeam.software.totalPoints, 0);
  assert.strictEqual(byTeam.civil.basePoints, 10);
  assert.strictEqual(byTeam.civil.bonusPoints, 5, 'el bono del 1º pasa al primer acierto');
  assert.strictEqual(byTeam.sistemas.bonusPoints, 3);
  const score = id => evalState.teams.find(t => t.id === id).score;
  assert.strictEqual(score('civil'), 15);
  assert.strictEqual(score('sistemas'), 13);
  assert.strictEqual(score('software'), 0);
  ok('Correcta = 10 + bono, incorrecta = 0; bono reasignado al primer acierto (15 / 13 / 0)');

  // 7. Detener cronómetro
  admin.emit('admin_stop_timer', { adminPassword: ADMIN_PW });
  const ended = await waitState(observer, s => s.questionState === 'ended', 'questionState ended');
  assert.strictEqual(typeof ended.timer.remaining, 'number');
  assert.strictEqual(ended.currentQuestion.correctOption, 'D', 'la clave se revela al terminar');
  ok('admin_stop_timer → "ended" con timer sincronizado y clave D revelada');

  // 8. Tabla de posiciones
  admin.emit('admin_toggle_results', { showLeaderboard: true, adminPassword: ADMIN_PW });
  await waitState(observer, s => s.showLeaderboard === true, 'leaderboard visible');
  admin.emit('admin_toggle_results', { showLeaderboard: false, adminPassword: ADMIN_PW });
  await waitState(observer, s => s.showLeaderboard === false, 'leaderboard oculto');
  ok('admin_toggle_results muestra y oculta el ranking');

  // 9. Eliminación
  admin.emit('admin_eliminate_team', { teamId: 'software', adminPassword: ADMIN_PW });
  const elim = await waitState(observer, s => s.teams.find(t => t.id === 'software').eliminated, 'software eliminado');
  assert.ok(!elim.readyTeams.includes('software'));
  software.emit('team_ready', { teamId: 'software', ready: true });
  await wait(200);
  assert.ok(!observer.lastState.readyTeams.includes('software'), 'equipo eliminado no puede marcarse listo');
  ok('admin_eliminate_team quita al equipo de readyTeams y bloquea su check-in');

  // 10. Reinicio
  admin.emit('admin_reset_game', { adminPassword: ADMIN_PW });
  const reset = await waitState(observer, s => s.readyTeams.length === 0 && s.questionState === 'idle', 'juego reiniciado');
  assert.ok(reset.teams.every(t => !t.eliminated && t.score === 0));
  assert.strictEqual(reset.submissions.length, 0);
  ok('admin_reset_game limpia readyTeams, entregas, eliminaciones y puntajes');

  // 11. Comandos de admin sin contraseña se ignoran
  admin.emit('admin_start_timer', { adminPassword: 'mala' });
  await wait(250);
  assert.strictEqual(observer.lastState.questionState, 'idle');
  ok('Comandos de admin con contraseña inválida son ignorados');

  // 12. Banco de preguntas: crear / editar / eliminar
  const save = (payload) => admin.timeout(3000).emitWithAck('admin_question_save', { adminPassword: ADMIN_PW, ...payload });
  const del = (payload) => admin.timeout(3000).emitWithAck('admin_question_delete', { adminPassword: ADMIN_PW, ...payload });
  const initialCount = readBankFile().rounds[0].questions.length;

  let res = await observer.timeout(3000).emitWithAck('admin_question_save', { adminPassword: 'mala', roundIndex: 0, questionIndex: null, question: { statement: 'Hackeo', answerGuide: 'x' } });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(readBankFile().rounds[0].questions.length, initialCount);
  ok('Guardar pregunta sin contraseña de admin es rechazado');

  res = await save({ roundIndex: 0, questionIndex: null, question: { statement: 'x', answerGuide: 'y' } });
  assert.strictEqual(res.ok, false); assert.ok(/enunciado/i.test(res.error));
  res = await save({ roundIndex: 0, questionIndex: null, question: { statement: '¿Pregunta abierta sin guía?' } });
  assert.strictEqual(res.ok, false); assert.ok(/guía/i.test(res.error));
  res = await save({ roundIndex: 0, questionIndex: null, question: { statement: '¿Opciones incompletas?', options: ['a', 'b', '', 'd'], correctOption: 'A' } });
  assert.strictEqual(res.ok, false); assert.ok(/4 opciones/i.test(res.error));
  res = await save({ roundIndex: 0, questionIndex: null, question: { statement: '¿Sin marcar la correcta?', options: ['a', 'b', 'c', 'd'] } });
  assert.strictEqual(res.ok, false); assert.ok(/correcta/i.test(res.error));
  ok('Validación: enunciado, guía, 4 opciones y opción correcta obligatorias');

  const code = 'int main() {\n\treturn 0;\n}';
  res = await save({ roundIndex: 0, questionIndex: null, question: { statement: '¿Qué retorna este programa?', code, answerGuide: 'Retorna 0.' } });
  assert.strictEqual(res.ok, true, res.error);
  const newIdx = res.questionIndex;
  assert.strictEqual(newIdx, initialCount);
  let fileQ = readBankFile().rounds[0].questions[newIdx];
  assert.strictEqual(fileQ.code, code, 'el código conserva saltos de línea y tabulaciones');
  assert.strictEqual(fileQ.type, 'code');
  assert.strictEqual(fileQ.title, `Pregunta ${initialCount + 1}`);
  assert.ok(fileQ.id);
  await waitFor(() => admin.bank && admin.bank.rounds[0].questions.length === initialCount + 1, 'admin recibe banco actualizado');
  ok('Crear pregunta: se guarda en disco, se numera y el admin recibe el banco actualizado');

  res = await save({ roundIndex: 0, questionIndex: newIdx, question: { statement: '¿Cuál es el resultado?', options: ['0', '1', '-1', 'Error'], correctOption: 'a' } });
  assert.strictEqual(res.ok, true, res.error);
  fileQ = readBankFile().rounds[0].questions[newIdx];
  assert.strictEqual(fileQ.type, 'multiple_choice');
  assert.strictEqual(fileQ.correctOption, 'A');
  assert.deepStrictEqual(fileQ.options, ['0', '1', '-1', 'Error']);
  assert.ok(fileQ.answerGuide.includes('Opción A'), 'guía autogenerada para opción múltiple');
  assert.strictEqual(fileQ.code, undefined, 'campos eliminados no quedan huérfanos');
  ok('Editar pregunta: pasa a opción múltiple, normaliza la clave y conserva el id');

  // Bloqueo mientras la pregunta está en curso
  admin.emit('admin_select_question', { questionIndex: newIdx, adminPassword: ADMIN_PW });
  await waitState(observer, s => s.currentQuestionIndex === newIdx, 'pregunta nueva seleccionada');
  admin.emit('admin_start_timer', { adminPassword: ADMIN_PW });
  await waitState(observer, s => s.questionState === 'running', 'pregunta nueva en curso');
  res = await save({ roundIndex: 0, questionIndex: newIdx, question: { statement: 'Cambio en vivo', answerGuide: 'x' } });
  assert.strictEqual(res.ok, false);
  res = await del({ roundIndex: 0, questionIndex: newIdx });
  assert.strictEqual(res.ok, false);
  admin.emit('admin_stop_timer', { adminPassword: ADMIN_PW });
  await waitState(observer, s => s.questionState === 'ended', 'pregunta nueva terminada');
  ok('La pregunta en curso no se puede editar ni eliminar');

  // Eliminar una pregunta anterior a la seleccionada reajusta el índice actual
  const currentStatement = readBankFile().rounds[0].questions[newIdx].statement;
  res = await del({ roundIndex: 0, questionIndex: 0 });
  assert.strictEqual(res.ok, true, res.error);
  const afterDel = await waitState(observer, s => s.currentQuestionIndex === newIdx - 1, 'índice reajustado');
  assert.strictEqual(afterDel.currentQuestion.statement, currentStatement);
  const bankAfter = readBankFile().rounds[0].questions;
  assert.strictEqual(bankAfter.length, initialCount);
  assert.ok(bankAfter.every((q, i) => q.number === i + 1 && q.title === `Pregunta ${i + 1}`), 'renumeración secuencial');
  ok('Eliminar pregunta: renumera la ronda y mantiene seleccionada la misma pregunta');

  res = await del({ roundIndex: 0, questionIndex: 999 });
  assert.strictEqual(res.ok, false);
  ok('Eliminar un índice inexistente es rechazado');
}

function cleanup() {
  sockets.forEach(s => s.close());
  if (serverProc && !serverProc.killed) serverProc.kill();
  try { fs.unlinkSync(QUESTIONS_TMP); } catch (e) {}
}

run()
  .then(() => {
    console.log('\n=== TODAS LAS PRUEBAS PASARON ===');
    cleanup();
    process.exit(0);
  })
  .catch(err => {
    console.error('\n✗ FALLO:', err.message);
    cleanup();
    process.exit(1);
  });
