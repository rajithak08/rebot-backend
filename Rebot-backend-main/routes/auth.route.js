import express from "express";
import passport from "../config/passport.js";
import {
  googleAuthSuccess,
  googleAuthFailure,
} from "../controllers/auth.controller.js";

const router = express.Router();

// Google OAuth Routes
router.get("/google", (req, res, next) => {
  // Pass userType as state parameter
  const userType = req.query.userType || "user";
  passport.authenticate("google", {
    scope: ["profile", "email"],
    state: userType, // Pass userType through state
  })(req, res, next);
});

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/auth/google/failure",
    session: false,
  }),
  googleAuthSuccess
);

router.get("/google/failure", googleAuthFailure);

export default router;
