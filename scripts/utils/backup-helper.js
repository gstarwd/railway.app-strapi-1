/**
 * Backup Helper - Utilities for backup and restore operations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class BackupHelper {
  /**
   * Generate timestamp string for backup files
   */
  static getTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').split('T').join('-').split('.')[0];
  }

  /**
   * Backup SQLite database
   */
  static backupSQLite(dbPath, backupDir) {
    const timestamp = this.getTimestamp();
    const backupPath = path.join(backupDir, `data.db.backup-${timestamp}`);

    fs.copyFileSync(dbPath, backupPath);

    return backupPath;
  }

  /**
   * Backup PostgreSQL database
   */
  static backupPostgreSQL(connectionString, backupDir) {
    const timestamp = this.getTimestamp();
    const backupPath = path.join(backupDir, `backup-${timestamp}.sql`);

    try {
      execSync(`pg_dump "${connectionString}" > "${backupPath}"`, {
        stdio: 'inherit',
      });
      return backupPath;
    } catch (error) {
      throw new Error(`PostgreSQL backup failed: ${error.message}`);
    }
  }

  /**
   * Export files to JSON
   */
  static async exportToJSON(db, backupDir) {
    const timestamp = this.getTimestamp();
    const backupPath = path.join(backupDir, `cloudinary-backup-${timestamp}.json`);

    // Get all Cloudinary files
    const files = await db.getCloudinaryFiles();

    const backup = {
      backup_metadata: {
        backup_date: new Date().toISOString(),
        database_type: db.client,
        strapi_version: '5.11.3',
        total_files: files.length,
      },
      files: files.map((file) => ({
        id: file.id,
        name: file.name,
        alternativeText: file.alternative_text,
        caption: file.caption,
        width: file.width,
        height: file.height,
        hash: file.hash,
        ext: file.ext,
        mime: file.mime,
        size: file.size,
        url: file.url,
        formats: file.formats ? JSON.parse(file.formats) : null,
        provider: file.provider,
        provider_metadata: file.provider_metadata
          ? JSON.parse(file.provider_metadata)
          : null,
        folderPath: file.folder_path,
        createdAt: file.created_at,
        updatedAt: file.updated_at,
      })),
    };

    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

    return backupPath;
  }

  /**
   * Export to CSV mapping table
   */
  static async exportToCSV(db, backupDir) {
    const timestamp = this.getTimestamp();
    const backupPath = path.join(backupDir, `migration-mapping-${timestamp}.csv`);

    const files = await db.getCloudinaryFiles();

    const csvHeader = 'file_id,file_name,hash,original_url,new_url,status,migration_date,error_message\n';
    const csvRows = files.map((file) =>
      [
        file.id,
        `"${file.name}"`,
        file.hash,
        file.url,
        '', // new_url - to be filled during migration
        'pending',
        '',
        '',
      ].join(',')
    );

    const csv = csvHeader + csvRows.join('\n');
    fs.writeFileSync(backupPath, csv);

    return backupPath;
  }

  /**
   * Generate backup report
   */
  static generateReport(backupInfo, backupDir) {
    const timestamp = this.getTimestamp();
    const reportPath = path.join(backupDir, `backup-report-${timestamp}.txt`);

    const report = `
Cloudinary to R2 Migration - Backup Report
==========================================

Backup Date: ${new Date().toISOString()}
Database Type: ${backupInfo.databaseType}

Files Backed Up:
  - Database: ${backupInfo.databaseBackup}
  - JSON Export: ${backupInfo.jsonBackup}
  - CSV Mapping: ${backupInfo.csvBackup}

Statistics:
  - Total Cloudinary Files: ${backupInfo.totalFiles}
  - Total File Size: ${backupInfo.totalSize || 'N/A'}

Verification:
  - Database backup exists: ${fs.existsSync(backupInfo.databaseBackup) ? 'YES' : 'NO'}
  - JSON backup exists: ${fs.existsSync(backupInfo.jsonBackup) ? 'YES' : 'NO'}
  - CSV backup exists: ${fs.existsSync(backupInfo.csvBackup) ? 'YES' : 'NO'}

Status: ${backupInfo.status || 'COMPLETED'}

Notes:
- Keep these backups until migration is verified successful
- Database backups can be used for full recovery
- JSON backups contain all file metadata and can be used for partial recovery
- CSV is useful for quick lookups and Excel analysis
`;

    fs.writeFileSync(reportPath, report.trim());

    return reportPath;
  }

  /**
   * List all available backups
   */
  static listBackups(backupDir) {
    if (!fs.existsSync(backupDir)) {
      return [];
    }

    const files = fs.readdirSync(backupDir);
    const backups = new Map();

    files.forEach((file) => {
      const match = file.match(/backup-(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})/);
      if (match) {
        const timestamp = match[1];
        if (!backups.has(timestamp)) {
          backups.set(timestamp, {
            timestamp,
            files: [],
          });
        }
        backups.get(timestamp).files.push(file);
      }
    });

    return Array.from(backups.values()).sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
  }

  /**
   * Restore database from backup
   */
  static restoreSQLite(backupPath, dbPath) {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    // Create backup of current database first
    if (fs.existsSync(dbPath)) {
      const preRestoreBackup = dbPath + '.pre-restore';
      fs.copyFileSync(dbPath, preRestoreBackup);
    }

    // Restore from backup
    fs.copyFileSync(backupPath, dbPath);
  }

  /**
   * Restore PostgreSQL from backup
   */
  static restorePostgreSQL(backupPath, connectionString) {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    try {
      execSync(`psql "${connectionString}" < "${backupPath}"`, {
        stdio: 'inherit',
      });
    } catch (error) {
      throw new Error(`PostgreSQL restore failed: ${error.message}`);
    }
  }
}

module.exports = BackupHelper;
