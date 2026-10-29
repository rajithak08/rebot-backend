import { generateToken } from "../utils/jwt.js";

// Google OAuth Success Handler
export const googleAuthSuccess = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=authentication_failed`
      );
    }

    // Generate JWT token
    const token = generateToken({
      id: req.user._id,
      email: req.user.email,
      userType: req.user.userType,
    });

    // Set token as httpOnly cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend with success
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/google/success?token=${token}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Google OAuth success handler error:", error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
  }
};

// Google OAuth Failure Handler
export const googleAuthFailure = (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL}/login?error=google_auth_failed`);
};
