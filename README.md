# Football Simulator - Q-Learning Goalkeeper

A real-time football goalkeeper training simulator using Q-learning reinforcement learning. A robot shooter fires balls at the goal while a goalkeeper agent learns to stop them through trial and error.

## Features

- **Q-Learning Algorithm**: Tabular Q-learning with epsilon-greedy exploration
- **Kinematic Physics**: Car-like robot movement with realistic ball physics
- **Real-time Visualization**: HTML5 Canvas rendering with live statistics
- **Training Analytics**: 4 interactive charts (Save %, Epsilon decay, Rewards, Outcomes)
- **SQLite Database**: All models and metrics stored in SQLite with time-series data
- **Training Modes**: Training mode (with exploration) and Evaluation mode (exploitation only)
- **Speed Control**: 1x, 5x, and 10x simulation speeds
- **Adjustable Hyperparameters**: Learning rate, discount factor, and epsilon decay
- **Model Persistence**: Auto-saves Q-table to SQLite every 100 episodes
- **Statistics Tracking**: Save percentage, epsilon decay, best streak, and more

## Project Structure

```
football-simulator/
├── client/
│   ├── index.html      # Main UI with controls and charts
│   └── client.js       # Canvas rendering and Chart.js graphs
├── server/
│   ├── index.ts        # WebSocket server and game loop
│   ├── physics.ts      # Physics engine (ball, robot, goalkeeper)
│   ├── qlearning.ts    # Q-learning agent implementation
│   └── database.ts     # SQLite database for models & metrics
├── shared/
│   └── types.ts        # Shared TypeScript types and constants
├── models.db           # SQLite database (auto-created)
├── package.json
└── tsconfig.json
```

## Installation

```bash
cd /Users/diegogiuliani/Proyectos/football-simulator
pnpm install
```

## Running the Application

### 1. Start the Server

```bash
pnpm run dev
# or
pnpm start
```

The server will start on `ws://localhost:3001` and automatically compile TypeScript.

### 2. Open the Client

Open `client/index.html` in a web browser:

```bash
open client/index.html
# or
pnpm run client
```

## How It Works

### The Goalkeeper Agent

The goalkeeper uses **Q-learning**, a model-free reinforcement learning algorithm:

- **State Space**: Relative ball position (horizontal offset, vertical distance) and ball speed
- **Actions**: Move Left, Move Right, Dive Left, Dive Right
- **Rewards**:
  - +1.0 for successful save
  - -1.0 for goal conceded
  - +0.1 for touching the ball
  - -0.01 time penalty per step

### Training Process

1. **Exploration Phase** (high epsilon): Goalkeeper tries random actions to discover what works
2. **Exploitation Phase** (low epsilon): Goalkeeper uses learned Q-values to make optimal decisions
3. **Epsilon Decay**: Exploration rate decreases over time (default: 0.995 per episode)

### Episode Structure

Each episode consists of:
1. Robot spawns at random position in shooting zone
2. Robot calculates aim point and fires ball
3. Goalkeeper observes ball state and takes action
4. Episode ends when: ball crosses goal line, ball stops, or ball hits goalkeeper
5. Agent receives reward and updates Q-table

## Controls

### Main Controls
- **Start/Pause Training**: Toggle the simulation
- **Reset Agent**: Clear Q-table and start fresh
- **Switch Mode**: Toggle between Training and Evaluation

### Speed Controls
- **1x**: Normal speed (60 FPS), watch every frame
- **5x**: Fast training, still visible
- **10x**: Very fast training, throttled rendering

### Hyperparameters
- **Learning Rate (α)**: How much new information overrides old (0.01 - 0.50)
- **Discount Factor (γ)**: Importance of future rewards (0.80 - 0.99)
- **Epsilon Decay**: How fast randomness decreases (0.9900 - 0.9999)

## Visual Elements

- **Red Robot**: Car-like shape with wheels, positioned randomly in shooting zone
- **Blue Goalkeeper**: Rectangle with extended arms when diving
- **White Ball**: Circle with velocity trail
- **Green Field**: Soccer pitch with center line and goal area
- **Goal Net**: Visual representation at bottom of canvas

## Statistics Displayed

- **Episodes**: Total training episodes completed
- **Save %**: Percentage of saves vs goals (misses excluded)
- **Saves/Goals/Misses**: Raw counts
- **Epsilon**: Current exploration rate
- **Best Streak**: Consecutive saves record
- **Average Reward**: Rolling average over last 100 episodes

## Architecture

### Server (Node.js + WebSocket)
- Runs physics simulation at 60 FPS
- Broadcasts game state to all connected clients
- Manages Q-learning updates
- Auto-saves models to `models/` directory

### Client (HTML5 Canvas)
- Connects via WebSocket to receive game state
- Renders entities using Canvas 2D API
- Displays live statistics
- Sends control commands to server

### Physics Engine
- **Ball**: Position + velocity, friction, wall bouncing
- **Robot**: Position + heading angle, spawns randomly
- **Goalkeeper**: Position along goal line, can dive with rotated hitbox

## State Space Discretization

The continuous state space is discretized into buckets for the Q-table:

- **Horizontal Offset**: 11 buckets (-100 to +100 pixels)
- **Vertical Distance**: 5 buckets (50 to 400 pixels)
- **Ball Speed**: 3 buckets (slow, medium, fast)

Total state space: ~165 states × 4 actions = ~660 Q-values

## Extending the Project

### Ideas for Enhancement

1. **Q-Table Heatmap**: Visualize which states have highest Q-values
2. **Multiple Robots**: Train against different shooting patterns
3. **Manual Model Management**: Import/export specific checkpoints
4. **Curriculum Learning**: Gradually increase shot difficulty
5. **Function Approximation**: Replace Q-table with neural network (DQN)

### Code Locations

- **Physics**: `server/physics.ts`
- **Q-Learning**: `server/qlearning.ts`
- **Game Loop**: `server/index.ts`
- **Rendering**: `client/client.js`
- **Types/Constants**: `shared/types.ts`

## Troubleshooting

### Port Already in Use
If port 3001 is in use, modify `server/index.ts` line 31:
```typescript
const PORT = 3002; // or any available port
```
Then update `client/client.js` line 6:
```javascript
const ws = new WebSocket('ws://localhost:3002');
```

### TypeScript Compilation Errors
Make sure you're in the project directory:
```bash
cd /Users/diegogiuliani/Proyectos/football-simulator
pnpm run build
```

### Client Not Connecting
Check that:
1. Server is running (`Server started on ws://localhost:3001`)
2. Browser supports WebSocket
3. No firewall blocking port 3001

## License

MIT

## Author

Created as a demonstration of Q-learning reinforcement learning with TypeScript and HTML5 Canvas.
