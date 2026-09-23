# ¿Quién quiere ser Ingeniero? (QQSI) 🎓

Sistema interactivo web multi-pantalla en tiempo real diseñado para el concurso universitario intercarreras **"¿Quién quiere ser Ingeniero?"**.

---

## 🚀 Características Principales

- **Fiel al Diseño Original**:
  - Estética basada en el diseño del concurso con patrón a cuadros *gingham/vichy* celeste y blanco.
  - Tarjeta central de mezclilla/denim azul con efecto de costura pespunteada (*stitched border*).
  - Cinta/lazo azul (*ribbon banner*) para la cabecera de las preguntas.
  - Motivos vectoriales limpios (barco y estrellas de origami, olas y logo de circuitos ECS).
- **Cero Emojis (100% Iconos Vectoriales SVG)**: Iconografía nítida para medallas de velocidad, cronómetros, marcas de verificación y estados.
- **Soporte de Ecuaciones y Código**: Renderizado matemático con **KaTeX** y resaltado de sintaxis con **Prism.js** (C++).
- **Banco de Preguntas Precargado**: 25 preguntas clasificadas en 4 niveles de dificultad (Fácil, Normal, Difícil, Experto) con corrección ortográfica y matemática.
- **Sincronización en Tiempo Real (Socket.IO)**: Conexión instantánea entre el auditorio, los dispositivos móviles de los equipos y la mesa del jurado.
- **Lógica de Bonos y Reasignación Dinámica**:
  - Respuesta Correcta: **10 puntos base**.
  - Bonos de tiempo: 🥇 1º correcto (+5 pts), 🥈 2º correcto (+3 pts), 🥉 3º correcto (+1 pt).
  - Si un equipo entrega primero pero su respuesta es incorrecta, el bono de velocidad de +5 puntos se transfiere automáticamente al siguiente equipo que haya acertado.
- **Dinámica de Eliminación por Ronda**: 4 rondas con eliminación del equipo de menor puntaje en cada fase y reinicio de puntuación acumulada.

---

## 📱 Pantallas del Sistema

| Vista | URL | Descripción |
| :--- | :--- | :--- |
| **Hub Principal** | `http://localhost:3000/` | Portal de bienvenida y selección de rol. |
| **Proyección** | `http://localhost:3000/display.html` | Vista para videobeam/auditorio con preguntas en grande, fórmulas, temporizador y entregas en vivo. |
| **Equipos** | `http://localhost:3000/team.html` | Vista móvil/desktop para los 5 equipos con botón interactivo de entrega y registro de milisegundos. |
| **Admin / Juez** | `http://localhost:3000/admin.html` | Control maestro para lanzar preguntas, calificar respuestas y gestionar eliminaciones. |

---

## 🛠️ Instalación y Uso

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/nosedimetuXD/QQSI.git
   cd QQSI
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Iniciar el servidor**:
   - En Windows: Doble clic en `start.bat` o:
   ```bash
   npm start
   ```

4. **Conexión en Red Local (Wi-Fi)**:
   Al iniciar, la consola mostrará la dirección IP local (ej. `http://192.168.1.50:3000`) para que los equipos participantes se conecten directamente desde sus teléfonos celulares en la misma red.
