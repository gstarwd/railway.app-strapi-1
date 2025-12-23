#!/usr/bin/env node

/**
 * Migrate Cloudinary Files to Cloudflare R2
 * Main migration script
 *
 * Usage:
 *   node scripts/migrate-to-r2.js
 *   node scripts/migrate-to-r2.js --dry-run
 *   node scripts/migrate-to-r2.js --env=production
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { default: pLimit } = require('p-limit');
const DBHelper = require('./utils/db-helper');
const R2Uploader = require('./utils/r2-uploader');
const logger = require('./utils/logger');

const STATE_FILE = path.resolve(__dirname, 'migration-state.json');
const CONCURRENCY = 3; // Max concurrent uploads

/**
 * Load migration state
 */
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }

  return {
    migration_id: `migration-${new Date().toISOString().replace(/[:.]/g, '-').split('.')[0]}`,
    start_time: new Date().toISOString(),
    end_time: null,
    status: 'in_progress',
    statistics: {
      total_files: 0,
      processed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
    },
    processed_files: [],
    failed_files: [],
    skipped_files: [],
  };
}

/**
 * Save migration state
 */
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Download file from Cloudinary
 */
async function downloadFromCloudinary(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000, // 60 seconds
        maxContentLength: 100 * 1024 * 1024, // 100MB max
      });

      return Buffer.from(response.data);
    } catch (error) {
      if (i === retries - 1) {
        throw new Error(`Download failed after ${retries} retries: ${error.message}`);
      }
      logger.warn(`Download failed (attempt ${i + 1}/${retries}), retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
    }
  }
}

/**
 * Migrate single file
 */
async function migrateFile(file, uploader, db, dryRun = false) {
  const startTime = Date.now();

  try {
    logger.debug(`Processing: ${file.name} (ID: ${file.id})`);

    // Check if file exists on Cloudinary
    try {
      await axios.head(file.url, { timeout: 10000 });
    } catch (error) {
      if (error.response?.status === 404) {
        return {
          status: 'skipped',
          reason: 'File not found on Cloudinary (404)',
        };
      }
    }

    // Construct R2 key
    const key = `${file.hash}${file.ext}`;

    // Check if already exists in R2
    const exists = await uploader.fileExists(key);
    if (exists) {
      logger.debug(`File already exists in R2, skipping upload: ${key}`);
    }

    let r2Url;
    if (!dryRun && !exists) {
      // Download from Cloudinary
      const buffer = await downloadFromCloudinary(file.url);

      // Upload to R2
      r2Url = await uploader.upload({
        buffer,
        key,
        contentType: file.mime,
      });
    } else if (exists) {
      r2Url = uploader.getPublicUrl(key);
    } else {
      // Dry run
      r2Url = `[DRY-RUN] ${uploader.getPublicUrl(key)}`;
    }

    // Update database
    if (!dryRun) {
      await db.updateFileToR2(file.id, r2Url);
    }

    const duration = Date.now() - startTime;

    return {
      status: 'success',
      original_url: file.url,
      new_url: r2Url,
      file_size: file.size,
      upload_duration_ms: duration,
    };
  } catch (error) {
    return {
      status: 'failed',
      error: error.message,
      stack_trace: error.stack,
      retry_count: 3,
    };
  }
}

async function main() {
  try {
    logger.section('Cloudinary to R2 Migration');

    // Parse arguments
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const isProduction = args.includes('--env=production');

    if (dryRun) {
      logger.warn('DRY RUN MODE - No actual changes will be made');
    }

    logger.info(`Environment: ${isProduction ? 'Production' : 'Local'}`);

    // Initialize database
    logger.info('Connecting to database...');
    const db = await DBHelper.init(process.env);
    logger.success(`Connected to ${db.client} database`);

    // Initialize R2 uploader
    const uploader = R2Uploader.fromEnv(process.env);
    logger.success('R2 uploader initialized');

    // Load migration state
    const state = loadState();
    logger.info(`Migration ID: ${state.migration_id}`);

    // Get files to migrate
    const allFiles = await db.getCloudinaryFiles();
    const processedIds = state.processed_files.map((f) => f.id);
    const files = allFiles.filter((f) => !processedIds.includes(f.id));

    state.statistics.total_files = allFiles.length;

    logger.info(`Total Cloudinary files: ${allFiles.length}`);
    logger.info(`Already processed: ${processedIds.length}`);
    logger.info(`Remaining: ${files.length}`);

    if (files.length === 0) {
      logger.success('No files to migrate');
      await db.close();
      return;
    }

    // Migrate files with concurrency control
    logger.section('Migration Progress');

    const limit = pLimit(CONCURRENCY);
    let processed = 0;

    const promises = files.map((file) =>
      limit(async () => {
        try {
          if (!dryRun) {
            await db.beginTransaction();
          }

          const result = await migrateFile(file, uploader, db, dryRun);

          if (!dryRun) {
            await db.commit();
          }

          // Update state
          if (result.status === 'success') {
            state.statistics.success++;
            state.processed_files.push({
              id: file.id,
              ...result,
              timestamp: new Date().toISOString(),
            });
          } else if (result.status === 'failed') {
            state.statistics.failed++;
            state.failed_files.push({
              id: file.id,
              original_url: file.url,
              ...result,
              timestamp: new Date().toISOString(),
            });
          } else if (result.status === 'skipped') {
            state.statistics.skipped++;
            state.skipped_files.push({
              id: file.id,
              ...result,
              original_url: file.url,
              timestamp: new Date().toISOString(),
            });
          }

          processed++;
          state.statistics.processed = processed;
          saveState(state);

          logger.progress(processed, files.length, file.name);

          return result;
        } catch (error) {
          if (!dryRun) {
            await db.rollback();
          }

          logger.error(`Failed to migrate file ${file.id}: ${error.message}`);

          state.statistics.failed++;
          state.failed_files.push({
            id: file.id,
            original_url: file.url,
            status: 'failed',
            error: error.message,
            timestamp: new Date().toISOString(),
          });

          processed++;
          state.statistics.processed = processed;
          saveState(state);
        }
      })
    );

    await Promise.all(promises);

    // Update final state
    state.end_time = new Date().toISOString();
    state.status = state.statistics.failed > 0 ? 'completed_with_errors' : 'completed';
    saveState(state);

    // Close database
    await db.close();

    // Summary
    logger.section('Migration Summary');
    logger.stats({
      'Total Files': state.statistics.total_files,
      'Processed': state.statistics.processed,
      'Success': state.statistics.success,
      'Failed': state.statistics.failed,
      'Skipped': state.statistics.skipped,
      'Status': state.status,
    });

    if (state.statistics.failed > 0) {
      logger.warn(`\n${state.statistics.failed} files failed to migrate`);
      logger.info('Check migration-state.json for details');
    }

    logger.complete(`Migration ${state.status}`);

    if (!dryRun) {
      logger.info('\nNext steps:');
      logger.info('1. Verify images in Strapi Media Library');
      logger.info('2. Check migration-state.json for any failed files');
      logger.info('3. Monitor for 24-48 hours before cleaning Cloudinary');
    }
  } catch (error) {
    logger.error(`Migration failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = main;
