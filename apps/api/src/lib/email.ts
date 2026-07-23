import { env } from './env';

export interface ContactRequestPayload {
  funeralHomeEmail: string;
  funeralHomeName: string;
  name: string;
  phone: string;
  email: string;
  overallRating: number;
  comments: string;
  memorialName: string;
  deceasedName: string;
}

/**
 * Send a contact request notification email to the funeral home.
 * Falls back to console logging if no SMTP transport is configured.
 */
export async function sendContactRequestNotification(payload: ContactRequestPayload): Promise<void> {
  const subject = 'New Funeral Enquiry from Memory Connect';
  const body = [
    'A memorial attendee has requested to be contacted.',
    '',
    `Memorial: ${payload.memorialName}`,
    `Funeral: ${payload.deceasedName}`,
    '',
    'Attendee',
    '',
    `Name: ${payload.name}`,
    `Phone: ${payload.phone}`,
    `Email: ${payload.email}`,
    '',
    `Overall Rating: ${payload.overallRating} / 5`,
    `Comments: ${payload.comments}`,
    '',
    'Please contact this person regarding your funeral services.',
    '',
    'This enquiry was generated automatically by Memory Connect.',
  ].join('\n');

  // If SMTP is configured, send a real email
  if (env.SMTP_HOST && env.SMTP_USER) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      });

      await transporter.sendMail({
        from: env.SMTP_FROM || `"Memory Connect" <${env.SMTP_USER}>`,
        to: payload.funeralHomeEmail,
        subject,
        text: body,
      });
      return;
    } catch (error) {
      console.warn('SMTP email failed, falling back to console log:', error);
    }
  }

  // Fallback: log to console so the admin can see it in server logs
  console.log('\n=== NEW FUNERAL ENQUIRY ===');
  console.log(`To: ${payload.funeralHomeEmail} (${payload.funeralHomeName})`);
  console.log(`Subject: ${subject}`);
  console.log(body);
  console.log('=== END ENQUIRY ===\n');
}
