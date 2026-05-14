// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
let gameState = null;
let isRunning = false;
let currentMode = 'training';

// WebSocket connection
const ws = new WebSocket('ws://localhost:3001');

ws.onopen = () => {
  console.log('Connected to server');
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  switch (msg.type) {
    case 'game_state':
      gameState = msg.data;
      render();
      break;
    case 'episode_complete':
      showEpisodeResult(msg.data);
      break;
    case 'training_stats':
      updateStats(msg.data);
      break;
  }
};

ws.onclose = () => {
  console.log('Disconnected from server');
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

// Rendering functions
function render() {
  if (!gameState) return;
  
  // Clear canvas
  ctx.fillStyle = '#2d5a3d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw field markings
  drawFieldMarkings();
  
  // Draw goal
  drawGoal();
  
  // Draw robot
  drawRobot(gameState.robot);
  
  // Draw goalkeeper
  drawGoalkeeper(gameState.goalkeeper);
  
  // Draw ball
  drawBall(gameState.ball);
  
  // Draw trail
  drawBallTrail(gameState.ball);
}

function drawFieldMarkings() {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  
  // Center line
  ctx.beginPath();
  ctx.moveTo(0, 300);
  ctx.lineTo(800, 300);
  ctx.stroke();
  
  // Center circle
  ctx.beginPath();
  ctx.arc(400, 300, 50, 0, Math.PI * 2);
  ctx.stroke();
  
  // Goal area (6-yard box)
  ctx.strokeRect(300, 500, 200, 100);
}

function drawGoal() {
  // Goal posts
  ctx.fillStyle = '#fff';
  ctx.fillRect(295, 580, 5, 20);
  ctx.fillRect(500, 580, 5, 20);
  
  // Goal line
  ctx.fillStyle = '#fff';
  ctx.fillRect(300, 595, 200, 5);
  
  // Net pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 200; i += 10) {
    ctx.beginPath();
    ctx.moveTo(300 + i, 580);
    ctx.lineTo(300 + i, 600);
    ctx.stroke();
  }
}

function drawRobot(robot) {
  ctx.save();
  ctx.translate(robot.x, robot.y);
  ctx.rotate(robot.angle);
  
  // Body
  ctx.fillStyle = '#ff4444';
  ctx.fillRect(-20, -12, 40, 25);
  
  // Wheels
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(-15, -15, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(15, -15, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-15, 15, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(15, 15, 6, 0, Math.PI * 2);
  ctx.fill();
  
  // Shooter indicator
  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

function drawGoalkeeper(gk) {
  ctx.save();
  ctx.translate(gk.x, gk.y);
  
  if (gk.isDiving) {
    // Rotated dive shape
    ctx.rotate(gk.diveDirection > 0 ? Math.PI / 4 : -Math.PI / 4);
    ctx.fillStyle = '#4444ff';
    ctx.fillRect(-20, -15, 40, 30);
    
    // Arms extended
    ctx.fillStyle = '#6666ff';
    ctx.fillRect(-25, -5, 10, 10);
    ctx.fillRect(15, -5, 10, 10);
  } else {
    // Standing shape
    ctx.fillStyle = '#4444ff';
    ctx.fillRect(-15, -20, 30, 40);
    
    // Arms
    ctx.fillStyle = '#6666ff';
    ctx.fillRect(-20, -10, 8, 20);
    ctx.fillRect(12, -10, 8, 20);
  }
  
  ctx.restore();
}

function drawBall(ball) {
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  
  // Ball shine
  ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
  ctx.beginPath();
  ctx.arc(ball.x - 2, ball.y - 2, ball.radius * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

const ballTrail = [];
const MAX_TRAIL_LENGTH = 10;

function drawBallTrail(ball) {
  ballTrail.push({ x: ball.x, y: ball.y });
  if (ballTrail.length > MAX_TRAIL_LENGTH) {
    ballTrail.shift();
  }
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < ballTrail.length; i++) {
    if (i === 0) {
      ctx.moveTo(ballTrail[i].x, ballTrail[i].y);
    } else {
      ctx.lineTo(ballTrail[i].x, ballTrail[i].y);
    }
  }
  ctx.stroke();
}

// Stats update
function updateStats(stats) {
  document.getElementById('episodeCount').textContent = stats.totalEpisodes;
  document.getElementById('savePercentage').textContent = stats.savePercentage.toFixed(1) + '%';
  document.getElementById('savesCount').textContent = stats.saves;
  document.getElementById('goalsCount').textContent = stats.goals;
  document.getElementById('epsilonValue').textContent = stats.currentEpsilon.toFixed(3);
  document.getElementById('bestStreak').textContent = stats.bestStreak;
}

// Episode result flash
function showEpisodeResult(data) {
  const outcome = data.outcome;
  const color = outcome === 'save' ? '#4ecca3' : outcome === 'goal' ? '#e94560' : '#ffa500';
  const text = outcome === 'save' ? 'SAVE!' : outcome === 'goal' ? 'GOAL!' : 'MISS';
  
  const flash = document.createElement('div');
  flash.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 48px;
    font-weight: bold;
    color: ${color};
    text-shadow: 0 0 20px ${color};
    pointer-events: none;
    animation: fadeOut 1s ease-out forwards;
  `;
  flash.textContent = text;
  document.querySelector('.canvas-container').appendChild(flash);
  
  setTimeout(() => flash.remove(), 1000);
}

// CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeOut {
    0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(1.5); }
  }
`;
document.head.appendChild(style);

// Controls
const toggleBtn = document.getElementById('toggleBtn');
const resetBtn = document.getElementById('resetBtn');
const modeBtn = document.getElementById('modeBtn');
const modeIndicator = document.getElementById('modeIndicator');

const alphaSlider = document.getElementById('alphaSlider');
const gammaSlider = document.getElementById('gammaSlider');
const decaySlider = document.getElementById('decaySlider');

const speedBtns = document.querySelectorAll('.speed-btn');

// Toggle training
toggleBtn.addEventListener('click', () => {
  isRunning = !isRunning;
  toggleBtn.textContent = isRunning ? 'Pause Training' : 'Start Training';
  toggleBtn.className = isRunning ? 'btn-secondary' : 'btn-primary';
  
  ws.send(JSON.stringify({
    type: 'toggle_training'
  }));
});

// Reset agent
resetBtn.addEventListener('click', () => {
  if (confirm('Reset the agent? All learning progress will be lost.')) {
    ws.send(JSON.stringify({
      type: 'reset_agent'
    }));
    ballTrail.length = 0;
  }
});

// Toggle mode
modeBtn.addEventListener('click', () => {
  currentMode = currentMode === 'training' ? 'evaluation' : 'training';
  
  ws.send(JSON.stringify({
    type: 'set_mode',
    data: { mode: currentMode }
  }));
  
  if (currentMode === 'training') {
    modeBtn.textContent = 'Switch to Evaluation';
    modeIndicator.textContent = 'Training Mode';
    modeIndicator.className = 'mode-indicator mode-training';
  } else {
    modeBtn.textContent = 'Switch to Training';
    modeIndicator.textContent = 'Evaluation Mode';
    modeIndicator.className = 'mode-indicator mode-evaluation';
  }
});

// Hyperparameter sliders
alphaSlider.addEventListener('input', (e) => {
  document.getElementById('alphaValue').textContent = parseFloat(e.target.value).toFixed(2);
});

alphaSlider.addEventListener('change', (e) => {
  ws.send(JSON.stringify({
    type: 'update_params',
    data: { learningRate: parseFloat(e.target.value) }
  }));
});

gammaSlider.addEventListener('input', (e) => {
  document.getElementById('gammaValue').textContent = parseFloat(e.target.value).toFixed(2);
});

gammaSlider.addEventListener('change', (e) => {
  ws.send(JSON.stringify({
    type: 'update_params',
    data: { discountFactor: parseFloat(e.target.value) }
  }));
});

decaySlider.addEventListener('input', (e) => {
  document.getElementById('decayValue').textContent = parseFloat(e.target.value).toFixed(4);
});

decaySlider.addEventListener('change', (e) => {
  ws.send(JSON.stringify({
    type: 'update_params',
    data: { epsilonDecay: parseFloat(e.target.value) }
  }));
});

// Speed controls
speedBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    speedBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const speed = parseInt(btn.dataset.speed);
    ws.send(JSON.stringify({
      type: 'set_speed',
      data: { speed }
    }));
  });
});

// Initial render
render();
