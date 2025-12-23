#!/usr/bin/env node

/**
 * Backup Before Migration
 * Creates comprehensive backups before migrating from Cloudinary to R2
 *
 * Usage:
 *   node scripts/backup-before-migration.js
 *   node scripts/backup-before-migration.js --env=production
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const DBHelper = require('./utils/db-helper');
const BackupHelper = require('./utils/backup-helper');
const logger = require('./utils/logger');

const BACKUP_DIR = path.resolve(__dirname, '../backups');

async function main() {
  try {
    logger.section('Cloudinary to R2 - Pre-Migration Backup');

    // Parse arguments
    const args = process.argv.slice(2);
    const isProduction = args.includes('--env=production');

    logger.info(`Environment: ${isProduction ? 'Production' : 'Local'}`);

    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      logger.success('Created backup directory');
    }

    // Initialize database
    logger.info('Connecting to database...');
    const db = await DBHelper.init(process.env);
    logger.success(`Connected to ${db.client} database`);

    // Get Cloudinary files count
    const files = await db.getCloudinaryFiles();
    logger.info(`Found ${files.length} Cloudinary files to backup`);

    if (files.length === 0) {
      logger.warn('No Cloudinary files found. Nothing to backup.');
      await db.close();
      return;
    }

    // Step 1: Backup Database
    logger.section('Step 1: Database Backup');
    let databaseBackup;

    if (db.client === 'sqlite') {
      const dbPath = path.resolve(process.cwd(), process.env.DATABASE_FILENAME || '.tmp/data.db');
      databaseBackup = BackupHelper.backupSQLite(dbPath, BACKUP_DIR);
      logger.success(`SQLite database backed up to: ${path.basename(databaseBackup)}`);
    } else {
      const connectionString = process.env.DATABASE_PRIVATE_URL || process.env.DATABASE_URL;
      databaseBackup = BackupHelper.backupPostgreSQL(connectionString, BACKUP_DIR);
      logger.success(`PostgreSQL database backed up to: ${path.basename(databaseBackup)}`);
    }

    // Step 2: Export to JSON
    logger.section('Step 2: JSON Export');
    const jsonBackup = await BackupHelper.exportToJSON(db, BACKUP_DIR);
    logger.success(`JSON backup created: ${path.basename(jsonBackup)} (${files.length} files)`);

    // Step 3: Export to CSV
    logger.section('Step 3: CSV Mapping Table');
    const csvBackup = await BackupHelper.exportToCSV(db, BACKUP_DIR);
    logger.success(`CSV mapping created: ${path.basename(csvBackup)}`);

    // Step 4: Verify backups
    logger.section('Step 4: Verification');
    const verifications = [
      { name: 'Database backup', path: databaseBackup },
      { name: 'JSON backup', path: jsonBackup },
      { name: 'CSV backup', path: csvBackup },
    ];

    let allVerified = true;
    for (const { name, path: filePath } of verifications) {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        logger.success(`${name}: ${(stats.size / 1024).toFixed(2)} KB`);
      } else {
        logger.error(`${name}: NOT FOUND`);
        allVerified = false;
      }
    }

    if (!allVerified) {
      throw new Error('Backup verification failed');
    }

    // Step 5: Generate report
    logger.section('Step 5: Backup Report');
    const backupInfo = {
      databaseType: db.client,
      databaseBackup,
      jsonBackup,
      csvBackup,
      totalFiles: files.length,
      status: 'COMPLETED',
    };

    const reportPath = BackupHelper.generateReport(backupInfo, BACKUP_DIR);
    logger.success(`Backup report: ${path.basename(reportPath)}`);

    // Close database
    await db.close();

    // Summary
    logger.section('Backup Summary');
    logger.stats({
      'Total Files': files.length,
      'Database Backup': path.basename(databaseBackup),
      'JSON Backup': path.basename(jsonBackup),
      'CSV Mapping': path.basename(csvBackup),
      'Report': path.basename(reportPath),
    });

    logger.complete('Backup completed successfully');

    logger.info('\nNext steps:');
    logger.info('1. Verify backup files in ./backups/');
    logger.info('2. Run migration: node scripts/migrate-to-r2.js');
    logger.info('3. If needed, restore: node scripts/restore-from-backup.js');
  } catch (error) {
    logger.error(`Backup failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = main;
