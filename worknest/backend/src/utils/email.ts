import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

/**
 * Email Service
 * Handles sending emails using Nodemailer
 */
class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // For development, use Mailtrap or a similar service
    // If no credentials are found, it will log to console
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.mailtrap.io",
      port: parseInt(process.env.SMTP_PORT || "2525"),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Send an email
   */
  async sendEmail(options: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    const mailOptions = {
      from: `"WorkNest" <${process.env.EMAIL_FROM || "noreply@worknest.com"}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    try {
      if (!process.env.SMTP_USER) {
        console.log("-----------------------------------------");
        console.log("EMAIL SIMULATION (No SMTP credentials)");
        console.log(`To: ${options.to}`);
        console.log(`Subject: ${options.subject}`);
        console.log(`Body: ${options.text}`);
        console.log("-----------------------------------------");
        return;
      }
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error("Email sending failed:", error);
      // Don't throw error in dev, just log it
      if (process.env.NODE_ENV === "production") {
        throw error;
      }
    }
  }

  /**
   * Send Welcome Email
   */
  async sendWelcomeEmail(
    to: string,
    userName: string,
    orgName: string,
    subdomain: string
  ): Promise<void> {
    const loginUrl = `http://${subdomain}.${
      process.env.BASE_DOMAIN || "localhost"
    }:5173`;

    await this.sendEmail({
      to,
      subject: `Welcome to WorkNest, ${userName}!`,
      text: `Welcome to WorkNest! Your organization ${orgName} has been created. You can login at ${loginUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 10px;">
          <h2 style="color: #4f46e5;">Welcome to WorkNest!</h2>
          <p>Hi ${userName},</p>
          <p>Your organization <strong>${orgName}</strong> has been successfully created.</p>
          <p>You can access your workspace at:</p>
          <div style="margin: 20px 0; padding: 15px; background-color: #f3f4f6; border-radius: 5px; text-align: center;">
            <a href="${loginUrl}" style="color: #4f46e5; font-weight: bold; text-decoration: none; font-size: 18px;">${loginUrl}</a>
          </div>
          <p>Get started by inviting your team members!</p>
          <hr style="border: 0; border-top: 1px solid #e1e1e1; margin: 20px 0;">
          <p style="font-size: 12px; color: #6b7280;">If you didn't create this account, please ignore this email.</p>
        </div>
      `,
    });
  }

  /**
   * Send Invitation Email
   */
  async sendInvitationEmail(
    to: string,
    inviterName: string,
    orgName: string,
    subdomain: string,
    inviteToken: string
  ): Promise<void> {
    const inviteUrl = `http://${subdomain}.${
      process.env.BASE_DOMAIN || "localhost"
    }:5173/accept-invite?token=${inviteToken}`;

    await this.sendEmail({
      to,
      subject: `${inviterName} invited you to join ${orgName} on WorkNest`,
      text: `You have been invited to join ${orgName} on WorkNest. Accept the invitation here: ${inviteUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 10px;">
          <h2 style="color: #4f46e5;">You're Invited!</h2>
          <p>Hi,</p>
          <p><strong>${inviterName}</strong> has invited you to join their team at <strong>${orgName}</strong> on WorkNest.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${inviteUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Join Workspace</a>
          </div>
          <p>Or copy this link into your browser:</p>
          <p style="font-size: 12px; color: #6b7280; word-break: break-all;">${inviteUrl}</p>
          <hr style="border: 0; border-top: 1px solid #e1e1e1; margin: 20px 0;">
          <p style="font-size: 12px; color: #6b7280;">If you weren't expecting this invitation, you can safely ignore this email.</p>
        </div>
      `,
    });
  }
}

export const emailService = new EmailService();
export default emailService;
