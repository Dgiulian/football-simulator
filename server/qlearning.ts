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

export interface QTable {
  [state: string]: number[]; // Array of Q-values for each action
}

// Experience Replay Buffer
interface Transition {
  state: string;
  action: Action;
  reward: number;
  nextState: string | null; // null for terminal states
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
      this.buffer.shift(); // Remove oldest
    }
  }

  sample(batchSize: number): Transition[] {
    if (this.buffer.length < batchSize) {
      return [...this.buffer];
    }
    
    // Random sampling without replacement
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

export class QLearningAgent {
  private qTable: QTable = {};
  private hyperparams: Hyperparameters;
  private lastState: string | null = null;
  private lastAction: Action | null = null;
  private contactMade: boolean = false;
  private replayBuffer: ReplayBuffer;
  private batchSize: number = 32;

  constructor(hyperparams?: Partial<Hyperparameters>) {
    this.hyperparams = {
      learningRate: hyperparams?.learningRate ?? DEFAULT_LEARNING_RATE,
      discountFactor: hyperparams?.discountFactor ?? DEFAULT_DISCOUNT_FACTOR,
      epsilon: hyperparams?.epsilon ?? DEFAULT_EPSILON,
      epsilonDecay: hyperparams?.epsilonDecay ?? DEFAULT_EPSILON_DECAY,
      epsilonMin: hyperparams?.epsilonMin ?? DEFAULT_EPSILON_MIN
    };
    this.replayBuffer = new ReplayBuffer(1000);
  }

  private discretizeValue(value: number, buckets: number[]): number {
    for (let i = 0; i < buckets.length; i++) {
      if (value <= buckets[i]) {
        return i;
      }
    }
    return buckets.length;
  }

  getStateKey(ball: BallState, goalkeeper: GoalkeeperState): string {
    // Calculate relative features
    const hOffset = ball.x - goalkeeper.x;
    const vDist = GOAL_Y - ball.y;
    const ballSpeed = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2);
    
    // Discretize - SIMPLE: only 5×3×3 = 45 states
    const hBucket = this.discretizeValue(hOffset, HORIZONTAL_OFFSET_BUCKETS);
    const vBucket = this.discretizeValue(vDist, VERTICAL_DISTANCE_BUCKETS);
    const speedBucket = this.discretizeValue(ballSpeed, SPEED_BUCKETS);
    
    return `h:${hBucket}|v:${vBucket}|s:${speedBucket}`;
  }

  getAction(state: string, isTraining: boolean): Action {
    // Initialize Q-values for new state
    if (!this.qTable[state]) {
      this.qTable[state] = [0, 0, 0, 0]; // [MOVE_LEFT, MOVE_RIGHT, DIVE_LEFT, DIVE_RIGHT]
    }

    if (isTraining && Math.random() < this.hyperparams.epsilon) {
      // Exploration: random action
      return Math.floor(Math.random() * 4) as Action;
    } else {
      // Exploitation: best known action
      const qValues = this.qTable[state];
      let bestAction = Action.MOVE_LEFT;
      let bestValue = qValues[0];
      
      for (let i = 1; i < 4; i++) {
        if (qValues[i] > bestValue) {
          bestValue = qValues[i];
          bestAction = i as Action;
        }
      }
      
      return bestAction;
    }
  }

  storeTransition(state: string, action: Action): void {
    // Store previous transition if exists
    if (this.lastState !== null && this.lastAction !== null) {
      this.replayBuffer.add({
        state: this.lastState,
        action: this.lastAction,
        reward: 0, // Will be updated later
        nextState: state,
        done: false
      });
    }
    
    this.lastState = state;
    this.lastAction = action;
    this.contactMade = false;
  }

  setContactMade(): void {
    this.contactMade = true;
  }

  hasContactBeenMade(): boolean {
    return this.contactMade;
  }

  learn(outcome: EpisodeOutcome): number {
    if (this.lastState === null || this.lastAction === null) {
      return 0;
    }

    // Calculate reward - SIMPLE and CORRECT
    // MISS = ball went wide = NO GOAL = good for goalkeeper!
    let reward = 0;
    switch (outcome) {
      case EpisodeOutcome.SAVE:
        reward = 1.0; // Good job touching the ball
        break;
      case EpisodeOutcome.GOAL:
        reward = -1.0; // Bad, conceded a goal
        break;
      case EpisodeOutcome.MISS:
        reward = 0.1; // Ball went wide - no goal conceded! Slight positive
        break;
    }

    // Contact bonus
    if (this.contactMade) {
      reward += 0.1;
    }

    // Small time penalty per step
    reward -= 0.01;

    // Add terminal transition to replay buffer
    this.replayBuffer.add({
      state: this.lastState,
      action: this.lastAction,
      reward: reward,
      nextState: null,
      done: true
    });

    // Experience Replay: Sample batch and update multiple transitions
    const batch = this.replayBuffer.sample(this.batchSize);
    
    for (const transition of batch) {
      // Ensure Q-table entry exists
      if (!this.qTable[transition.state]) {
        this.qTable[transition.state] = [0, 0, 0, 0];
      }

      // Calculate target Q-value
      let targetQ: number;
      if (transition.done || transition.nextState === null) {
        // Terminal state: target is just the reward
        targetQ = transition.reward;
      } else {
        // Non-terminal: target is reward + discounted max future Q
        const nextQValues = this.qTable[transition.nextState] || [0, 0, 0, 0];
        const maxNextQ = Math.max(...nextQValues);
        targetQ = transition.reward + this.hyperparams.discountFactor * maxNextQ;
      }

      // Q-learning update
      const currentQ = this.qTable[transition.state][transition.action];
      const newQ = currentQ + this.hyperparams.learningRate * (targetQ - currentQ);
      this.qTable[transition.state][transition.action] = newQ;
    }

    // Decay epsilon
    if (this.hyperparams.epsilon > this.hyperparams.epsilonMin) {
      this.hyperparams.epsilon *= this.hyperparams.epsilonDecay;
    }

    return reward;
  }

  getReplayBufferSize(): number {
    return this.replayBuffer.size();
  }

  clearReplayBuffer(): void {
    this.replayBuffer.clear();
  }

  getEpsilon(): number {
    return this.hyperparams.epsilon;
  }

  getQTable(): QTable {
    return this.qTable;
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
      
      heatmapData.push({
        state,
        actions: [...qValues],
        bestAction,
        bestValue
      });
    }
    
    // Sort by best value descending (most confident predictions first)
    return heatmapData.sort((a, b) => b.bestValue - a.bestValue);
  }

  getCurrentStateQValues(state: string): number[] | null {
    return this.qTable[state] || null;
  }

  getHyperparameters(): Hyperparameters {
    return { ...this.hyperparams };
  }

  updateHyperparameters(params: Partial<Hyperparameters>): void {
    if (params.learningRate !== undefined) {
      this.hyperparams.learningRate = params.learningRate;
    }
    if (params.discountFactor !== undefined) {
      this.hyperparams.discountFactor = params.discountFactor;
    }
    if (params.epsilon !== undefined) {
      this.hyperparams.epsilon = params.epsilon;
    }
    if (params.epsilonDecay !== undefined) {
      this.hyperparams.epsilonDecay = params.epsilonDecay;
    }
    if (params.epsilonMin !== undefined) {
      this.hyperparams.epsilonMin = params.epsilonMin;
    }
  }

  reset(): void {
    this.qTable = {};
    this.hyperparams.epsilon = DEFAULT_EPSILON;
    this.lastState = null;
    this.lastAction = null;
    this.contactMade = false;
  }

  saveToFile(): string {
    return JSON.stringify({
      hyperparameters: this.hyperparams,
      qTable: this.qTable
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
