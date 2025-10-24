require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { createServer } = require('http');
const logger = require('./utils/logger');
const config = require('./config/config');
const { initDatabase } = require('./db');
const { initRedis } = require('./services/redis');

// Import routes
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const economyRoutes = require('./routes/economy');
const welcomeRoutes = require('./routes/welcome');
const adminRoutes = require('./routes/admin');
const rolesRoutes = require('./routes/roles');
const gameRoutes = require('./routes/games');
const bingoRoutes = require('./routes/bingo');
const rafflesRoutes = require('./routes/raffles');
const marketRoutes = require('./routes/market');
const healthRoutes = require('./routes/health');

// Create Express app
const app = express();
const server = createServer(app);

// Trust proxy
if (config.server.trustProxyHops) {
  app.set('trust proxy', config.server.trustProxyHops);
}

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
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Allow Telegram origins
    const allowedOrigins = [
      config.server.frontendUrl,
      'https://web.telegram.org',
      'https://telegram.org',
      /^https:\/\/.*\.telegram\.org$/
    ];
    
    const isAllowed = allowedOrigins.some(allowed => {
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
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
}

// API Routes
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/economy', economyRoutes);
app.use('/api/welcome', welcomeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/games/bingo', bingoRoutes);
app.use('/api/raffles', rafflesRoutes);
app.use('/api/market', marketRoutes);

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
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
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
    // Initialize database
    await initDatabase();
    logger.info('✅ Database connected');
    
    // Initialize Redis
    await initRedis();
    logger.info('✅ Redis connected');
    
    // Start server
    const PORT = config.server.port;
    const HOST = config.server.host;
    
    server.listen(PORT, HOST, () => {
      logger.info(`🚀 Server running on http://${HOST}:${PORT}`);
      logger.info(`📱 Telegram Bot: @${config.telegram.botUsername}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
    });
    
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
