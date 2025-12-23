/**
 * Database helper - Abstraction layer for SQLite and PostgreSQL
 * Provides unified interface for both database types
 */

const path = require('path');
const fs = require('fs');

class DBHelper {
  constructor(client, connection) {
    this.client = client; // 'sqlite' or 'postgres'
    this.connection = connection;
  }

  /**
   * Initialize database connection
   */
  static async init(env = {}) {
    const client = env.DATABASE_CLIENT || 'sqlite';

    if (client === 'sqlite') {
      const Database = require('better-sqlite3');
      const dbPath = path.resolve(process.cwd(), env.DATABASE_FILENAME || '.tmp/data.db');

      if (!fs.existsSync(dbPath)) {
        throw new Error(`SQLite database not found at: ${dbPath}`);
      }

      const connection = new Database(dbPath);
      return new DBHelper('sqlite', connection);
    } else if (client === 'postgres') {
      const { Client } = require('pg');
      const connection = new Client({
        connectionString: env.DATABASE_PRIVATE_URL || env.DATABASE_URL,
      });
      await connection.connect();
      return new DBHelper('postgres', connection);
    } else {
      throw new Error(`Unsupported database client: ${client}`);
    }
  }

  /**
   * Execute a query and return all results
   */
  async all(sql, params = []) {
    if (this.client === 'sqlite') {
      const stmt = this.connection.prepare(sql);
      return stmt.all(...params);
    } else {
      const result = await this.connection.query(sql, params);
      return result.rows;
    }
  }

  /**
   * Execute a query and return first result
   */
  async get(sql, params = []) {
    if (this.client === 'sqlite') {
      const stmt = this.connection.prepare(sql);
      return stmt.get(...params);
    } else {
      const result = await this.connection.query(sql, params);
      return result.rows[0];
    }
  }

  /**
   * Execute a query (INSERT, UPDATE, DELETE)
   */
  async run(sql, params = []) {
    if (this.client === 'sqlite') {
      const stmt = this.connection.prepare(sql);
      return stmt.run(...params);
    } else {
      return await this.connection.query(sql, params);
    }
  }

  /**
   * Begin transaction
   */
  async beginTransaction() {
    if (this.client === 'sqlite') {
      this.connection.prepare('BEGIN TRANSACTION').run();
    } else {
      await this.connection.query('BEGIN');
    }
  }

  /**
   * Commit transaction
   */
  async commit() {
    if (this.client === 'sqlite') {
      this.connection.prepare('COMMIT').run();
    } else {
      await this.connection.query('COMMIT');
    }
  }

  /**
   * Rollback transaction
   */
  async rollback() {
    if (this.client === 'sqlite') {
      this.connection.prepare('ROLLBACK').run();
    } else {
      await this.connection.query('ROLLBACK');
    }
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.client === 'sqlite') {
      this.connection.close();
    } else {
      await this.connection.end();
    }
  }

  /**
   * Get all Cloudinary files
   */
  async getCloudinaryFiles() {
    return await this.all(
      "SELECT * FROM files WHERE provider = 'cloudinary' ORDER BY id"
    );
  }

  /**
   * Update file to R2
   */
  async updateFileToR2(fileId, r2Url) {
    const sql = `
      UPDATE files
      SET
        url = ?,
        provider = 'aws-s3',
        provider_metadata = NULL,
        formats = NULL,
        updated_at = datetime('now')
      WHERE id = ?
    `;

    if (this.client === 'postgres') {
      // PostgreSQL uses NOW() instead of datetime('now')
      const pgSql = sql.replace("datetime('now')", 'NOW()');
      await this.run(pgSql, [r2Url, fileId]);
    } else {
      await this.run(sql, [r2Url, fileId]);
    }
  }

  /**
   * Get file by ID
   */
  async getFileById(id) {
    return await this.get('SELECT * FROM files WHERE id = ?', [id]);
  }

  /**
   * Get total file count by provider
   */
  async getFileCountByProvider(provider) {
    const result = await this.get(
      'SELECT COUNT(*) as count FROM files WHERE provider = ?',
      [provider]
    );
    return result.count;
  }
}

module.exports = DBHelper;
