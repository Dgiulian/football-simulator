// Game constants
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

// Goal dimensions
export const GOAL_WIDTH = 200;
export const GOAL_HEIGHT = 20;
export const GOAL_X = (CANVAS_WIDTH - GOAL_WIDTH) / 2;
export const GOAL_Y = CANVAS_HEIGHT - GOAL_HEIGHT;

// Goalkeeper zone
export const GOALKEEPER_MIN_X = GOAL_X;
export const GOALKEEPER_MAX_X = GOAL_X + GOAL_WIDTH;

// Robot shooting zone
export const SHOOTING_ZONE_MIN_Y = 100;
export const SHOOTING_ZONE_MAX_Y = 400;

// Entity sizes
export const BALL_RADIUS = 8;
export const GOALKEEPER_WIDTH = 30;
export const GOALKEEPER_HEIGHT = 40;
export const ROBOT_WIDTH = 40;
export const ROBOT_HEIGHT = 25;
export const WHEEL_RADIUS = 6;

// Physics - IMPROVED for better learning
export const BALL_FRICTION = 0.998; // Less friction = longer shots, more time to react
export const GOALKEEPER_SPEED = 8; // Faster to catch up to balls
export const DIVE_SPEED = 15; // Faster dives
export const DIVE_DURATION = 10; // Shorter dive commitment
export const BALL_MIN_SPEED = 0.3; // Slower threshold for stopping

// Q-learning defaults - BALANCED
export const DEFAULT_LEARNING_RATE = 0.2; // Standard learning rate
export const DEFAULT_DISCOUNT_FACTOR = 0.95; // Standard discount
export const DEFAULT_EPSILON = 1.0;
export const DEFAULT_EPSILON_DECAY = 0.995; // Good balance: explore early, exploit later
export const DEFAULT_EPSILON_MIN = 0.01; // Almost pure exploitation eventually

// Speed multipliers
export const SPEED_MULTIPLIERS = [1, 5, 10];

// State space discretization - SMALL and EFFECTIVE
// Key insight: only 5 horizontal buckets = 120 states total, easy to learn
export const HORIZONTAL_OFFSET_BUCKETS = [-100, -30, 0, 30, 100];
export const VERTICAL_DISTANCE_BUCKETS = [80, 200, 400];
export const SPEED_BUCKETS = [8, 14]; // 2 speeds: slow (<8), medium (8-14), fast (>14)

export enum Action {
  MOVE_LEFT = 0,
  MOVE_RIGHT = 1,
  DIVE_LEFT = 2,
  DIVE_RIGHT = 3
}

export enum EpisodeOutcome {
  SAVE = 'save',
  GOAL = 'goal',
  MISS = 'miss'
}

export enum GameMode {
  TRAINING = 'training',
  EVALUATION = 'evaluation'
}

export interface Position {
  x: number;
  y: number;
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface BallState extends Position {
  velocity: Vector2;
  radius: number;
}

export interface RobotState extends Position {
  angle: number; // heading in radians
  velocity: number;
  angularVelocity: number;
}

export interface GoalkeeperState extends Position {
  velocity: number;
  isDiving: boolean;
  diveDirection: number; // -1 for left, 1 for right
  diveTimer: number;
  width: number;
  height: number;
}

export interface GameState {
  ball: BallState;
  robot: RobotState;
  goalkeeper: GoalkeeperState;
  episode: number;
  mode: GameMode;
}

export interface EpisodeResult {
  outcome: EpisodeOutcome;
  reward: number;
  duration: number; // frames
}

export interface TrainingStats {
  totalEpisodes: number;
  saves: number;
  goals: number;
  misses: number;
  savePercentage: number;
  currentEpsilon: number;
  averageReward: number;
  bestStreak: number;
  currentStreak: number;
  trainingTime: number; // seconds
}

export interface Hyperparameters {
  learningRate: number;
  discountFactor: number;
  epsilon: number;
  epsilonDecay: number;
  epsilonMin: number;
}

// WebSocket message types
export interface ServerMessage {
  type: 'game_state' | 'episode_complete' | 'training_stats' | 'config_update';
  data: any;
}

export interface ClientMessage {
  type: 'toggle_training' | 'reset_agent' | 'update_params' | 'set_speed' | 'set_mode';
  data?: any;
}
