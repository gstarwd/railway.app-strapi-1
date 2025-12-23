#!/usr/bin/env node

/**
 * Restore From Backup
 * Restores database from backup files
 *
 * Usage:
 *   node scripts/restore-from-backup.js
 *   node scripts/restore-from-backup.js --backup=2025-12-23-10-00-00
 *   node scripts/restore-from-backup.js --env=production
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const DBHelper = require('./utils/db-helper');
const BackupHelper = require('./utils/backup-helper');
const logger = require('./utils/logger');

const BACKUP_DIR = path.resolve(__dirname, '../backups');

/**
 * Prompt user for confirmation
 */
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  try {
    logger.section('Cloudinary to R2 - Restore from Backup');

    // Parse arguments
    const args = process.argv.slice(2);
    const isProduction = args.includes('--env=production');
    const backupArg = args.find((arg) => arg.startsWith('--backup='));
    const requestedBackup = backupArg ? backupArg.split('=')[1] : null;

    logger.info(`Environment: ${isProduction ? 'Production' : 'Local'}`);

    // List available backups
    logger.section('Available Backups');
    const backups = BackupHelper.listBackups(BACKUP_DIR);

    if (backups.length === 0) {
      logger.error('No backups found in ./backups/');
      process.exit(1);
    }

    backups.forEach((backup, index) => {
      logger.info(`${index + 1}. ${backup.timestamp} (${backup.files.length} files)`);
    });

    // Select backup
    let selectedBackup;
    if (requestedBackup) {
      selectedBackup = backups.find((b) => b.timestamp === requestedBackup);
      if (!selectedBackup) {
        logger.error(`Backup not found: ${requestedBackup}`);
        process.exit(1);
      }
      logger.info(`Using backup: ${selectedBackup.timestamp}`);
    } else {
      selectedBackup = backups[0]; // Most recent
      logger.info(`Using most recent backup: ${selectedBackup.timestamp}`);
    }

    // Find backup files
    const dbBackup = selectedBackup.files.find(
      (f) => f.startsWith('data.db.backup-') || f.endsWith('.sql')
    );

    if (!dbBackup) {
      logger.error('Database backup file not found');
      process.exit(1);
    }

    const dbBackupPath = path.join(BACKUP_DIR, dbBackup);

    // Warning
    logger.warn('\n⚠️  WARNING: This will overwrite your current database!');
    logger.info(`Backup file: ${dbBackup}`);

    const confirmed = await prompt('\nAre you sure you want to restore? (y/N): ');

    if (!confirmed) {
      logger.info('Restore cancelled');
      process.exit(0);
    }

    // Initialize database connection
    logger.section('Restoring Database');
    const dbClient = process.env.DATABASE_CLIENT || 'sqlite';

    if (dbClient === 'sqlite') {
      const dbPath = path.resolve(process.cwd(), process.env.DATABASE_FILENAME || '.tmp/data.db');
      BackupHelper.restoreSQLite(dbBackupPath, dbPath);
      logger.success(`Database restored from: ${dbBackup}`);
    } else {
      const connectionString = process.env.DATABASE_PRIVATE_URL || process.env.DATABASE_URL;
      BackupHelper.restorePostgreSQL(dbBackupPath, connectionString);
      logger.success(`Database restored from: ${dbBackup}`);
    }

    // Verify restoration
    logger.section('Verification');
    const db = await DBHelper.init(process.env);
    const cloudinaryCount = await db.getFileCountByProvider('cloudinary');
    const r2Count = await db.getFileCountByProvider('aws-s3');

    logger.stats({
      'Cloudinary Files': cloudinaryCount,
      'R2 Files': r2Count,
    });

    await db.close();

    logger.complete('Restore completed successfully');

    logger.info('\nNext steps:');
    logger.info('1. Verify data in Strapi Media Library');
    logger.info('2. If correct, you can re-run migration if needed');
  } catch (error) {
    logger.error(`Restore failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = main;
