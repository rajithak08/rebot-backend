//mail verification service
//we will use nodemailer to send verification emails to users
//we will send them otp to verify their email address
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendVerificationEmail = async (to, otp) => {
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
    to,
    subject: "Login OTP Verification - Rebot",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background-color: #22c55e;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .otp-box {
              background-color: #f3f4f6;
              border: 2px dashed #22c55e;
              padding: 20px;
              text-align: center;
              margin: 20px 0;
              border-radius: 8px;
            }
            .otp-code {
              font-size: 32px;
              font-weight: bold;
              color: #22c55e;
              letter-spacing: 8px;
            }
            .warning {
              color: #dc2626;
              font-size: 14px;
              margin-top: 20px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Login Verification</h1>
            </div>
            <div class="content">
              <h2>Hello!</h2>
              <p>You have requested to login to your Rebot account. Please use the following OTP to complete your login:</p>
              
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
              </div>
              
              <p><strong>This OTP is valid for 2 minutes only.</strong></p>
              
              <p>If you didn't request this OTP, please ignore this email and ensure your account is secure.</p>
              
              <div class="warning">
                ⚠️ Never share this OTP with anyone. Rebot staff will never ask for your OTP.
              </div>
            </div>
            <div class="footer">
              <p>© 2025 Rebot. All rights reserved.</p>
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Your OTP for login verification is: ${otp}. It is valid for 2 minutes only. Never share this OTP with anyone.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Login OTP sent to ${to}`);
  } catch (error) {
    console.error(`Error sending OTP email to ${to}:`, error);
    throw new Error("Could not send OTP email");
  }
};

export const sendCertificateApprovalEmail = async (
  to,
  userName,
  certificateType,
  certificateNumber
) => {
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
    to,
    subject: "Certificate Approved - Rebot",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background-color: #22c55e;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .certificate-box {
              background-color: #f0fdf4;
              border-left: 4px solid #22c55e;
              padding: 20px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .certificate-details {
              margin: 10px 0;
            }
            .certificate-details strong {
              color: #15803d;
            }
            .success-icon {
              font-size: 48px;
              text-align: center;
              margin: 20px 0;
            }
            .cta-button {
              display: inline-block;
              background-color: #22c55e;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin-top: 20px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Certificate Approved</h1>
            </div>
            <div class="content">
              <div class="success-icon">🎉</div>
              <h2>Congratulations, ${userName}!</h2>
              <p>Your certificate has been <strong style="color: #22c55e;">approved</strong> by our admin team.</p>
              
              <div class="certificate-box">
                <div class="certificate-details">
                  <strong>Document Type:</strong> ${certificateType}
                </div>
                <div class="certificate-details">
                  <strong>Certificate Number:</strong> ${certificateNumber}
                </div>
                <div class="certificate-details">
                  <strong>Status:</strong> <span style="color: #22c55e; font-weight: bold;">APPROVED ✓</span>
                </div>
              </div>
              
              <p>You can now place bids on listings and participate fully in the Rebot recycling marketplace.</p>
              
              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/recycler/certificates" class="cta-button">
                  View My Certificates
                </a>
              </div>
            </div>
            <div class="footer">
              <p>© 2025 Rebot. All rights reserved.</p>
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Congratulations ${userName}! Your certificate (${certificateType} - ${certificateNumber}) has been approved. You can now place bids on listings.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Certificate approval email sent to ${to}`);
  } catch (error) {
    console.error(`Error sending certificate approval email to ${to}:`, error);
    throw new Error("Could not send certificate approval email");
  }
};

export const sendCertificateDisapprovalEmail = async (
  to,
  userName,
  certificateType,
  certificateNumber
) => {
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
    to,
    subject: "Certificate Disapproved - Rebot",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background-color: #dc2626;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .certificate-box {
              background-color: #fef2f2;
              border-left: 4px solid #dc2626;
              padding: 20px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .certificate-details {
              margin: 10px 0;
            }
            .certificate-details strong {
              color: #991b1b;
            }
            .info-icon {
              font-size: 48px;
              text-align: center;
              margin: 20px 0;
            }
            .next-steps {
              background-color: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .cta-button {
              display: inline-block;
              background-color: #22c55e;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin-top: 20px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>❌ Certificate Disapproved</h1>
            </div>
            <div class="content">
              <div class="info-icon">📋</div>
              <h2>Hello ${userName},</h2>
              <p>We regret to inform you that your certificate has been <strong style="color: #dc2626;">disapproved</strong> by our admin team.</p>
              
              <div class="certificate-box">
                <div class="certificate-details">
                  <strong>Document Type:</strong> ${certificateType}
                </div>
                <div class="certificate-details">
                  <strong>Certificate Number:</strong> ${certificateNumber}
                </div>
                <div class="certificate-details">
                  <strong>Status:</strong> <span style="color: #dc2626; font-weight: bold;">DISAPPROVED ✗</span>
                </div>
              </div>
              
              <div class="next-steps">
                <h3 style="margin-top: 0; color: #92400e;">📌 Next Steps</h3>
                <ul style="margin: 10px 0;">
                  <li>Review your certificate details and ensure all information is accurate</li>
                  <li>Verify that the document is clear and legible</li>
                  <li>Check that the certificate is issued by a recognized authority</li>
                  <li>Ensure the validity period is current</li>
                  <li>Upload a new certificate with correct information</li>
                </ul>
              </div>
              
              <p>You can upload a new certificate or update the existing one with the correct information.</p>
              
              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/recycler/certificates" class="cta-button">
                  Upload New Certificate
                </a>
              </div>
              
              <p style="margin-top: 20px; font-size: 14px; color: #666;">
                If you believe this is a mistake or need assistance, please contact our support team.
              </p>
            </div>
            <div class="footer">
              <p>© 2025 Rebot. All rights reserved.</p>
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Hello ${userName}, Your certificate (${certificateType} - ${certificateNumber}) has been disapproved. Please review and upload a new certificate with correct information.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Certificate disapproval email sent to ${to}`);
  } catch (error) {
    console.error(
      `Error sending certificate disapproval email to ${to}:`,
      error
    );
    throw new Error("Could not send certificate disapproval email");
  }
};

export const sendOtpForResetPassword = async (to, otp) => {
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
    to,
    subject: "Password Reset OTP - Rebot",
    html: `
      <p>Your OTP for password reset is: <strong>${otp}</strong></p>
      <p>This OTP is valid for 10 minutes only.</p>
      <p>If you didn't request this OTP, please ignore this email.</p>
    `,
    text: `Your OTP for password reset is: ${otp}. It is valid for 10 minutes only. If you didn't request this OTP, please ignore this email.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset OTP sent to ${to}`);
  } catch (error) {
    console.error(`Error sending password reset OTP email to ${to}:`, error);
    throw new Error("Could not send password reset OTP email");
  }
};


