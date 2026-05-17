// Example: Using the Agents System
// This file demonstrates how to use the new agents architecture

import {
  BaseAgent,
  QLearningAgent,
  RuleBasedAgent,
  RandomAgent,
  AgentFactory,
  MultiAgentManager,
  AgentPresets,
  QLearningConfig,
  RuleBasedConfig
} from './agents';
import { Action, EpisodeOutcome, Hyperparameters } from '../shared/types';

// ============================================================
// EXAMPLE 1: Creating a Single Agent
// ============================================================

// Method 1: Using Factory with preset
const balancedAgent = AgentFactory.createFromPreset('balancedQLearning');
console.log('Created:', balancedAgent.getName());

// Method 2: Using Factory with custom config
const customAgentConfig: QLearningConfig = {
  name: 'My Custom Agent',
  type: 'qlearning',
  description: 'Custom configuration',
  hyperparameters: {
    learningRate: 0.25,
    discountFactor: 0.96,
    epsilon: 1.0,
    epsilonDecay: 0.996,
    epsilonMin: 0.02
  },
  useReplayBuffer: true,
  replayBufferSize: 1500,
  batchSize: 48
};
const customAgent = AgentFactory.createAgent(customAgentConfig);

// Method 3: Direct instantiation
const ruleBasedAgent = new RuleBasedAgent({
  name: 'Expert Goalkeeper',
  type: 'rulebased',
  reactionTime: 0,
  predictionEnabled: true
});

// ============================================================
// EXAMPLE 2: Multi-Agent Training
// ============================================================

const manager = new MultiAgentManager();

// Register multiple agents
manager.registerAgent('agent1', AgentFactory.createFromPreset('balancedQLearning'));
manager.registerAgent('agent2', AgentFactory.createFromPreset('aggressiveQLearning'));
manager.registerAgent('agent3', AgentFactory.createFromPreset('perfectGoalkeeper'));
manager.registerAgent('agent4', new RandomAgent({
  name: 'Baseline Random',
  type: 'random'
}));

// Train all agents for 1000 episodes
console.log('Training multiple agents...');

for (let episode = 0; episode < 1000; episode++) {
  // For each agent
  manager.getAllAgents().forEach(({ id, agent }) => {
    // Simulate an episode (pseudo-code)
    // const outcome = runEpisode(agent);
    // agent.learn(outcome);
  });

  // Show leaderboard every 100 episodes
  if (episode % 100 === 0) {
    console.log(`\n--- Episode ${episode} Leaderboard ---`);
    manager.getLeaderboard().forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.agent.getName()}: ${entry.savePercentage.toFixed(1)}%`);
    });
  }
}

// ============================================================
// EXAMPLE 3: Agent Comparison
// ============================================================

function compareAgents() {
  const agents = [
    { name: 'Balanced Q-Learning', agent: AgentFactory.createFromPreset('balancedQLearning') },
    { name: 'Rule-Based (Perfect)', agent: AgentFactory.createFromPreset('perfectGoalkeeper') },
    { name: 'Random Baseline', agent: AgentFactory.createFromPreset('randomAgent') }
  ];

  console.log('\n=== Agent Comparison ===');
  agents.forEach(({ name, agent }) => {
    console.log(`\n${name}:`);
    console.log(`  - Type: ${agent.getConfig().type}`);
    console.log(`  - Episodes: ${agent.getState().totalEpisodes}`);
    console.log(`  - Save %: ${agent.getSavePercentage().toFixed(1)}%`);
    console.log(`  - Total Reward: ${agent.getState().totalReward.toFixed(2)}`);
  });
}

// ============================================================
// EXAMPLE 4: Saving and Loading Agents
// ============================================================

import * as fs from 'fs';

// Save a trained Q-learning agent
function saveAgent(agent: QLearningAgent, filename: string) {
  const data = agent.saveToFile();
  fs.writeFileSync(filename, data);
  console.log(`Agent saved to ${filename}`);
}

// Load a Q-learning agent
function loadAgent(filename: string): QLearningAgent {
  const data = fs.readFileSync(filename, 'utf-8');
  const agent = AgentFactory.createFromPreset('balancedQLearning') as QLearningAgent;
  agent.loadFromFile(data);
  console.log(`Agent loaded from ${filename}`);
  return agent;
}

// ============================================================
// EXAMPLE 5: Custom Agent Configuration
// ============================================================

const experimentalConfig: QLearningConfig = {
  name: 'Experimental Agent',
  type: 'qlearning',
  description: 'Testing higher learning rate',
  hyperparameters: {
    learningRate: 0.4,  // Higher than default
    discountFactor: 0.98, // More forward-looking
    epsilon: 1.0,
    epsilonDecay: 0.997, // Slower decay
    epsilonMin: 0.05
  },
  useReplayBuffer: true,
  replayBufferSize: 2000,
  batchSize: 64
};
const experimentalAgent = AgentFactory.createAgent(experimentalConfig);

// ============================================================
// EXAMPLE 6: Tournament Mode
// ============================================================

class Tournament {
  private manager: MultiAgentManager;
  private results: Map<string, number> = new Map();

  constructor() {
    this.manager = new MultiAgentManager();
  }

  addAgent(id: string, agent: BaseAgent) {
    this.manager.registerAgent(id, agent);
    this.results.set(id, 0);
  }

  runTournament(episodesPerMatch: number) {
    const agents = this.manager.getAllAgents();
    
    console.log('\n=== TOURNAMENT START ===');
    console.log(`${agents.length} agents competing`);
    console.log(`${episodesPerMatch} episodes per match\n`);

    // Each agent plays against the same robot shooter
    agents.forEach(({ id, agent }) => {
      console.log(`Evaluating ${agent.getName()}...`);
      
      // Reset agent for fair comparison
      agent.reset();
      
      // Run episodes (pseudo-code)
      for (let i = 0; i < episodesPerMatch; i++) {
        // const outcome = runEpisode(agent);
        // agent.learn(outcome);
      }
      
      const score = agent.getSavePercentage();
      this.results.set(id, score);
      console.log(`  Final score: ${score.toFixed(1)}%\n`);
    });

    // Show final results
    console.log('=== FINAL STANDINGS ===');
    const sorted = Array.from(this.results.entries())
      .sort((a, b) => b[1] - a[1]);
    
    sorted.forEach(([id, score], index) => {
      const agent = this.manager.getAgent(id);
      console.log(`${index + 1}. ${agent?.getName()}: ${score.toFixed(1)}%`);
    });
  }
}

// Usage:
// const tournament = new Tournament();
// tournament.addAgent('ql', AgentFactory.createFromPreset('balancedQLearning'));
// tournament.addAgent('rb', AgentFactory.createFromPreset('perfectGoalkeeper'));
// tournament.addAgent('rnd', AgentFactory.createFromPreset('randomAgent'));
// tournament.runTournament(1000);

// ============================================================
// AVAILABLE PRESETS REFERENCE
// ============================================================

const availablePresets = {
  // Q-Learning Agents
  balancedQLearning: 'Standard Q-learning with moderate settings',
  aggressiveQLearning: 'Fast learning, less exploration',
  cautiousQLearning: 'Conservative with high exploration',
  
  // Rule-Based Agents
  perfectGoalkeeper: 'Optimal rule-based agent',
  slowGoalkeeper: 'Human-like reaction delay',
  noPredictionGoalkeeper: 'Reactive only (no prediction)',
  
  // Baseline
  randomAgent: 'Random actions for baseline'
};

console.log('\nAvailable Agent Presets:');
Object.entries(availablePresets).forEach(([key, desc]) => {
  console.log(`  - ${key}: ${desc}`);
});
