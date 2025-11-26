const logger = require('../utils/logger');
const { scrapeBcvRate, scrapeBinanceAndMxyz } = require('../services/fiatScraper');

function scheduleDailyBcvJob() {
  const pair = 'USDVES';

  const runJob = async () => {
    try {
      logger.info('[FIAT Scheduler] Running BCV job');
      const row = await scrapeBcvRate(pair);
      if (!row) {
        logger.warn('[FIAT Scheduler] BCV job finished with no rate inserted');
      } else {
        logger.info('[FIAT Scheduler] BCV job inserted rate', {
          id: row.id,
          rate: row.rate,
          capturedAt: row.captured_at
        });
      }
    } catch (error) {
      logger.error('[FIAT Scheduler] Error running BCV job', error);
    }
  };

  const now = new Date();
  const target = new Date(now);
  target.setHours(16, 30, 0, 0); // 16:30 hora local del servidor

  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  const delay = target.getTime() - now.getTime();
  logger.info('[FIAT Scheduler] Next BCV job scheduled in ms', { delay, nextRun: target.toISOString() });

  setTimeout(() => {
    runJob();
    setInterval(runJob, 24 * 60 * 60 * 1000);
  }, delay);
}

function startBinanceJob() {
  const pair = 'USDVES';

  const runJob = async () => {
    try {
      logger.info('[FIAT Scheduler] Running Binance/MundoXYZ job');
      const { binance, mundoxyz } = await scrapeBinanceAndMxyz(pair);

      if (!binance) {
        logger.warn('[FIAT Scheduler] Binance job finished with no rate inserted');
      } else {
        logger.info('[FIAT Scheduler] Binance job inserted rate', {
          id: binance.id,
          rate: binance.rate,
          capturedAt: binance.captured_at
        });
      }

      if (mundoxyz) {
        logger.info('[FIAT Scheduler] MundoXYZ operational rate inserted', {
          id: mundoxyz.id,
          rate: mundoxyz.rate,
          capturedAt: mundoxyz.captured_at
        });
      }
    } catch (error) {
      logger.error('[FIAT Scheduler] Error running Binance/MundoXYZ job', error);
    }
  };

  // Ejecutar una vez al inicio
  runJob();

  // Luego cada hora
  const intervalMs = 60 * 60 * 1000;
  logger.info('[FIAT Scheduler] Binance/MundoXYZ job interval (ms)', { intervalMs });
  setInterval(runJob, intervalMs);
}

function start() {
  try {
    scheduleDailyBcvJob();
  } catch (error) {
    logger.error('[FIAT Scheduler] Failed to schedule BCV job', error);
  }

  try {
    startBinanceJob();
  } catch (error) {
    logger.error('[FIAT Scheduler] Failed to start Binance/MundoXYZ job', error);
  }
}

module.exports = {
  start
};
