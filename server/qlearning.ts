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

export class QLearningAgent {
  private qTable: QTable = {};
  private hyperparams: Hyperparameters;
  private lastState: string | null = null;
  private lastAction: Action | null = null;
  private contactMade: boolean = false;

  constructor(hyperparams?: Partial<Hyperparameters>) {
    this.hyperparams = {
      learningRate: hyperparams?.learningRate ?? DEFAULT_LEARNING_RATE,
      discountFactor: hyperparams?.discountFactor ?? DEFAULT_DISCOUNT_FACTOR,
      epsilon: hyperparams?.epsilon ?? DEFAULT_EPSILON,
      epsilonDecay: hyperparams?.epsilonDecay ?? DEFAULT_EPSILON_DECAY,
      epsilonMin: hyperparams?.epsilonMin ?? DEFAULT_EPSILON_MIN
    };
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
    
    // Discretize
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
    this.lastState = state;
    this.lastAction = action;
    this.contactMade = false;
  }

  setContactMade(): void {
    this.contactMade = true;
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
        reward = 0.0;
        break;
    }

    // Add contact bonus
    if (this.contactMade) {
      reward += 0.1;
    }

    // Add small time penalty (assume ~60 frames per episode average)
    reward -= 0.01;

    // Q-learning update
    const currentQ = this.qTable[this.lastState][this.lastAction];
    // For terminal states, next max Q is 0
    const maxNextQ = 0;
    
    const newQ = currentQ + this.hyperparams.learningRate * (
      reward + this.hyperparams.discountFactor * maxNextQ - currentQ
    );
    
    this.qTable[this.lastState][this.lastAction] = newQ;

    // Decay epsilon
    if (this.hyperparams.epsilon > this.hyperparams.epsilonMin) {
      this.hyperparams.epsilon *= this.hyperparams.epsilonDecay;
    }

    return reward;
  }

  getEpsilon(): number {
    return this.hyperparams.epsilon;
  }

  getQTable(): QTable {
    return this.qTable;
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
