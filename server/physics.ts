import {
  Position,
  Vector2,
  BallState,
  RobotState,
  GoalkeeperState,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GOAL_X,
  GOAL_Y,
  GOAL_WIDTH,
  GOALKEEPER_MIN_X,
  GOALKEEPER_MAX_X,
  SHOOTING_ZONE_MIN_Y,
  SHOOTING_ZONE_MAX_Y,
  BALL_RADIUS,
  GOALKEEPER_WIDTH,
  GOALKEEPER_HEIGHT,
  ROBOT_WIDTH,
  ROBOT_HEIGHT,
  BALL_FRICTION,
  GOALKEEPER_SPEED,
  DIVE_SPEED,
  DIVE_DURATION,
  BALL_MIN_SPEED,
  Action,
  EpisodeOutcome
} from '../shared/types';

export function createBall(): BallState {
  return {
    x: 0,
    y: 0,
    velocity: { x: 0, y: 0 },
    radius: BALL_RADIUS
  };
}

export function createRobot(): RobotState {
  return {
    x: 0,
    y: 0,
    angle: 0,
    velocity: 0,
    angularVelocity: 0
  };
}

export function createGoalkeeper(): GoalkeeperState {
  return {
    x: CANVAS_WIDTH / 2,
    y: GOAL_Y - GOALKEEPER_HEIGHT / 2,
    velocity: 0,
    isDiving: false,
    diveDirection: 0,
    diveTimer: 0,
    width: GOALKEEPER_WIDTH,
    height: GOALKEEPER_HEIGHT
  };
}

export function resetBall(ball: BallState, robot: RobotState): void {
  // Ball starts at robot position
  ball.x = robot.x;
  ball.y = robot.y;
  
  // Calculate aim point on goal line
  const aimX = GOAL_X + Math.random() * GOAL_WIDTH;
  const aimY = GOAL_Y + 10;
  
  // Calculate velocity vector toward aim point
  const dx = aimX - ball.x;
  const dy = aimY - ball.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Random speed: slow (5-8), medium (8-12), fast (12-16)
  const speedType = Math.random();
  let speed: number;
  if (speedType < 0.33) {
    speed = 5 + Math.random() * 3; // slow
  } else if (speedType < 0.66) {
    speed = 8 + Math.random() * 4; // medium
  } else {
    speed = 12 + Math.random() * 4; // fast
  }
  
  ball.velocity.x = (dx / distance) * speed;
  ball.velocity.y = (dy / distance) * speed;
}

export function resetRobot(robot: RobotState): void {
  // Random position in shooting zone
  robot.x = Math.random() * (CANVAS_WIDTH - 100) + 50;
  robot.y = SHOOTING_ZONE_MIN_Y + Math.random() * (SHOOTING_ZONE_MAX_Y - SHOOTING_ZONE_MIN_Y);
  
  // Face toward goal center
  const goalCenterX = CANVAS_WIDTH / 2;
  const goalCenterY = CANVAS_HEIGHT;
  robot.angle = Math.atan2(goalCenterY - robot.y, goalCenterX - robot.x);
  
  robot.velocity = 0;
  robot.angularVelocity = 0;
}

export function resetGoalkeeper(goalkeeper: GoalkeeperState): void {
  goalkeeper.x = CANVAS_WIDTH / 2;
  goalkeeper.y = GOAL_Y - GOALKEEPER_HEIGHT / 2;
  goalkeeper.velocity = 0;
  goalkeeper.isDiving = false;
  goalkeeper.diveDirection = 0;
  goalkeeper.diveTimer = 0;
  goalkeeper.width = GOALKEEPER_WIDTH;
  goalkeeper.height = GOALKEEPER_HEIGHT;
}

export function updateBall(ball: BallState): boolean {
  // Update position
  ball.x += ball.velocity.x;
  ball.y += ball.velocity.y;
  
  // Apply friction
  ball.velocity.x *= BALL_FRICTION;
  ball.velocity.y *= BALL_FRICTION;
  
  // Wall bounces
  if (ball.x - ball.radius < 0) {
    ball.x = ball.radius;
    ball.velocity.x = Math.abs(ball.velocity.x);
  } else if (ball.x + ball.radius > CANVAS_WIDTH) {
    ball.x = CANVAS_WIDTH - ball.radius;
    ball.velocity.x = -Math.abs(ball.velocity.x);
  }
  
  if (ball.y - ball.radius < 0) {
    ball.y = ball.radius;
    ball.velocity.y = Math.abs(ball.velocity.y);
  }
  
  // Check if ball stopped
  const speed = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2);
  if (speed < BALL_MIN_SPEED) {
    return true; // Ball stopped
  }
  
  return false;
}

export function checkGoal(ball: BallState): EpisodeOutcome | null {
  // Check if ball crossed goal line
  if (ball.y + ball.radius > GOAL_Y) {
    // Check if it's within goal width
    if (ball.x >= GOAL_X && ball.x <= GOAL_X + GOAL_WIDTH) {
      return EpisodeOutcome.GOAL;
    } else {
      return EpisodeOutcome.MISS;
    }
  }
  return null;
}

export function checkBallCollision(ball: BallState, goalkeeper: GoalkeeperState): boolean {
  // Simple circle-rectangle collision
  const closestX = Math.max(
    goalkeeper.x - goalkeeper.width / 2,
    Math.min(ball.x, goalkeeper.x + goalkeeper.width / 2)
  );
  const closestY = Math.max(
    goalkeeper.y - goalkeeper.height / 2,
    Math.min(ball.y, goalkeeper.y + goalkeeper.height / 2)
  );
  
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance < ball.radius) {
    // Deflect ball
    ball.velocity.x = -ball.velocity.x * 0.5;
    ball.velocity.y = -ball.velocity.y * 0.5;
    return true;
  }
  
  return false;
}

export function executeAction(goalkeeper: GoalkeeperState, action: Action): void {
  switch (action) {
    case Action.MOVE_LEFT:
      if (!goalkeeper.isDiving) {
        goalkeeper.velocity = -GOALKEEPER_SPEED;
        goalkeeper.x += goalkeeper.velocity;
      }
      break;
    case Action.MOVE_RIGHT:
      if (!goalkeeper.isDiving) {
        goalkeeper.velocity = GOALKEEPER_SPEED;
        goalkeeper.x += goalkeeper.velocity;
      }
      break;
    case Action.DIVE_LEFT:
      if (!goalkeeper.isDiving) {
        goalkeeper.isDiving = true;
        goalkeeper.diveDirection = -1;
        goalkeeper.diveTimer = DIVE_DURATION;
        goalkeeper.width = GOALKEEPER_HEIGHT; // Rotate dimensions
        goalkeeper.height = GOALKEEPER_WIDTH;
      }
      break;
    case Action.DIVE_RIGHT:
      if (!goalkeeper.isDiving) {
        goalkeeper.isDiving = true;
        goalkeeper.diveDirection = 1;
        goalkeeper.diveTimer = DIVE_DURATION;
        goalkeeper.width = GOALKEEPER_HEIGHT; // Rotate dimensions
        goalkeeper.height = GOALKEEPER_WIDTH;
      }
      break;
  }
  
  // Keep goalkeeper within goal bounds
  goalkeeper.x = Math.max(
    GOALKEEPER_MIN_X + goalkeeper.width / 2,
    Math.min(goalkeeper.x, GOALKEEPER_MAX_X - goalkeeper.width / 2)
  );
}

export function updateGoalkeeper(goalkeeper: GoalkeeperState): void {
  if (goalkeeper.isDiving) {
    // Move in dive direction
    goalkeeper.x += goalkeeper.diveDirection * DIVE_SPEED;
    goalkeeper.diveTimer--;
    
    // Keep within bounds even while diving
    goalkeeper.x = Math.max(
      GOALKEEPER_MIN_X + goalkeeper.width / 2,
      Math.min(goalkeeper.x, GOALKEEPER_MAX_X - goalkeeper.width / 2)
    );
    
    // End dive
    if (goalkeeper.diveTimer <= 0) {
      goalkeeper.isDiving = false;
      goalkeeper.diveDirection = 0;
      goalkeeper.width = GOALKEEPER_WIDTH;
      goalkeeper.height = GOALKEEPER_HEIGHT;
      goalkeeper.velocity = 0;
    }
  }
}
