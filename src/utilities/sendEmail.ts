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
      service: 'gmail',
      auth: {
        user: config.gmail_app_user,
        pass: config.gmail_app_password,
      },
    });

    const mailOptions: SendMailOptions = {
      from,
      to,
      subject,
      html,
    };


      try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to}`);
      } catch (err) {
        console.error(`Email failed for ${to}:`, err);
      }


    // Wait for the sendMail operation to complete
    // const info: SentMessageInfo = await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    throw new BadRequestError('Failed to send mail!');
  }
};

export default sendMail;
