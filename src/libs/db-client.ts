import {
  Pool,
  type PoolClient,
  type PoolConfig,
  type QueryResult,
  type QueryResultRow,
} from "pg";

import { config as dotenvConfig } from "dotenv";

dotenvConfig();

export class DatabasePool {
  private pool: Pool;

  constructor(config: PoolConfig) {
    this.pool = new Pool(config);

    this.pool.on("connect", () => {
      console.log("Connected to database");
    });

    this.pool.on("error", (err) => {
      console.error("Unexpected database error:", err);
    });
  }

  async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      console.log("Query executed", { text, duration, rows: result.rowCount });

      // more than 1 second
      if (duration > 1000) {
        console.warn("Slow query detected", {
          text,
          duration,
          rows: result.rowCount,
        });
      }

      return result;
    } catch (error) {
      console.error("Query error:", { text, error });
      throw error;
    }
  }

  async getClient() {
    return await this.pool.connect();
  }

  async close() {
    console.log("Closing database pool...");
    await this.pool.end();
    console.log("Database pool closed");
  }

  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Rollback failed:", rollbackError);
      }
      throw error;
    } finally {
      try {
        client.release();
      } catch (releaseError) {
        console.error("Client release failed:", releaseError);
      }
    }
  }

  static createPool(config: PoolConfig): DatabasePool {
    return new DatabasePool(config);
  }
}

export function createDatabaseConfig(serviceName?: string): PoolConfig {
  const dbName = serviceName
    ? process.env[`DATABASE_NAME_${serviceName.toUpperCase()}`] ||
      process.env.DATABASE_NAME
    : process.env.DATABASE_NAME;

  if (!dbName) {
    throw new Error("DATABASE_NAME is not set");
  }

  if (!process.env.DATABASE_HOST) {
    throw new Error("DATABASE_HOST is not set");
  }

  if (!process.env.DATABASE_PORT) {
    throw new Error("DATABASE_PORT is not set");
  }

  if (!process.env.DATABASE_USER) {
    throw new Error("DATABASE_USER is not set");
  }

  if (!process.env.DATABASE_PASSWORD) {
    throw new Error("DATABASE_PASSWORD is not set");
  }

  return {
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT, 10),
    database: dbName,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    max: parseInt(process.env.DATABASE_POOL_SIZE ?? "20", 10),
    idleTimeoutMillis: 30000, // 30 seconds
    connectionTimeoutMillis: 2000, // 2 seconds
  };
}

export abstract class BaseRepository {
  protected db: DatabasePool;

  constructor(db: DatabasePool) {
    this.db = db;
  }

  protected async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
  ): Promise<QueryResult<T>> {
    return this.db.query<T>(text, params);
  }

  protected async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(callback);
  }
}

export * from "pg";
