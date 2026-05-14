import * as WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import {
  GameState,
  GameMode,
  EpisodeOutcome,
  TrainingStats,
  ServerMessage,
  ClientMessage,
  BallState,
  RobotState,
  GoalkeeperState,
  Hyperparameters
} from '../shared/types';
import {
  createBall,
  createRobot,
  createGoalkeeper,
  resetBall,
  resetRobot,
  resetGoalkeeper,
  updateBall,
  checkGoal,
  checkBallCollision,
  executeAction,
  updateGoalkeeper
} from './physics';
import { QLearningAgent } from './qlearning';

const PORT = 3001;
const SAVE_INTERVAL = 100;
const MODELS_DIR = path.join(__dirname, '..', 'models');

class FootballServer {
  private wss: WebSocket.Server;
  private clients: Set<WebSocket> = new Set();
  
  private ball: BallState;
  private robot: RobotState;
  private goalkeeper: GoalkeeperState;
  private mode: GameMode = GameMode.TRAINING;
  private isRunning: boolean = false;
  private speedMultiplier: number = 1;
  private episodeFrameCount: number = 0;
  
  private agent: QLearningAgent;
  
  private stats: TrainingStats = {
    totalEpisodes: 0,
    saves: 0,
    goals: 0,
    misses: 0,
    savePercentage: 0,
    currentEpsilon: 1.0,
    averageReward: 0,
    bestStreak: 0,
    currentStreak: 0,
    trainingTime: 0
  };
  private recentRewards: number[] = [];
  private startTime: number = Date.now();

  constructor() {
    this.ball = createBall();
    this.robot = createRobot();
    this.goalkeeper = createGoalkeeper();
    
    this.agent = new QLearningAgent();
    
    if (!fs.existsSync(MODELS_DIR)) {
      fs.mkdirSync(MODELS_DIR, { recursive: true });
    }
    
    this.loadLatestModel();
    
    this.wss = new WebSocket.Server({ port: PORT });
    this.setupWebSocket();
    
    console.log(`Server started on ws://localhost:${PORT}`);
    
    this.startGameLoop();
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('Client connected');
      this.clients.add(ws);
      
      this.broadcastState();
      this.broadcastStats();
      
      ws.on('message', (message: string) => {
        try {
          const msg: ClientMessage = JSON.parse(message.toString());
          this.handleClientMessage(msg);
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      });
      
      ws.on('close', () => {
        console.log('Client disconnected');
        this.clients.delete(ws);
      });
    });
  }

  private handleClientMessage(msg: ClientMessage): void {
    switch (msg.type) {
      case 'toggle_training':
        this.isRunning = !this.isRunning;
        console.log(`Training ${this.isRunning ? 'started' : 'paused'}`);
        break;
        
      case 'reset_agent':
        this.agent.reset();
        this.resetStats();
        console.log('Agent reset');
        this.broadcastStats();
        break;
        
      case 'update_params':
        if (msg.data) {
          this.agent.updateHyperparameters(msg.data);
          console.log('Hyperparameters updated:', msg.data);
        }
        break;
        
      case 'set_speed':
        if (msg.data && typeof msg.data.speed === 'number') {
          this.speedMultiplier = msg.data.speed;
          console.log(`Speed set to ${this.speedMultiplier}x`);
        }
        break;
        
      case 'set_mode':
        if (msg.data && msg.data.mode) {
          this.mode = msg.data.mode as GameMode;
          console.log(`Mode set to ${this.mode}`);
        }
        break;
    }
  }

  private resetStats(): void {
    this.stats = {
      totalEpisodes: 0,
      saves: 0,
      goals: 0,
      misses: 0,
      savePercentage: 0,
      currentEpsilon: 1.0,
      averageReward: 0,
      bestStreak: 0,
      currentStreak: 0,
      trainingTime: 0
    };
    this.recentRewards = [];
    this.startTime = Date.now();
    this.episodeFrameCount = 0;
  }

  private startGameLoop(): void {
    const targetFPS = 60;
    const frameInterval = 1000 / targetFPS;
    
    let lastTime = Date.now();
    
    const loop = () => {
      const now = Date.now();
      const deltaTime = now - lastTime;
      
      if (deltaTime >= frameInterval) {
        lastTime = now - (deltaTime % frameInterval);
        
        for (let i = 0; i < this.speedMultiplier; i++) {
          this.update();
        }
        
        this.stats.trainingTime = Math.floor((Date.now() - this.startTime) / 1000);
        
        if (this.speedMultiplier === 1 || now % 3 === 0) {
          this.broadcastState();
        }
      }
      
      setImmediate(loop);
    };
    
    loop();
  }

  private update(): void {
    if (!this.isRunning) return;

    this.episodeFrameCount++;

    const state = this.agent.getStateKey(this.ball, this.goalkeeper);
    const action = this.agent.getAction(state, this.mode === GameMode.TRAINING);

    this.agent.storeTransition(state, action);

    executeAction(this.goalkeeper, action);

    updateGoalkeeper(this.goalkeeper);
    const ballStopped = updateBall(this.ball);

    if (checkBallCollision(this.ball, this.goalkeeper)) {
      this.agent.setContactMade();
      // Debug: log contact (throttled)
      if (this.stats.totalEpisodes % 10 === 0) {
        console.log(`  -> Ball contact! Ball@(${this.ball.x.toFixed(1)},${this.ball.y.toFixed(1)}) GK@(${this.goalkeeper.x.toFixed(1)},${this.goalkeeper.y.toFixed(1)})`);
      }
    }

    const outcome = checkGoal(this.ball);

    if (outcome || ballStopped) {
      // Determine final outcome
      let finalOutcome: EpisodeOutcome;
      if (outcome) {
        // If ball hit goalkeeper and didn't score, it's a save
        if (outcome === EpisodeOutcome.GOAL) {
          finalOutcome = EpisodeOutcome.GOAL;
        } else {
          // It's a miss - check if goalkeeper made contact
          finalOutcome = this.agent.hasContactBeenMade() ? EpisodeOutcome.SAVE : EpisodeOutcome.MISS;
        }
      } else {
        // Ball stopped - check if goalkeeper made contact
        finalOutcome = this.agent.hasContactBeenMade() ? EpisodeOutcome.SAVE : EpisodeOutcome.MISS;
      }
      this.endEpisode(finalOutcome);
    }
  }

  private endEpisode(outcome: EpisodeOutcome): void {
    const reward = this.agent.learn(outcome);

    // Debug logging every 100 episodes
    const contactMade = this.agent.hasContactBeenMade();
    if (this.stats.totalEpisodes % 100 === 0) {
      console.log(`Episode ${this.stats.totalEpisodes}: outcome=${outcome}, reward=${reward.toFixed(2)}, contact=${contactMade}, epsilon=${this.agent.getEpsilon().toFixed(3)}`);
    }

    this.stats.totalEpisodes++;
    this.recentRewards.push(reward);
    if (this.recentRewards.length > 100) {
      this.recentRewards.shift();
    }

    switch (outcome) {
      case EpisodeOutcome.SAVE:
        this.stats.saves++;
        this.stats.currentStreak++;
        if (this.stats.currentStreak > this.stats.bestStreak) {
          this.stats.bestStreak = this.stats.currentStreak;
        }
        break;
      case EpisodeOutcome.GOAL:
        this.stats.goals++;
        this.stats.currentStreak = 0;
        break;
      case EpisodeOutcome.MISS:
        this.stats.misses++;
        this.stats.currentStreak = 0;
        break;
    }
    
    const totalShots = this.stats.saves + this.stats.goals;
    this.stats.savePercentage = totalShots > 0 
      ? (this.stats.saves / totalShots) * 100 
      : 0;
    
    this.stats.averageReward = this.recentRewards.length > 0
      ? this.recentRewards.reduce((a, b) => a + b, 0) / this.recentRewards.length
      : 0;
    
    this.stats.currentEpsilon = this.agent.getEpsilon();
    
    this.broadcastMessage({
      type: 'episode_complete',
      data: { outcome, reward, episode: this.stats.totalEpisodes }
    });
    
    this.broadcastStats();
    
    if (this.stats.totalEpisodes % SAVE_INTERVAL === 0) {
      this.saveModel();
    }
    
    this.startNewEpisode();
  }

  private startNewEpisode(): void {
    resetRobot(this.robot);
    resetGoalkeeper(this.goalkeeper);
    resetBall(this.ball, this.robot);
    this.episodeFrameCount = 0;
  }

  private broadcastState(): void {
    const gameState: GameState = {
      ball: this.ball,
      robot: this.robot,
      goalkeeper: this.goalkeeper,
      episode: this.stats.totalEpisodes,
      mode: this.mode
    };
    
    this.broadcastMessage({
      type: 'game_state',
      data: gameState
    });
  }

  private broadcastStats(): void {
    this.broadcastMessage({
      type: 'training_stats',
      data: this.stats
    });
  }

  private broadcastMessage(msg: ServerMessage): void {
    const message = JSON.stringify(msg);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private saveModel(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `model-${timestamp}.json`;
    const filepath = path.join(MODELS_DIR, filename);
    
    fs.writeFileSync(filepath, this.agent.saveToFile());
    console.log(`Model saved: ${filename}`);
  }

  private loadLatestModel(): void {
    try {
      const files = fs.readdirSync(MODELS_DIR)
        .filter(f => f.startsWith('model-') && f.endsWith('.json'))
        .sort()
        .reverse();
      
      if (files.length > 0) {
        const filepath = path.join(MODELS_DIR, files[0]);
        const data = fs.readFileSync(filepath, 'utf-8');
        this.agent.loadFromFile(data);
        console.log(`Loaded model: ${files[0]}`);
      }
    } catch (err) {
      console.log('No existing model found, starting fresh');
    }
  }
}

new FootballServer();
