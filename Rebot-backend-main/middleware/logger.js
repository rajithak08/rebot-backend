import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import fs from "fs";

const isVercel = Boolean(process.env.VERCEL);
const useFileTransports = !isVercel;

// Create logs directory only for non-serverless environments
const logsDir = path.join(process.cwd(), "logs");
if (useFileTransports && !fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }

    return log;
  }),
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    let log = `${timestamp} ${level}: ${message}`;
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  }),
);

// Define transports
const transports = [
  new winston.transports.Console({
    level: process.env.NODE_ENV === "production" ? "warn" : "debug",
    format: consoleFormat,
  }),
];

if (useFileTransports) {
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxSize: "20m",
      maxFiles: "14d",
      format: logFormat,
    }),
    new DailyRotateFile({
      filename: path.join(logsDir, "combined-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "7d",
      format: logFormat,
    }),
    new DailyRotateFile({
      filename: path.join(logsDir, "access-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "info",
      maxSize: "20m",
      maxFiles: "7d",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  );
}

const exceptionHandlers = [
  new winston.transports.Console({ format: consoleFormat }),
];
const rejectionHandlers = [
  new winston.transports.Console({ format: consoleFormat }),
];

if (useFileTransports) {
  exceptionHandlers.push(
    new winston.transports.File({
      filename: path.join(logsDir, "exceptions.log"),
      format: logFormat,
    }),
  );

  rejectionHandlers.push(
    new winston.transports.File({
      filename: path.join(logsDir, "rejections.log"),
      format: logFormat,
    }),
  );
}

// Create Winston logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: { service: "rebot-backend" },
  transports,
  exceptionHandlers,
  rejectionHandlers,
  exitOnError: false,
});

// Request logging middleware
export const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log request
  logger.info("Incoming request", {
    method: req.method,
    url: req.url,
    userAgent: req.get("User-Agent"),
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user?.id || "anonymous",
    requestId: req.id || Date.now().toString(),
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - start;

    // Log response
    logger.info("Request completed", {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id || "anonymous",
      requestId: req.id || Date.now().toString(),
    });

    // Log slow requests
    if (duration > 1000) {
      logger.warn("Slow request detected", {
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        userId: req.user?.id || "anonymous",
      });
    }

    originalEnd.apply(this, args);
  };

  next();
};

// Error logging middleware
export const errorLogger = (err, req, res, next) => {
  logger.error("Request error", {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    userId: req.user?.id || "anonymous",
    requestId: req.id || Date.now().toString(),
    body: req.body,
    params: req.params,
    query: req.query,
  });

  next(err);
};

// Performance monitoring middleware
export const performanceLogger = (req, res, next) => {
  const start = process.hrtime();

  res.on("finish", () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const duration = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds

    if (duration > 500) {
      // Log if request takes more than 500ms
      logger.warn("Performance warning", {
        method: req.method,
        url: req.url,
        duration: `${duration.toFixed(2)}ms`,
        statusCode: res.statusCode,
        userId: req.user?.id || "anonymous",
      });
    }
  });

  next();
};

// Database operation logger
export const dbLogger = {
  info: (operation, data = {}) => {
    logger.info(`Database operation: ${operation}`, {
      type: "database",
      operation,
      ...data,
    });
  },
  error: (operation, error, data = {}) => {
    logger.error(`Database error: ${operation}`, {
      type: "database",
      operation,
      error: error.message,
      stack: error.stack,
      ...data,
    });
  },
};

// Authentication logger
export const authLogger = {
  success: (userId, action, data = {}) => {
    logger.info(`Auth success: ${action}`, {
      type: "authentication",
      action,
      userId,
      ...data,
    });
  },
  failure: (action, reason, data = {}) => {
    logger.warn(`Auth failure: ${action}`, {
      type: "authentication",
      action,
      reason,
      ...data,
    });
  },
};

// Security logger
export const securityLogger = {
  warn: (event, data = {}) => {
    logger.warn(`Security event: ${event}`, {
      type: "security",
      event,
      ...data,
    });
  },
  critical: (event, data = {}) => {
    logger.error(`Critical security event: ${event}`, {
      type: "security",
      event,
      ...data,
    });
  },
};

// Application logger for general use
export const appLogger = {
  debug: (message, meta = {}) =>
    logger.debug(message, { type: "application", ...meta }),
  info: (message, meta = {}) =>
    logger.info(message, { type: "application", ...meta }),
  warn: (message, meta = {}) =>
    logger.warn(message, { type: "application", ...meta }),
  error: (message, error = null, meta = {}) => {
    if (error && error.stack) {
      logger.error(message, {
        type: "application",
        error: error.message,
        stack: error.stack,
        ...meta,
      });
    } else {
      logger.error(message, { type: "application", ...meta });
    }
  },
};

export default logger;
