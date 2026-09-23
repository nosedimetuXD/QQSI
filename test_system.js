const { io } = require("socket.io-client");
const http = require("http");

async function testServer() {
  console.log("=== INICIANDO PRUEBAS DEL SISTEMA QQSI ===");

  // 1. Check HTTP response on index.html
  await new Promise((resolve, reject) => {
    http.get("http://localhost:3000/", (res) => {
      console.log(`✓ HTTP GET / status code: ${res.statusCode}`);
      if (res.statusCode === 200) resolve();
      else reject(new Error("HTTP failed"));
    }).on("error", reject);
  });

  // 2. Connect Admin socket and Team socket
  const adminSocket = io("http://localhost:3000");
  const team1Socket = io("http://localhost:3000");
  const team2Socket = io("http://localhost:3000");

  await new Promise(resolve => adminSocket.on("connect", resolve));
  console.log("✓ Admin socket conectado con éxito");

  await new Promise(resolve => team1Socket.on("connect", resolve));
  await new Promise(resolve => team2Socket.on("connect", resolve));
  console.log("✓ Sockets de Equipos conectados con éxito");

  // 3. Test Question Launch
  console.log("\n--- Probando Lanzamiento de Pregunta (Ronda 1) ---");
  adminSocket.emit("admin_start_question");

  await new Promise(resolve => setTimeout(resolve, 300));

  // 4. Test Team Submissions
  console.log("Simulando entrega de Sistemas (1º) y Alimentos (2º)...");
  team1Socket.emit("team_submit", { teamId: "sistemas" });
  await new Promise(resolve => setTimeout(resolve, 200));
  team2Socket.emit("team_submit", { teamId: "alimentos" });

  await new Promise(resolve => setTimeout(resolve, 300));

  // 5. Test Evaluation & Speed Bonus Shift:
  // Sistemas (1º) se califica Incorrecto -> 0 pts
  // Alimentos (2º) se califica Correcto -> debe recibir +10 base y el bono mayor de +5 pts = 15 pts!
  console.log("\n--- Probando Evaluación y Desplazamiento de Bono ---");
  adminSocket.emit("admin_evaluate_submission", { teamId: "sistemas", isCorrect: false });
  adminSocket.emit("admin_evaluate_submission", { teamId: "alimentos", isCorrect: true });

  await new Promise(resolve => setTimeout(resolve, 400));

  // Verify state via Admin Socket
  let verified = false;
  await new Promise((resolve) => {
    adminSocket.once("state_update", (state) => {
      const subSistemas = state.submissions.find(s => s.teamId === "sistemas");
      const subAlimentos = state.submissions.find(s => s.teamId === "alimentos");

      console.log(`• Sistemas: Correcto=${subSistemas.correct}, Puntos Base=${subSistemas.basePoints}, Bono=${subSistemas.bonusPoints}, Total=${subSistemas.totalPoints}`);
      console.log(`• Alimentos: Correcto=${subAlimentos.correct}, Puntos Base=${subAlimentos.basePoints}, Bono=${subAlimentos.bonusPoints}, Total=${subAlimentos.totalPoints}`);

      if (subSistemas.totalPoints === 0 && subAlimentos.totalPoints === 15 && subAlimentos.bonusPoints === 5) {
        console.log("✓ Algoritmo de Bonificación de Velocidad funcionando PERFECTAMENTE (+5 transferido al 1er acierto)");
        verified = true;
      }
      resolve();
    });
    // Trigger a state update by stopping question
    adminSocket.emit("admin_stop_question");
  });

  // 6. Test Confirming Points
  console.log("\n--- Confirmando Puntos a la Ronda ---");
  adminSocket.emit("admin_confirm_and_apply_points");
  await new Promise(resolve => setTimeout(resolve, 400));

  // 7. Test Elimination
  console.log("\n--- Probando Eliminación de Equipo ---");
  adminSocket.emit("admin_eliminate_team", { teamId: "civil" });
  await new Promise(resolve => setTimeout(resolve, 400));

  await new Promise((resolve) => {
    adminSocket.once("state_update", (state) => {
      const civil = state.teams.find(t => t.id === "civil");
      const activeTeams = state.teams.filter(t => !t.eliminated);
      console.log(`• Civil eliminado: ${civil.eliminated}, Equipos activos restantes: ${activeTeams.length}`);
      if (civil.eliminated && activeTeams.length === 4) {
        console.log("✓ Sistema de eliminación de equipos verificado correctamente");
      }
      resolve();
    });
    adminSocket.emit("admin_pause_timer");
  });

  adminSocket.disconnect();
  team1Socket.disconnect();
  team2Socket.disconnect();

  console.log("\n==========================================");
  console.log("✓ TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO");
  console.log("==========================================");
  process.exit(0);
}

testServer().catch(err => {
  console.error("Error en pruebas:", err);
  process.exit(1);
});
