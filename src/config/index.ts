import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({
  path: path.join(process.cwd(), '.env'),
});


const envSchema = z.object({
  NODE_ENV: z.enum(['production', 'development', 'test']).default('development'),
  PORT: z.preprocess((val) => Number(val), z.number().default(5003)),
  SERVER_NAME: z.string().min(1, 'Server name is required'),
  SERVER_URL: z.string().min(1, 'Server URL is required'),
  BASE_URL: z.string().min(1, 'base URL is required'),
  FRONTEND_URL: z.string().min(1, 'frontend url is required'),
  MONGODB_URL: z.string().min(1, 'MongoDB connection URL is required'),
  GOOGLE_CLIENT_ID_WEB: z.string().min(1, "Google CLient ID is required"),
  GOOGLE_CLIENT_ID_ANDROID: z.string().min(1, "Google CLient ID is required"),
  GOOGLE_CLIENT_ID_IOS: z.string().min(1, "Google CLient ID is required"),
  HASH_SECRET_KEY: z.string().min(1, "hash secret key is required"),
  JWT_ACCESS_TOKEN_SECRET: z.string().min(1, 'Access token secret key is required'),
  JWT_ACCESS_TOKEN_EXPIRESIN: z.string().default('1d'),
  JWT_REFRESH_TOKEN_SECRET: z.string().min(1, 'Refresh token secret key is required'),
  JWT_REFRESH_TOKEN_EXPIRESIN: z.string().default('7d'),
  OTP_EXPIRY_MINUTES: z.string(),
  OTP_TOKEN_EXPIRESIN: z.string().default('1m'),
  SALT_ROUNDS: z.string().default('10'),
  ADMIN_PASSWORD: z.string(),
  ADMIN_EMAIL: z.string().email('Invalid email format').min(1, 'Admin email is required'),
  APP_ID: z.string(),
  SERVER_SECRET: z.string(),
  CALLBACK_SECRET: z.string(),
  STRIPE_SECRET_KEY: z.string().min(1, 'stripe secret key is required'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'stripe secret key is required'),
  GMAIL_APP_USER: z.email('Invalid email format'),
  GMAIL_APP_PASSWORD: z.string().min(1, 'Gmail app password is required'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_BUCKET_NAME: z.string().optional(),
  STORAGE_DRIVER: z.enum(['auto', 'cloudinary', 's3']).default('auto'),
});

let envVars: z.infer<typeof envSchema>;
try {
  envVars = envSchema.parse(process.env);
} catch (error: any) {
  if (error instanceof z.ZodError) {
    console.error('\x1b[31m❌ Environment Variable Validation Error:\x1b[0m');
    error.issues.forEach((err: any) => {
      console.error(`  \x1b[33m- ${err.path.join('.')}: ${err.message}\x1b[0m`);
    });
  }
  throw error;
}

export default {
  node_env: envVars.NODE_ENV,
  server_port: envVars.PORT,
  server_name: envVars.SERVER_NAME,
  mongodb_url: envVars.MONGODB_URL,
  frontend_url: envVars.FRONTEND_URL,
  base_url: envVars.BASE_URL,
  hash_secret_key: envVars.HASH_SECRET_KEY,
  google_client_id_web: envVars.GOOGLE_CLIENT_ID_WEB,
  google_client_id_android: envVars.GOOGLE_CLIENT_ID_ANDROID,
  google_client_id_ios: envVars.GOOGLE_CLIENT_ID_IOS,
  jwt_access_token_secret: envVars.JWT_ACCESS_TOKEN_SECRET,
  jwt_access_token_expiresin: envVars.JWT_ACCESS_TOKEN_EXPIRESIN,
  jwt_refresh_token_secret: envVars.JWT_REFRESH_TOKEN_SECRET,
  jwt_refresh_token_expiresin: envVars.JWT_REFRESH_TOKEN_EXPIRESIN,
  otp_expires_in: envVars.OTP_EXPIRY_MINUTES,
  otp_token_expiresin: envVars.OTP_TOKEN_EXPIRESIN,
  stripe_webhook_secret: envVars.STRIPE_WEBHOOK_SECRET,
  salt_rounds: envVars.SALT_ROUNDS,
  stripe_secret_key: envVars.STRIPE_SECRET_KEY,
  gmail_app_user: envVars.GMAIL_APP_USER,
  gmail_app_password: envVars.GMAIL_APP_PASSWORD,
  admin_password: envVars.ADMIN_PASSWORD,
  admin_email: envVars.ADMIN_EMAIL,
  server_url: envVars.SERVER_URL,
  app_id: envVars.APP_ID,
  server_secret: envVars.SERVER_SECRET,
  callback_secret: envVars.CALLBACK_SECRET,
  aws_access_key_id: envVars.AWS_ACCESS_KEY_ID,
  aws_secret_access_key: envVars.AWS_SECRET_ACCESS_KEY,
  aws_region: envVars.AWS_REGION,
  aws_bucket_name: envVars.AWS_BUCKET_NAME,
  storage_driver: envVars.STORAGE_DRIVER,
};
