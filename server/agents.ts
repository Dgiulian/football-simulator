import {
  Action,
  EpisodeOutcome,
  Hyperparameters,
  BallState,
  GoalkeeperState,
  DEFAULT_LEARNING_RATE,
  DEFAULT_DISCOUNT_FACTOR,
  DEFAULT_EPSILON,
  DEFAULT_EPSILON_DECAY,
  DEFAULT_EPSILON_MIN,
  HORIZONTAL_OFFSET_BUCKETS,
  VERTICAL_DISTANCE_BUCKETS,
  SPEED_BUCKETS,
  CANVAS_HEIGHT,
  GOAL_Y,
  GOALKEEPER_HEIGHT
} from '../shared/types';

// ============================================================
// BASE AGENT INTERFACE
// ============================================================

export interface AgentConfig {
  name: string;
  type: 'qlearning' | 'rulebased' | 'random';
  description?: string;
}

export interface AgentState {
  totalEpisodes: number;
  totalReward: number;
  saveCount: number;
  goalCount: number;
  missCount: number;
  currentEpsilon?: number;
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected state: AgentState;
  protected lastState: string | null = null;
  protected lastAction: Action | null = null;
  protected contactMade: boolean = false;

  constructor(config: AgentConfig) {
    this.config = config;
    this.state = {
      totalEpisodes: 0,
      totalReward: 0,
      saveCount: 0,
      goalCount: 0,
      missCount: 0
    };
  }

  abstract getAction(ball: BallState, goalkeeper: GoalkeeperState, isTraining: boolean): Action;
  abstract learn(outcome: EpisodeOutcome): number;
  abstract reset(): void;
  abstract getStateKey(ball: BallState, goalkeeper: GoalkeeperState): string;

  getConfig(): AgentConfig {
    return { ...this.config };
  }

  getState(): AgentState {
    return { ...this.state };
  }

  getName(): string {
    return this.config.name;
  }

  setContactMade(): void {
    this.contactMade = true;
  }

  hasContactBeenMade(): boolean {
    return this.contactMade;
  }

  storeTransition(state: string, action: Action): void {
    this.lastState = state;
    this.lastAction = action;
    this.contactMade = false;
  }

  updateStats(outcome: EpisodeOutcome, reward: number): void {
    this.state.totalEpisodes++;
    this.state.totalReward += reward;
    
    switch (outcome) {
      case EpisodeOutcome.SAVE:
        this.state.saveCount++;
        break;
      case EpisodeOutcome.GOAL:
        this.state.goalCount++;
        break;
      case EpisodeOutcome.MISS:
        this.state.missCount++;
        break;
    }
  }

  getSavePercentage(): number {
    const totalShots = this.state.saveCount + this.state.goalCount;
    return totalShots > 0 ? (this.state.saveCount / totalShots) * 100 : 0;
  }

  protected discretizeValue(value: number, buckets: number[]): number {
    for (let i = 0; i < buckets.length; i++) {
      if (value <= buckets[i]) {
        return i;
      }
    }
    return buckets.length;
  }
}

// ============================================================
// Q-LEARNING AGENT
// ============================================================

export interface QTable {
  [state: string]: number[];
}

interface Transition {
  state: string;
  action: Action;
  reward: number;
  nextState: string | null;
  done: boolean;
}

class ReplayBuffer {
  private buffer: Transition[] = [];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  add(transition: Transition): void {
    this.buffer.push(transition);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  sample(batchSize: number): Transition[] {
    if (this.buffer.length < batchSize) {
      return [...this.buffer];
    }
    const shuffled = [...this.buffer].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, batchSize);
  }

  size(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer = [];
  }
}

export interface QLearningConfig extends AgentConfig {
  type: 'qlearning';
  hyperparameters?: Partial<Hyperparameters>;
  useReplayBuffer?: boolean;
  replayBufferSize?: number;
  batchSize?: number;
}

export class QLearningAgent extends BaseAgent {
  private qTable: QTable = {};
  private hyperparams: Hyperparameters;
  private replayBuffer: ReplayBuffer;
  private batchSize: number;
  private useReplay: boolean;

  constructor(config: QLearningConfig) {
    super(config);
    
    this.hyperparams = {
      learningRate: config.hyperparameters?.learningRate ?? DEFAULT_LEARNING_RATE,
      discountFactor: config.hyperparameters?.discountFactor ?? DEFAULT_DISCOUNT_FACTOR,
      epsilon: config.hyperparameters?.epsilon ?? DEFAULT_EPSILON,
      epsilonDecay: config.hyperparameters?.epsilonDecay ?? DEFAULT_EPSILON_DECAY,
      epsilonMin: config.hyperparameters?.epsilonMin ?? DEFAULT_EPSILON_MIN
    };

    this.useReplay = config.useReplayBuffer ?? true;
    this.batchSize = config.batchSize ?? 32;
    this.replayBuffer = new ReplayBuffer(config.replayBufferSize ?? 1000);
  }

  getStateKey(ball: BallState, goalkeeper: GoalkeeperState): string {
    const hOffset = ball.x - goalkeeper.x;
    const vDist = GOAL_Y - ball.y;
    const ballSpeed = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2);

    const hBucket = this.discretizeValue(hOffset, HORIZONTAL_OFFSET_BUCKETS);
    const vBucket = this.discretizeValue(vDist, VERTICAL_DISTANCE_BUCKETS);
    const speedBucket = this.discretizeValue(ballSpeed, SPEED_BUCKETS);

    return `h:${hBucket}|v:${vBucket}|s:${speedBucket}`;
  }

  getAction(ball: BallState, goalkeeper: GoalkeeperState, isTraining: boolean): Action {
    const state = this.getStateKey(ball, goalkeeper);
    
    if (!this.qTable[state]) {
      this.qTable[state] = [0, 0, 0, 0];
    }

    // Store transition for replay buffer
    if (this.lastState !== null && this.lastAction !== null) {
      this.replayBuffer.add({
        state: this.lastState,
        action: this.lastAction,
        reward: 0,
        nextState: state,
        done: false
      });
    }

    this.lastState = state;

    if (isTraining && Math.random() < this.hyperparams.epsilon) {
      this.lastAction = Math.floor(Math.random() * 4) as Action;
    } else {
      const qValues = this.qTable[state];
      let bestAction = Action.MOVE_LEFT;
      let bestValue = qValues[0];
      
      for (let i = 1; i < 4; i++) {
        if (qValues[i] > bestValue) {
          bestValue = qValues[i];
          bestAction = i as Action;
        }
      }
      
      this.lastAction = bestAction;
    }

    return this.lastAction;
  }

  learn(outcome: EpisodeOutcome): number {
    if (this.lastState === null || this.lastAction === null) {
      return 0;
    }

    // Calculate reward
    let reward = 0;
    switch (outcome) {
      case EpisodeOutcome.SAVE:
        reward = 1.0;
        break;
      case EpisodeOutcome.GOAL:
        reward = -1.0;
        break;
      case EpisodeOutcome.MISS:
        reward = 0.1;
        break;
    }

    if (this.contactMade) {
      reward += 0.1;
    }
    reward -= 0.01;

    // Add to replay buffer
    this.replayBuffer.add({
      state: this.lastState,
      action: this.lastAction,
      reward: reward,
      nextState: null,
      done: true
    });

    // Experience replay update
    if (this.useReplay) {
      const batch = this.replayBuffer.sample(this.batchSize);
      
      for (const transition of batch) {
        if (!this.qTable[transition.state]) {
          this.qTable[transition.state] = [0, 0, 0, 0];
        }

        let targetQ: number;
        if (transition.done || transition.nextState === null) {
          targetQ = transition.reward;
        } else {
          const nextQValues = this.qTable[transition.nextState] || [0, 0, 0, 0];
          const maxNextQ = Math.max(...nextQValues);
          targetQ = transition.reward + this.hyperparams.discountFactor * maxNextQ;
        }

        const currentQ = this.qTable[transition.state][transition.action];
        const newQ = currentQ + this.hyperparams.learningRate * (targetQ - currentQ);
        this.qTable[transition.state][transition.action] = newQ;
      }
    } else {
      // Simple Q-learning without replay
      const currentQ = this.qTable[this.lastState][this.lastAction];
      const newQ = currentQ + this.hyperparams.learningRate * (reward - currentQ);
      this.qTable[this.lastState][this.lastAction] = newQ;
    }

    // Decay epsilon
    if (this.hyperparams.epsilon > this.hyperparams.epsilonMin) {
      this.hyperparams.epsilon *= this.hyperparams.epsilonDecay;
    }

    this.updateStats(outcome, reward);
    this.state.currentEpsilon = this.hyperparams.epsilon;

    return reward;
  }

  reset(): void {
    this.qTable = {};
    this.hyperparams.epsilon = DEFAULT_EPSILON;
    this.lastState = null;
    this.lastAction = null;
    this.contactMade = false;
    this.replayBuffer.clear();
    this.state = {
      totalEpisodes: 0,
      totalReward: 0,
      saveCount: 0,
      goalCount: 0,
      missCount: 0
    };
  }

  getQTable(): QTable {
    return { ...this.qTable };
  }

  getHyperparameters(): Hyperparameters {
    return { ...this.hyperparams };
  }

  getEpsilon(): number {
    return this.hyperparams.epsilon;
  }

  getReplayBufferSize(): number {
    return this.replayBuffer.size();
  }

  clearReplayBuffer(): void {
    this.replayBuffer.clear();
  }

  getQTableHeatmap(): { state: string; actions: number[]; bestAction: Action; bestValue: number }[] {
    const heatmapData: { state: string; actions: number[]; bestAction: Action; bestValue: number }[] = [];
    
    for (const [state, qValues] of Object.entries(this.qTable)) {
      let bestAction = Action.MOVE_LEFT;
      let bestValue = qValues[0];
      
      for (let i = 1; i < 4; i++) {
        if (qValues[i] > bestValue) {
          bestValue = qValues[i];
          bestAction = i as Action;
        }
      }
      
      heatmapData.push({ state, actions: [...qValues], bestAction, bestValue });
    }
    
    return heatmapData.sort((a, b) => b.bestValue - a.bestValue);
  }

  getCurrentStateQValues(state: string): number[] | null {
    return this.qTable[state] || null;
  }

  saveToFile(): string {
    return JSON.stringify({
      hyperparameters: this.hyperparams,
      qTable: this.qTable,
      config: this.config
    }, null, 2);
  }

  loadFromFile(data: string): void {
    const parsed = JSON.parse(data);
    if (parsed.hyperparameters) {
      this.hyperparams = { ...this.hyperparams, ...parsed.hyperparameters };
    }
    if (parsed.qTable) {
      this.qTable = parsed.qTable;
    }
  }
}

// ============================================================
// RULE-BASED AGENT (For Comparison)
// ============================================================

export interface RuleBasedConfig extends AgentConfig {
  type: 'rulebased';
  reactionTime?: number; // Frames delay before reacting
  predictionEnabled?: boolean;
}

export class RuleBasedAgent extends BaseAgent {
  private reactionTime: number;
  private predictionEnabled: boolean;
  private frameCounter: number = 0;
  private lastBallX: number = 0;
  private lastBallY: number = 0;

  constructor(config: RuleBasedConfig) {
    super(config);
    this.reactionTime = config.reactionTime ?? 0;
    this.predictionEnabled = config.predictionEnabled ?? true;
  }

  getStateKey(ball: BallState, goalkeeper: GoalkeeperState): string {
    // Rule-based agent doesn't use state keys, but we implement for interface
    return `ball:(${Math.round(ball.x)},${Math.round(ball.y)})_gk:(${Math.round(goalkeeper.x)})`;
  }

  getAction(ball: BallState, goalkeeper: GoalkeeperState, isTraining: boolean): Action {
    this.frameCounter++;

    // Calculate ball trajectory
    const ballVX = ball.x - this.lastBallX;
    const ballVY = ball.y - this.lastBallY;
    this.lastBallX = ball.x;
    this.lastBallY = ball.y;

    // Simple reaction delay
    if (this.frameCounter < this.reactionTime) {
      return Action.MOVE_LEFT; // Default wait action
    }

    const horizontalOffset = ball.x - goalkeeper.x;
    const verticalDistance = GOAL_Y - ball.y;
    const ballSpeed = Math.sqrt(ballVX * ballVX + ballVY * ballVY);

    // If ball is close and fast, dive
    if (verticalDistance < 100 && ballSpeed > 8) {
      if (horizontalOffset < -10) return Action.DIVE_LEFT;
      if (horizontalOffset > 10) return Action.DIVE_RIGHT;
    }

    // If ball is far, move toward predicted position
    if (this.predictionEnabled && verticalDistance > 50) {
      // Predict where ball will cross goal line
      const timeToGoal = verticalDistance / Math.abs(ballVY || 1);
      const predictedX = ball.x + ballVX * timeToGoal;
      
      const predictedOffset = predictedX - goalkeeper.x;
      
      if (predictedOffset < -20) return Action.MOVE_LEFT;
      if (predictedOffset > 20) return Action.MOVE_RIGHT;
    } else {
      // No prediction, just move toward current ball position
      if (horizontalOffset < -15) return Action.MOVE_LEFT;
      if (horizontalOffset > 15) return Action.MOVE_RIGHT;
    }

    // Stay in place if aligned
    return Action.MOVE_LEFT;
  }

  learn(outcome: EpisodeOutcome): number {
    // Rule-based agent doesn't learn
    let reward = 0;
    switch (outcome) {
      case EpisodeOutcome.SAVE: reward = 1.0; break;
      case EpisodeOutcome.GOAL: reward = -1.0; break;
      case EpisodeOutcome.MISS: reward = 0.1; break;
    }
    
    this.updateStats(outcome, reward);
    return reward;
  }

  reset(): void {
    this.frameCounter = 0;
    this.lastBallX = 0;
    this.lastBallY = 0;
    this.state = {
      totalEpisodes: 0,
      totalReward: 0,
      saveCount: 0,
      goalCount: 0,
      missCount: 0
    };
  }
}

// ============================================================
// RANDOM AGENT (For Baseline)
// ============================================================

export class RandomAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({ ...config, type: 'random' });
  }

  getStateKey(ball: BallState, goalkeeper: GoalkeeperState): string {
    return 'random';
  }

  getAction(ball: BallState, goalkeeper: GoalkeeperState, isTraining: boolean): Action {
    return Math.floor(Math.random() * 4) as Action;
  }

  learn(outcome: EpisodeOutcome): number {
    let reward = 0;
    switch (outcome) {
      case EpisodeOutcome.SAVE: reward = 1.0; break;
      case EpisodeOutcome.GOAL: reward = -1.0; break;
      case EpisodeOutcome.MISS: reward = 0.1; break;
    }
    
    this.updateStats(outcome, reward);
    return reward;
  }

  reset(): void {
    this.state = {
      totalEpisodes: 0,
      totalReward: 0,
      saveCount: 0,
      goalCount: 0,
      missCount: 0
    };
  }
}

// ============================================================
// AGENT PRESETS
// ============================================================

export const AgentPresets = {
  // Q-Learning presets
  balancedQLearning: (): QLearningConfig => ({
    name: 'Balanced Q-Learner',
    type: 'qlearning',
    description: 'Standard Q-learning with moderate exploration',
    hyperparameters: {
      learningRate: 0.2,
      discountFactor: 0.95,
      epsilon: 1.0,
      epsilonDecay: 0.995,
      epsilonMin: 0.01
    },
    useReplayBuffer: true,
    replayBufferSize: 1000,
    batchSize: 32
  }),

  aggressiveQLearning: (): QLearningConfig => ({
    name: 'Aggressive Q-Learner',
    type: 'qlearning',
    description: 'Fast learning, less exploration',
    hyperparameters: {
      learningRate: 0.3,
      discountFactor: 0.97,
      epsilon: 1.0,
      epsilonDecay: 0.998,
      epsilonMin: 0.05
    },
    useReplayBuffer: true,
    replayBufferSize: 1000,
    batchSize: 32
  }),

  cautiousQLearning: (): QLearningConfig => ({
    name: 'Cautious Q-Learner',
    type: 'qlearning',
    description: 'Conservative learning with high exploration',
    hyperparameters: {
      learningRate: 0.1,
      discountFactor: 0.9,
      epsilon: 1.0,
      epsilonDecay: 0.99,
      epsilonMin: 0.1
    },
    useReplayBuffer: true,
    replayBufferSize: 2000,
    batchSize: 64
  }),

  // Rule-based presets
  perfectGoalkeeper: (): RuleBasedConfig => ({
    name: 'Perfect Goalkeeper',
    type: 'rulebased',
    description: 'Rule-based with perfect reaction and prediction',
    reactionTime: 0,
    predictionEnabled: true
  }),

  slowGoalkeeper: (): RuleBasedConfig => ({
    name: 'Slow Goalkeeper',
    type: 'rulebased',
    description: 'Rule-based with delayed reaction (human-like)',
    reactionTime: 10,
    predictionEnabled: true
  }),

  noPredictionGoalkeeper: (): RuleBasedConfig => ({
    name: 'No-Prediction Goalkeeper',
    type: 'rulebased',
    description: 'Only reacts to current ball position',
    reactionTime: 5,
    predictionEnabled: false
  }),

  // Random baseline
  randomAgent: (): AgentConfig => ({
    name: 'Random Agent',
    type: 'random',
    description: 'Random actions for baseline comparison'
  })
};

// ============================================================
// AGENT FACTORY
// ============================================================

export class AgentFactory {
  static createAgent(config: AgentConfig): BaseAgent {
    switch (config.type) {
      case 'qlearning':
        return new QLearningAgent(config as QLearningConfig);
      case 'rulebased':
        return new RuleBasedAgent(config as RuleBasedConfig);
      case 'random':
        return new RandomAgent(config);
      default:
        throw new Error(`Unknown agent type: ${config.type}`);
    }
  }

  static createFromPreset(presetName: keyof typeof AgentPresets): BaseAgent {
    const config = AgentPresets[presetName]();
    return AgentFactory.createAgent(config);
  }
}

// ============================================================
// MULTI-AGENT MANAGER
// ============================================================

export class MultiAgentManager {
  private agents: Map<string, BaseAgent> = new Map();
  private activeAgentId: string | null = null;

  registerAgent(id: string, agent: BaseAgent): void {
    this.agents.set(id, agent);
    if (this.activeAgentId === null) {
      this.activeAgentId = id;
    }
  }

  unregisterAgent(id: string): boolean {
    const deleted = this.agents.delete(id);
    if (this.activeAgentId === id) {
      const remaining = Array.from(this.agents.keys());
      this.activeAgentId = remaining.length > 0 ? remaining[0] : null;
    }
    return deleted;
  }

  setActiveAgent(id: string): boolean {
    if (this.agents.has(id)) {
      this.activeAgentId = id;
      return true;
    }
    return false;
  }

  getActiveAgent(): BaseAgent | null {
    if (this.activeAgentId === null) return null;
    return this.agents.get(this.activeAgentId) || null;
  }

  getAgent(id: string): BaseAgent | null {
    return this.agents.get(id) || null;
  }

  getAllAgents(): { id: string; agent: BaseAgent }[] {
    return Array.from(this.agents.entries()).map(([id, agent]) => ({ id, agent }));
  }

  getLeaderboard(): { id: string; agent: BaseAgent; savePercentage: number }[] {
    return this.getAllAgents()
      .map(({ id, agent }) => ({
        id,
        agent,
        savePercentage: agent.getSavePercentage()
      }))
      .sort((a, b) => b.savePercentage - a.savePercentage);
  }

  resetAll(): void {
    this.agents.forEach(agent => agent.reset());
  }

  clear(): void {
    this.agents.clear();
    this.activeAgentId = null;
  }
}

// ============================================================
// EXPORTS
// ============================================================

export { ReplayBuffer };
