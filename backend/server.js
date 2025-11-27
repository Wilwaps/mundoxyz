require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { createServer } = require('http');
const { Server } = require('socket.io');
const logger = require('./utils/logger');
const config = require('./config/config');
const { initDatabase } = require('./db');
const { initRedis } = require('./services/redis');
const fiatRatesScheduler = require('./jobs/fiatRatesScheduler');

// Import routes
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const economyRoutes = require('./routes/economy');
const welcomeRoutes = require('./routes/welcome');
const adminRoutes = require('./routes/admin');
const rolesRoutes = require('./routes/roles');
const healthRoutes = require('./routes/health');
const gameRoutes = require('./routes/games');
const bingoV2Routes = require('./routes/bingoV2');
const marketRoutes = require('./routes/market');
const tictactoeRoutes = require('./routes/tictactoe');
const roomsRoutes = require('./routes/rooms');
const diagnosticRoutes = require('./routes/diagnostic');
const debugXpRoutes = require('./routes/debug-xp');
const telegramWebhookRoutes = require('./routes/telegram-webhook');
const rafflesV2Routes = require('./modules/raffles/routes');
const experienceRoutes = require('./routes/experience');
const messagesRoutes = require('./routes/messages');
const commissionsRoutes = require('./routes/commissions');
const poolRoutes = require('./routes/pool');
const caidaRoutes = require('./routes/caida');
const storeCoreRoutes = require('./routes/store/core');
const storeOrderRoutes = require('./routes/store/orders');
const storeInventoryRoutes = require('./routes/store/inventory');
const storeMessagingRoutes = require('./routes/store/messaging');
const storeCashRoutes = require('./routes/store/cash');
const storeReportsRoutes = require('./routes/store/reports');
const storeStaffRoutes = require('./routes/admin/store-staff');
const referralRoutes = require('./routes/referrals');

// Create Express app
const app = express();
const server = createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow same origins as Express CORS
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        config.server.frontendUrl,
        'http://localhost:3000',
        'http://localhost:3001',
        'https://web.telegram.org',
        'https://telegram.org',
        /^https:\/\/.*\.telegram\.org$/,
        /^https?:\/\/.*\.up\.railway\.app$/
      ];

      const isAllowed = allowedOrigins.some(allowed => {
        if (!allowed) return false;
        if (allowed instanceof RegExp) return allowed.test(origin);
        return allowed === origin;
      });

      callback(null, isAllowed);
    },
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Initialize Bingo V2 Socket handlers
const handleBingoV2Socket = require('./socket/bingoV2');
handleBingoV2Socket(io);

// Initialize Raffle V2 Socket handler
const RaffleSocketHandler = require('./modules/raffles/socket/events');
const raffleSocketHandler = new RaffleSocketHandler(io);

// Make io available globally for services
global.io = io;

// Socket.IO connection handler
io.on('connection', (socket) => {
  logger.info('New socket connection:', socket.id);

  // Get userId from socket handshake
  const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;
  // Join personal user room to receive direct notifications
  if (userId) {
    try {
      socket.join(`user_${userId}`);
      logger.info(`Socket ${socket.id} joined personal room user_${userId}`);
    } catch (e) {
      logger.warn('Failed to join personal room', { userId, error: e?.message });
    }
  }

  // Initialize TicTacToe socket handlers
  const { initTicTacToeSocket } = require('./socket/tictactoe');
  initTicTacToeSocket(io, socket);

  // Initialize Pool socket handlers
  const { initPoolSocket } = require('./socket/pool');
  initPoolSocket(io, socket);

  // Initialize Caída socket handlers
  const { initCaidaSocket } = require('./socket/caida');
  initCaidaSocket(io, socket);

  // Initialize Unified Chat socket handlers
  const globalChatHandler = require('./socket/globalChat');
  const anonymousChatHandler = require('./socket/anonymousChat');
  const roomChatHandler = require('./socket/roomChat');
  const ronChatHandler = require('./socket/ronChat');

  globalChatHandler(io, socket);
  anonymousChatHandler(io, socket);
  roomChatHandler(io, socket);
  ronChatHandler(io, socket);

  // Initialize Raffle socket handlers
  if (userId) {
    raffleSocketHandler.handleConnection(socket, userId);
  }

  socket.on('disconnect', () => {
    logger.info('Socket disconnected:', socket.id);
  });
});

// Make io available to routes
app.set('io', io);

// Readiness flags
let dbReady = false;
let redisReady = false;

// Trust proxy - restrict to first proxy (required behind Railway/Heroku) to avoid permissive setting
// This satisfies express-rate-limit security checks and ensures correct client IPs
app.set('trust proxy', 1);
logger.info('Trust proxy enabled (1 hop)');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "https://telegram.org", "https://web.telegram.org"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://telegram.org", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: ["'self'", "wss:", "https:", "http:"],
      frameSrc: ["'self'", "https://web.telegram.org"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"]
    }
  },
  crossOriginEmbedderPolicy: false,
  frameguard: false // Deshabilitado para Telegram WebApp
}));

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      config.server.frontendUrl,
      'http://localhost:3000',
      'http://localhost:3001',
      'https://web.telegram.org',
      'https://telegram.org',
      /^https:\/\/.*\.telegram\.org$/,
      /^https?:\/\/.*\.up\.railway\.app$/
    ];

    const isAllowed = allowedOrigins.some(allowed => {
      if (!allowed) return false;
      if (allowed instanceof RegExp) return allowed.test(origin);
      return allowed === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'x-admin-username', 'x-admin-code', 'x-test-runner']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.maxRequests,
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for test runner
    if (config.server.allowTestRunner && req.headers['x-test-runner'] === 'testsprite') {
      return true;
    }
    // Skip for Telegram user agent
    if (req.headers['user-agent'] && req.headers['user-agent'].includes('TelegramBot')) {
      return true;
    }
    return false;
  }
});

// Block API requests until DB is ready
app.use('/api', (req, res, next) => {
  if (!dbReady) {
    return res.status(503).json({ error: 'Service initializing, please retry' });
  }
  next();
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  next();
});

// Serve static files in production
const buildPath = path.join(__dirname, '../frontend/build');
if (process.env.NODE_ENV === 'production' || fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  logger.info(`Serving static files from: ${buildPath}`);
}

const marketingPath = path.join(__dirname, '../marketing');
if (fs.existsSync(marketingPath)) {
  app.use('/marketing', express.static(marketingPath));
  logger.info(`Serving marketing command center from: ${marketingPath}`);
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/economy', economyRoutes);
app.use('/api/welcome', welcomeRoutes);
app.use('/api/gifts', require('./routes/gifts'));
app.use('/api/admin', adminRoutes);
app.use('/api/audit', require('./routes/audit')); // TEMPORAL - Auditoría exploit reembolsos
app.use('/api/public', require('./routes/public')); // Rutas públicas (landing page)
app.use('/api/roles', rolesRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/tictactoe', (req, res, next) => {
  req.io = io;
  next();
}, tictactoeRoutes);
app.use('/api/pool', (req, res, next) => {
  req.io = io;
  next();
}, poolRoutes);
app.use('/api/caida', (req, res, next) => {
  req.io = io;
  next();
}, caidaRoutes);

// Store Routes
app.use('/api/store', (req, res, next) => { req.io = io; next(); }, storeCoreRoutes);
app.use('/api/store/order', (req, res, next) => { req.io = io; next(); }, storeOrderRoutes);
app.use('/api/store/inventory', (req, res, next) => { req.io = io; next(); }, storeInventoryRoutes);
app.use('/api/store/messaging', (req, res, next) => { req.io = io; next(); }, storeMessagingRoutes);
app.use('/api/store', (req, res, next) => { req.io = io; next(); }, storeCashRoutes);
app.use('/api/store', (req, res, next) => { req.io = io; next(); }, storeReportsRoutes);
app.use('/api/admin/store-staff', storeStaffRoutes);

app.use('/api/bingo/v2', (req, res, next) => {
  req.io = io;
  next();
}, bingoV2Routes);
app.use('/api/market', marketRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/commissions', commissionsRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/diagnostic', diagnosticRoutes);
app.use('/api/debug-xp', debugXpRoutes);
app.use('/api/telegram', telegramWebhookRoutes);
app.use('/api/raffles/v2', rafflesV2Routes);
app.use('/api/experience', experienceRoutes);
app.use('/api/messages', messagesRoutes);

// Config endpoint for frontend
app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.send(`window.APP_CONFIG = {
    API_URL: '${config.server.apiUrl || ''}',
    TELEGRAM_BOT_USERNAME: '${config.telegram.botUsername}',
    PUBLIC_WEBAPP_URL: '${config.telegram.webappUrl}',
    FEATURES: {
      TTT_V2: ${config.features.tttV2},
      TTT_DB_WALLET: ${config.features.tttDbWallet},
      WELCOME_AUTOSTART: ${config.features.welcomeAutostart}
    }
  };`);
});

// Catch-all route for React app (production)
if (process.env.NODE_ENV === 'production' || fs.existsSync(buildPath)) {
  app.get('*', (req, res) => {
    const indexPath = path.join(buildPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Frontend build not found');
    }
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);

  // Don't leak error details in production
  const isDev = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Internal server error',
    stack: isDev ? err.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize services and start server
async function startServer() {
  try {
    const PORT = config.server.port;

    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📱 Telegram Bot: @${config.telegram.botUsername}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
    });

    (async () => {
      try {
        await initDatabase();
        dbReady = true;
        logger.info('✅ Database connected');

        // Start Bingo V2 failure detection job
        const bingoV2FailureDetection = require('./jobs/bingoV2FailureDetection');
        bingoV2FailureDetection.start();
        logger.info('✅ Bingo V2 Failure Detection Job started');

        // Start Gift Expiration Job
        const giftService = require('./services/giftService');
        setInterval(async () => {
          try {
            await giftService.expireOldGifts();
          } catch (error) {
            logger.error('Error in gift expiration job:', error);
          }
        }, 3600000); // Run every hour
        logger.info('✅ Gift Expiration Job started - runs every hour');

        // Start FIAT rates scheduler (BCV diario, Binance/MundoXYZ cada hora)
        try {
          fiatRatesScheduler.start();
          logger.info('✅ FIAT Rates Scheduler started');
        } catch (fiatError) {
          logger.error('Failed to start FIAT Rates Scheduler:', fiatError);
        }

      } catch (error) {
        logger.error('Failed to initialize database:', error);
      }
    })();

    (async () => {
      try {
        const redisClient = await initRedis();
        if (redisClient && redisClient.isOpen) {
          redisReady = true;
          logger.info('✅ Redis connected');
        } else {
          redisReady = false;
          logger.warn('Redis not connected. Continuing without cache.');
        }
      } catch (error) {
        redisReady = false;
        logger.error('Failed to initialize Redis:', error);
      }
    })();

    // Initialize Telegram bot
    (async () => {
      try {
        const bot = require('./bot/telegram-bot');
        const telegramService = require('./services/telegramService');
        if (bot) {
          telegramService.setBot(bot);
          logger.info('✅ Telegram bot started');
        } else {
          logger.warn('⚠️  Telegram bot not initialized (missing token)');
        }
      } catch (error) {
        logger.error('Failed to initialize Telegram bot:', error);
      }
    })();

    // ✅ NUEVO: Scheduler para limpiar reservas expiradas
    (async () => {
      try {
        const raffleService = require('./modules/raffles/services/RaffleServiceV2');

        // Ejecutar cada 30 segundos
        setInterval(async () => {
          try {
            const expired = await raffleService.cleanExpiredReservations();

            if (expired && Object.keys(expired).length > 0) {
              // Emitir eventos WebSocket por cada rifa afectada
              for (const [raffleId, numbers] of Object.entries(expired)) {
                // Obtener código de la rifa para el room
                const { query } = require('./db');
                const result = await query(
                  'SELECT code FROM raffles WHERE id = $1',
                  [raffleId]
                );

                if (result.rows.length > 0) {
                  const raffleCode = result.rows[0].code;
                  io.to(`raffle:${raffleCode}`).emit('numbers:released', {
                    numbers,
                    reason: 'expired'
                  });

                  logger.info('[Scheduler] Reservas liberadas', {
                    raffleCode,
                    count: numbers.length
                  });
                }
              }
            }
          } catch (err) {
            logger.error('[Scheduler] Error limpiando reservas:', err);
          }
        }, 30000); // 30 segundos

        logger.info('✅ Scheduler de reservas iniciado (cada 30s)');
      } catch (error) {
        logger.error('Failed to initialize reservation scheduler:', error);
      }
    })();

    // ✅ NUEVO: Scheduler para sorteos programados
    (async () => {
      try {
        const raffleService = require('./modules/raffles/services/RaffleServiceV2');
        const RaffleDrawScheduler = require('./modules/raffles/services/RaffleDrawScheduler');

        const drawScheduler = new RaffleDrawScheduler(raffleService);
        drawScheduler.start();

        logger.info('✅ Scheduler de sorteos programados iniciado (cada 60s)');
      } catch (error) {
        logger.error('Failed to initialize draw scheduler:', error);
      }
    })();

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

module.exports = { app, server };
