import Database from 'better-sqlite3';
import * as path from 'path';

const DB_PATH = path.join(__dirname, '..', 'models.db');

export interface ModelRecord {
  id: number;
  created_at: string;
  episodes: number;
  save_percentage: number;
  epsilon: number;
  hyperparameters: string;
  qtable: string;
}

export interface MetricRecord {
  id: number;
  episode: number;
  timestamp: string;
  save_percentage: number;
  epsilon: number;
  average_reward: number;
  total_saves: number;
  total_goals: number;
  total_misses: number;
}

export class ModelDatabase {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.initializeTables();
  }

  private initializeTables(): void {
    // Models table - stores Q-table snapshots
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS models (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        episodes INTEGER NOT NULL,
        save_percentage REAL NOT NULL,
        epsilon REAL NOT NULL,
        hyperparameters TEXT NOT NULL,
        qtable TEXT NOT NULL
      )
    `);

    // Metrics table - stores time-series training data for graphs
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        episode INTEGER NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        save_percentage REAL NOT NULL,
        epsilon REAL NOT NULL,
        average_reward REAL NOT NULL,
        total_saves INTEGER NOT NULL,
        total_goals INTEGER NOT NULL,
        total_misses INTEGER NOT NULL
      )
    `);

    // Create indexes for faster queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_metrics_episode ON metrics(episode);
      CREATE INDEX IF NOT EXISTS idx_models_episodes ON models(episodes);
    `);
  }

  saveModel(
    episodes: number,
    savePercentage: number,
    epsilon: number,
    hyperparameters: object,
    qtable: object
  ): number {
    const stmt = this.db.prepare(`
      INSERT INTO models (episodes, save_percentage, epsilon, hyperparameters, qtable)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      episodes,
      savePercentage,
      epsilon,
      JSON.stringify(hyperparameters),
      JSON.stringify(qtable)
    );
    
    return result.lastInsertRowid as number;
  }

  saveMetric(
    episode: number,
    savePercentage: number,
    epsilon: number,
    averageReward: number,
    totalSaves: number,
    totalGoals: number,
    totalMisses: number
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO metrics (episode, save_percentage, epsilon, average_reward, total_saves, total_goals, total_misses)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(episode, savePercentage, epsilon, averageReward, totalSaves, totalGoals, totalMisses);
  }

  getLatestModel(): ModelRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM models ORDER BY created_at DESC LIMIT 1
    `);
    return stmt.get() as ModelRecord | null;
  }

  getModelById(id: number): ModelRecord | null {
    const stmt = this.db.prepare('SELECT * FROM models WHERE id = ?');
    return stmt.get(id) as ModelRecord | null;
  }

  getAllModels(limit: number = 100): ModelRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM models ORDER BY created_at DESC LIMIT ?
    `);
    return stmt.all(limit) as ModelRecord[];
  }

  getMetricsForGraphs(windowSize: number = 100): MetricRecord[] {
    // Get metrics sampled every N episodes for smoother graphs
    const stmt = this.db.prepare(`
      SELECT * FROM metrics 
      WHERE episode % ? = 0 
      ORDER BY episode ASC
    `);
    return stmt.all(windowSize) as MetricRecord[];
  }

  getMetricsRange(startEpisode: number, endEpisode: number): MetricRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM metrics 
      WHERE episode >= ? AND episode <= ?
      ORDER BY episode ASC
    `);
    return stmt.all(startEpisode, endEpisode) as MetricRecord[];
  }

  getTotalEpisodes(): number {
    const stmt = this.db.prepare('SELECT MAX(episode) as max FROM metrics');
    const result = stmt.get() as { max: number };
    return result.max || 0;
  }

  deleteOldModels(keepLatest: number = 10): void {
    const stmt = this.db.prepare(`
      DELETE FROM models 
      WHERE id NOT IN (
        SELECT id FROM models ORDER BY created_at DESC LIMIT ?
      )
    `);
    stmt.run(keepLatest);
  }

  close(): void {
    this.db.close();
  }
}
