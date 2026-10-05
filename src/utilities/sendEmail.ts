import nodemailer, { SendMailOptions} from 'nodemailer';

import { BadRequestError } from '../app/errors/request/apiError';
import config from '../config';

// Define a type for the mail options
interface MailOptions {
  from: string;
  to: string;
  subject: string;
  html: any;
}

// Define the sendMail function
const sendMail = async ({ from, to, subject, html }: MailOptions): Promise<boolean> => {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: config.gmail_app_user,
        pass: config.gmail_app_password,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions: SendMailOptions = {
      from,
      to,
      subject,
      html,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
    return true;
  } catch (error: any) {
    console.error(`Email failed for ${to}:`, error.message || error);
    throw new BadRequestError('Failed to send mail!');
  }
};

export default sendMail;
