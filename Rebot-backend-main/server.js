import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import session from "express-session";
import passport from "./config/passport.js";

//db connection
import { connectDB } from "./db/db.js";

//import routes
import userRoutes from "./routes/user.route.js";
import listingRoutes from "./routes/listing.route.js";
import certificateRoutes from "./routes/certificate.route.js";
import chatRoutes from "./routes/chat.route.js";
import deliveryRoutes from "./routes/delivery.route.js";
import bidRoutes from "./routes/bid.route.js";
import transactionRoutes from "./routes/transaction.route.js";
import authRoutes from "./routes/auth.route.js";
import analyticsRoutes from "./routes/analytics.route.js";
import paymentRoutes from "./routes/payment.route.js";
// Import Socket handlers
import {
  authenticateSocket,
  handleConnection,
} from "./socket/socketHandlers.js";

// Import Swagger configuration and Scalar API Reference
import { specs } from "./swagger.js";
import { apiReference } from "@scalar/express-api-reference";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? [
            "https://rebootify.aadi01.me",
            "https://www.rebootify.aadi01.me",
            "https://rebot-frontend.vercel.app",
          ]
        : [
            "http://localhost:5173",
            "http://localhost:3001",
            "http://localhost:3005",
          ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3001;
const IS_VERCEL = Boolean(process.env.VERCEL);

//middleware
import cookieParser from "cookie-parser";
import {
  requestLogger,
  errorLogger,
  performanceLogger,
  appLogger,
  dbLogger,
} from "./middleware/logger.js";

// Configure CORS based on environment
const corsOptions = {
  origin:
    process.env.NODE_ENV === "production"
      ? [
          "https://rebootify.aadi01.me",
          "https://www.rebootify.aadi01.me",
          "https://rebot-frontend.vercel.app",
        ]
      : [
          "http://localhost:3001",
          "http://localhost:3005",
          "http://localhost:5173",
        ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
};

// Logging middleware - should be early in the chain
app.use(requestLogger);
app.use(performanceLogger);

app.use(cors(corsOptions));

// Capture raw body for Razorpay webhook signature verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.path === "/api/payments/webhook") {
        req.rawBody = buf.toString();
      }
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration for passport
app.use(
  session({
    secret: process.env.ACCESS_TOKEN_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());
// Serve static files from uploads directory
app.use("/uploads", express.static("uploads"));

// Socket.IO middleware and connection handling
io.use(authenticateSocket);
io.on("connection", handleConnection(io));

app.use(
  "/ref",
  apiReference({
    spec: {
      content: specs,
    },
    metaData: {
      title: "Rebot Backend API Documentation",
    },
    configuration: {
      theme: "default",
    },
  }),
);
app.use(async (req, res, next) => {
  try {
    await connectDB();
    dbLogger.info("Database connected successfully");
    next();
  } catch (error) {
    dbLogger.error("Database connection", error);
    res.status(500).json({ error: "Database connection failed" });
  }
});
// Legacy redirect for old Swagger path
app.get("/api-docs", (req, res) => {
  res.redirect("/ref");
});

// Also redirect /reference to new /ref path
app.get("/reference", (req, res) => {
  res.redirect("/ref");
});

// Provide API documentation as JSON endpoint
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(specs);
});

//routes
app.use("/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/deliveries", deliveryRoutes);
app.use("/api/bids", bidRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/payments", paymentRoutes);

// Error logging middleware - should be after all routes
app.use(errorLogger);

// Global error handler
app.use((err, req, res, next) => {
  appLogger.error("Unhandled error", err, {
    method: req.method,
    url: req.url,
    userId: req.user?.id,
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

// Root endpoint with API documentation links
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Rebot Backend API",
    documentation: {
      scalar_api: `${process.env.BASE_URL}/ref`,
    },

    version: "1.0.0",
    status: "active",
  });
});

if (!IS_VERCEL) {
  server.listen(PORT, () => {
    appLogger.info(`Server started on port ${PORT}`, {
      port: PORT,
      environment: process.env.NODE_ENV || "development",
      apiDocs: `${process.env.BASE_URL || `http://localhost:${PORT}`}/ref`,
    });

    console.log(`Server is running on port ${PORT}`);
    console.log(
      `API Documentation: ${process.env.BASE_URL || `http://localhost:${PORT}`}/ref`,
    );
    console.log(
      `Legacy Swagger UI: ${process.env.BASE_URL || `http://localhost:${PORT}`}/api-docs`,
    );
  });
}

export default app;
