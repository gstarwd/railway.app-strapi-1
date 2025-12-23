/**
 * Logger utility for migration scripts
 * Provides colored console output and progress tracking
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

class Logger {
  constructor() {
    this.startTime = Date.now();
  }

  log(message, color = '') {
    const timestamp = new Date().toISOString();
    console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
  }

  info(message) {
    this.log(`ℹ ${message}`, colors.blue);
  }

  success(message) {
    this.log(`✓ ${message}`, colors.green);
  }

  warn(message) {
    this.log(`⚠ ${message}`, colors.yellow);
  }

  error(message) {
    this.log(`✗ ${message}`, colors.red);
  }

  debug(message) {
    this.log(`  ${message}`, colors.dim);
  }

  section(title) {
    console.log(`\n${colors.bright}${colors.cyan}=== ${title} ===${colors.reset}\n`);
  }

  progress(current, total, message = '') {
    const percentage = Math.round((current / total) * 100);
    const bar = this.createProgressBar(percentage);
    process.stdout.write(`\r${bar} ${percentage}% (${current}/${total}) ${message}`);
    if (current === total) {
      console.log(''); // New line when complete
    }
  }

  createProgressBar(percentage) {
    const filled = Math.round(percentage / 5);
    const empty = 20 - filled;
    return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
  }

  stats(stats) {
    console.log(`\n${colors.bright}Statistics:${colors.reset}`);
    Object.entries(stats).forEach(([key, value]) => {
      console.log(`  ${key}: ${colors.cyan}${value}${colors.reset}`);
    });
  }

  elapsed() {
    const duration = Date.now() - this.startTime;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }

  complete(message) {
    this.success(`${message} (took ${this.elapsed()})`);
  }
}

module.exports = new Logger();
