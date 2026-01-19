import sgMail from '@sendgrid/mail';

/**
 * Initialize SendGrid with API key from environment
 */
function getSendGridClient() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY environment variable is not set');
  }
  sgMail.setApiKey(apiKey);
  return sgMail;
}

/**
 * Send verification email using SendGrid
 */
export async function sendVerificationEmail(
  email: string,
  verificationToken: string
): Promise<void> {
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@polybuys.app';
  const client = getSendGridClient();

  const verificationLink = `${process.env.APP_URL || 'https://polybuys.app'}/auth/verify-email?token=${encodeURIComponent(verificationToken)}&email=${encodeURIComponent(email)}`;

  const msg = {
    to: email,
    from: fromEmail,
    subject: 'Verify your PolyBuys account',
    text: `Welcome to PolyBuys! Please verify your Cal Poly email address by clicking the link below:\n\n${verificationLink}\n\nOr enter this verification code: ${verificationToken}\n\nThis link will expire in 24 hours.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f4e3d;">Welcome to PolyBuys!</h2>
        <p>Please verify your Cal Poly email address to complete your account setup.</p>
        <p style="margin: 20px 0;">
          <a href="${verificationLink}" style="background-color: #1f4e3d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Verify Email Address
          </a>
        </p>
        <p>Or enter this verification code:</p>
        <p style="font-size: 24px; font-weight: bold; color: #1f4e3d; letter-spacing: 4px; margin: 20px 0;">
          ${verificationToken}
        </p>
        <p style="color: #666; font-size: 12px;">
          This link will expire in 24 hours. If you didn't create a PolyBuys account, please ignore this email.
        </p>
      </div>
    `,
  };

  try {
    await client.send(msg);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email. Please try again later.');
  }
}
