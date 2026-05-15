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

// ============================================
// CHARTS
// ============================================

// Chart configuration
Chart.defaults.color = '#a0a0a0';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';

// Save Percentage Chart
const savePercentageCtx = document.getElementById('savePercentageChart').getContext('2d');
const savePercentageChart = new Chart(savePercentageCtx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'Save %',
      data: [],
      borderColor: '#4ecca3',
      backgroundColor: 'rgba(78, 204, 163, 0.1)',
      borderWidth: 2,
      tension: 0.4,
      fill: true
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: { font: { size: 10 } }
      },
      x: {
        ticks: { display: false }
      }
    }
  }
});

// Epsilon Chart
const epsilonCtx = document.getElementById('epsilonChart').getContext('2d');
const epsilonChart = new Chart(epsilonCtx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'Epsilon',
      data: [],
      borderColor: '#e94560',
      backgroundColor: 'rgba(233, 69, 96, 0.1)',
      borderWidth: 2,
      tension: 0.4,
      fill: true
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 1,
        ticks: { font: { size: 10 } }
      },
      x: {
        ticks: { display: false }
      }
    }
  }
});

// Reward Chart
const rewardCtx = document.getElementById('rewardChart').getContext('2d');
const rewardChart = new Chart(rewardCtx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'Avg Reward',
      data: [],
      borderColor: '#f9a825',
      backgroundColor: 'rgba(249, 168, 37, 0.1)',
      borderWidth: 2,
      tension: 0.4,
      fill: true
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: {
        ticks: { font: { size: 10 } }
      },
      x: {
        ticks: { display: false }
      }
    }
  }
});

// Outcomes Chart (Pie)
const outcomesCtx = document.getElementById('outcomesChart').getContext('2d');
const outcomesChart = new Chart(outcomesCtx, {
  type: 'doughnut',
  data: {
    labels: ['Saves', 'Goals', 'Misses'],
    datasets: [{
      data: [0, 0, 0],
      backgroundColor: ['#4ecca3', '#e94560', '#ffa500'],
      borderWidth: 0
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { font: { size: 10 }, boxWidth: 12 }
      }
    }
  }
});

// Update charts from graph data
function updateCharts(graphData) {
  // Update Save Percentage Chart
  savePercentageChart.data.labels = graphData.episodes.map(e => e.toString());
  savePercentageChart.data.datasets[0].data = graphData.savePercentages;
  savePercentageChart.update('none');

  // Update Epsilon Chart
  epsilonChart.data.labels = graphData.episodes.map(e => e.toString());
  epsilonChart.data.datasets[0].data = graphData.epsilons;
  epsilonChart.update('none');

  // Update Reward Chart
  rewardChart.data.labels = graphData.episodes.map(e => e.toString());
  rewardChart.data.datasets[0].data = graphData.averageRewards;
  rewardChart.update('none');

  // Update Outcomes Chart
  if (graphData.saves.length > 0) {
    const lastIdx = graphData.saves.length - 1;
    outcomesChart.data.datasets[0].data = [
      graphData.saves[lastIdx],
      graphData.goals[lastIdx],
      graphData.misses[lastIdx]
    ];
    outcomesChart.update();
  }
}

// Request graph data from server
function requestGraphData() {
  ws.send(JSON.stringify({ type: 'get_graph_data' }));
}

// Handle graph data message
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
    case 'graph_data':
      updateCharts(msg.data);
      break;
    case 'qtable_heatmap':
      renderHeatmap(msg.data);
      break;
    case 'current_qvalues':
      renderCurrentQValues(msg.data);
      break;
  }
};

// Refresh charts button
document.getElementById('refreshChartsBtn').addEventListener('click', requestGraphData);

// Request graph data periodically (every 5 seconds)
setInterval(requestGraphData, 5000);

// Initial request
setTimeout(requestGraphData, 1000);

// ============================================
// Q-TABLE HEATMAP
// ============================================

// Action colors for heatmap
const actionColors = {
  0: '#2196f3', // Move Left - Blue
  1: '#4caf50', // Move Right - Green
  2: '#ff9800', // Dive Left - Orange
  3: '#f44336'  // Dive Right - Red
};

const actionNames = ['←', '→', '🤿L', '🤿R'];

// Render Q-table heatmap
function renderHeatmap(heatmapData) {
  const grid = document.getElementById('heatmapGrid');
  grid.innerHTML = '';
  
  // Show top 25 most confident states
  const topStates = heatmapData.slice(0, 25);
  
  topStates.forEach(stateData => {
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    
    // Color based on best action
    const baseColor = actionColors[stateData.bestAction];
    
    // Opacity based on confidence (bestValue)
    // Normalize: assuming Q-values range from -2 to +2
    const normalizedValue = Math.max(0, Math.min(1, (stateData.bestValue + 2) / 4));
    
    cell.style.backgroundColor = baseColor;
    cell.style.opacity = 0.3 + (normalizedValue * 0.7);
    cell.textContent = actionNames[stateData.bestAction];
    cell.title = `${stateData.state}\nQ-values: ${stateData.actions.map((v, i) => `${actionNames[i]}:${v.toFixed(2)}`).join(', ')}`;
    
    grid.appendChild(cell);
  });
}

// Render current Q-values bar
function renderCurrentQValues(data) {
  const bar = document.getElementById('qvaluesBar');
  bar.innerHTML = '';
  
  if (!data.qValues) {
    bar.innerHTML = '<div style="text-align:center; color:#666; font-size:12px;">No Q-values yet</div>';
    return;
  }
  
  // Find min and max for normalization
  const minQ = Math.min(...data.qValues);
  const maxQ = Math.max(...data.qValues);
  const range = maxQ - minQ || 1;
  
  data.qValues.forEach((qValue, index) => {
    const segment = document.createElement('div');
    segment.className = 'qvalue-segment';
    
    // Width proportional to Q-value (normalized)
    const normalizedWidth = ((qValue - minQ) / range) * 100;
    segment.style.width = `${Math.max(10, normalizedWidth)}%`;
    
    // Color based on action
    segment.style.backgroundColor = actionColors[index];
    
    // Highlight best action
    if (index === data.bestAction) {
      segment.style.boxShadow = '0 0 10px #fff';
      segment.style.zIndex = '10';
    }
    
    segment.textContent = qValue.toFixed(2);
    segment.title = `${data.actionNames[index]}: ${qValue.toFixed(3)}`;
    
    bar.appendChild(segment);
  });
}

// Request Q-table heatmap
function requestHeatmap() {
  ws.send(JSON.stringify({ type: 'get_qtable_heatmap' }));
}

// Request current Q-values
function requestCurrentQValues() {
  ws.send(JSON.stringify({ type: 'get_current_qvalues' }));
}

// Request heatmap periodically (every 10 seconds)
setInterval(requestHeatmap, 10000);

// Request current Q-values frequently (every 500ms)
setInterval(requestCurrentQValues, 500);

// Initial requests
setTimeout(requestHeatmap, 2000);
setTimeout(requestCurrentQValues, 1500);

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', (e) => {
  // Ignore if user is typing in an input
  if (e.target.tagName === 'INPUT') return;
  
  switch(e.key.toLowerCase()) {
    case ' ':
      e.preventDefault();
      document.getElementById('toggleBtn').click();
      break;
    case 'r':
      if (confirm('Reset the agent? All progress will be lost.')) {
        document.getElementById('resetBtn').click();
      }
      break;
    case 'm':
      document.getElementById('modeBtn').click();
      break;
    case '1':
      setSpeed(1);
      break;
    case '2':
      setSpeed(5);
      break;
    case '3':
      setSpeed(10);
      break;
    case 'c':
      // Toggle charts visibility
      const charts = document.querySelector('.charts-container');
      const qtable = document.querySelector('.qtable-panel');
      const isHidden = charts.style.display === 'none';
      charts.style.display = isHidden ? 'grid' : 'none';
      qtable.style.display = isHidden ? 'block' : 'none';
      break;
  }
});

function setSpeed(speed) {
  // Update UI
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.speed) === speed);
  });
  
  // Send to server
  ws.send(JSON.stringify({
    type: 'set_speed',
    data: { speed }
  }));
}

// Add keyboard shortcut help tooltip
const helpTooltip = document.createElement('div');
helpTooltip.style.cssText = `
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(0,0,0,0.8);
  color: #fff;
  padding: 15px;
  border-radius: 8px;
  font-size: 12px;
  font-family: monospace;
  z-index: 1000;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
`;
helpTooltip.innerHTML = `
  <strong>Keyboard Shortcuts:</strong><br>
  Space - Start/Pause<br>
  R - Reset Agent<br>
  M - Toggle Mode<br>
  1/2/3 - Speed 1x/5x/10x<br>
  C - Toggle Charts<br>
  H - Show/Hide Help
`;
document.body.appendChild(helpTooltip);

// Show help on 'H' key
document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'h') {
    helpTooltip.style.opacity = helpTooltip.style.opacity === '1' ? '0' : '1';
  }
});

// Show help briefly on load
setTimeout(() => { helpTooltip.style.opacity = '1'; }, 1000);
setTimeout(() => { helpTooltip.style.opacity = '0'; }, 6000);
