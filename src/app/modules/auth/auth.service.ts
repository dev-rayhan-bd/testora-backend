import { OAuth2Client } from 'google-auth-library';
import config from '../../../config';

import otpMailTemplate from '../../../mailTemplate/otpMailTemplate';
import { generateOTP } from '../../../utilities/generateOtp';
import sendMail from '../../../utilities/sendEmail';
import { BadRequestError, InternalServerError, UnauthorizedError } from '../../errors/request/apiError';
import { SessionModel } from '../session/session.model';

import jwtHelpers from '../../../helpers/jwtHelpers';
import OtpToken from '../otpToken/otp.token.model';
import { USER_ROLE, USER_STATUS } from '../user/user.constant';
import { IUser } from '../user/user.interface';
import { userRepository } from '../user/user.repository';
import { jwtPayload, socialLoginPayload } from './auth.interface';
import { sendVerificationOtp } from './auth.utils';
import { TLoginPayload } from './auth.validation';

const googleClient = new OAuth2Client();

// login with credential
const loginWithCredential = async (credential: TLoginPayload) => {
  const { email, password } = credential;

  const user = await userRepository.findByEmail(email);
  if (!user) throw new UnauthorizedError('user not found with this email');

  console.log(user)
  if (user.deletedAt) {
    throw new UnauthorizedError('This account has been deleted. if you want to restore this account, create account with same email again');
  }
  if ([USER_STATUS.BLOCKED].includes(user.status)) {
    throw new UnauthorizedError('user has been blocked. Contact support for more info');
  }

  if (user.status === USER_STATUS.PENDING) {
    throw new UnauthorizedError('This account is pending verification from admin.');
  }

  if (!user.password && user.isSocialLogin) {
    throw new BadRequestError('please login with your social account');
  }

  const isPasswordMatch = await user.isPasswordMatched(password);
  if (!isPasswordMatch) throw new BadRequestError(`password didn't match`);

  if (!user.verification.emailVerifiedAt) {
    try {
      await sendVerificationOtp(user._id, email);
      return {
        status: 'UNVERIFIED',
        message: 'A new verification code has been sent to your email.'
      };
    } catch (error) {
      // If the error is due to the OTP still being valid, still let the frontend know they are UNVERIFIED
      if (error instanceof BadRequestError && error.message.includes('OTP still valid')) {
        return {
          status: 'UNVERIFIED',
          message: 'An active verification code was already sent. Please check your inbox.'
        };
      };
    }
  }
  if (user.status === USER_STATUS.DISABLED) {
    user.status = USER_STATUS.ACTIVE;
    user.disabledAt = null;
  }

  await user.save()

  const JwtPayload: jwtPayload = {
    id: user._id.toString(),
    role: user.role,
    isRemembered: credential.isRemembered || false,
  };
  const tokens = await jwtHelpers.generateTokens(JwtPayload);

  return tokens;
};


// authentication with Google
const loginWithOAuth = async (credential: socialLoginPayload) => {
  const { provider, token } = credential;

  let payload;
  if (provider === 'google') {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: [config.google_client_id_web, config.google_client_id_android, config.google_client_id_ios],
    });
    payload = ticket.getPayload();
  } else if (provider === 'apple') {
    // const appleUser = await appleSigninAuth.verifyIdToken(token, {
    //     audience: process.env.APPLE_CLIENT_ID!,
    //     ignoreExpiration: false,
    // });
    // email = appleUser.email;
    // id = appleUser.sub;
    // name = 'Apple User';
  } else {
    throw new BadRequestError('Invalid token, Please try again');
  }

  if (!payload || !payload.email) {
    throw new BadRequestError('Invalid token: email not found');
  }
  const email = payload.email;
  const name = payload.name || 'Unknown';
  const picture = payload.picture || '';

  let user = await userRepository.findByEmail(email);

  if (!user) {
    user = await userRepository.createUser({
      fullName: name,
      email,
      provider: provider,
    });
    if (!user) {
      throw new BadRequestError('Failed to create user');
    }
    user.verification.emailVerifiedAt = new Date();
    user.status = USER_STATUS.ACTIVE;
    user.isSocialLogin = true;
    user.avatar = picture;
    user.role = USER_ROLE.STUDENT;
    await user.save();

    return {
      isProfileCompleted: false,
    };
  }

  if (user.deletedAt) {
    throw new UnauthorizedError('This account has been deleted. if you want to restore this account, create account with same email again');
  }
  if (user.status !== USER_STATUS.ACTIVE) {
    throw new UnauthorizedError('Unauthorized Access');
  }

  if (user.role === USER_ROLE.STUDENT) {
    return {
      isProfileCompleted: false,
      userId: user._id,
    };
  }

  const JwtPayload: jwtPayload = {
    id: user._id.toString(),
    role: user.role,
  };
  const tokens = await jwtHelpers.generateTokens(JwtPayload);
  return tokens
};

// verify account by otp
const verifyAccountByOtp = async (email: string, otp: string, fcmToken?: string) => {
  console.log({ email });
  // const user = await Auth.findOne({ email: userEmail });
  const user = await userRepository.findByEmail(email);

  if (!user) {
    throw new BadRequestError('User not found!');
  }

  if (user.verification.emailVerifiedAt) {
    throw new BadRequestError('This account is already verified!');
  }

  const otpToken = await OtpToken.findOne({ userId: user._id, type: 'email_verification' });

  if (!otpToken) {
    throw new BadRequestError('OTP not found. Please request a fresh Otp');
  }
  const isVerificationOtpMatched = await otpToken.isVerificationOtpMatched(otp);

  // If OTP is invalid, throw error
  if (!isVerificationOtpMatched) {
    throw new BadRequestError('OTP is incorrect');
  }

  // console.log("fcmToken", fcmToken)

  // Mark user as verified
  user.verification.emailVerifiedAt = new Date();

  await OtpToken.deleteOne({ userId: user._id, type: 'email_verification' });

  await user.save();

  const JwtPayload: jwtPayload = {
    id: user._id.toString(),
    role: user.role,
  };

  // Generate access and refresh tokens
  const tokens = await jwtHelpers.generateTokens(JwtPayload);

  // Return tokens to client
  return {
    ...tokens,
    userId: user._id,
  };
};

// resend signip otp
const resendEmailVerificationOtpAgain = async (email: string) => {
  const user = await userRepository.findByEmail(email);

  if (!user) {
    throw new UnauthorizedError('User not found!');
  }

  // Guard: email might be null (social login users)
  if (!user.email) {
    throw new BadRequestError('No email address associated with this account.');
  }

  if (user.verification.emailVerifiedAt) {
    throw new BadRequestError('This account is already verified!');
  }

  // Enforce a 60-second cooldown between resends matching the UI countdown timer
  const existingOtp = await OtpToken.findOne({ userId: user._id, type: 'email_verification' });

  if (existingOtp) {
    const elapsedSeconds = (Date.now() - new Date(existingOtp.createdAt).getTime()) / 1000;
    if (elapsedSeconds < 60) {
      const waitTime = Math.ceil(60 - elapsedSeconds);
      throw new BadRequestError(`Please wait ${waitTime} second${waitTime > 1 ? 's' : ''} before requesting a new code.`);
    }
  }

  // Validate config before proceeding
  const expiresInMinutes = Number(config.otp_expires_in);
  if (isNaN(expiresInMinutes) || expiresInMinutes <= 0) {
    throw new InternalServerError('OTP expiry configuration is invalid.');
  }

  const verificationOtp = generateOTP();

  const mailOptions = {
    from: config.gmail_app_user,
    to: user.email,
    subject: 'Email Verification',
    html: otpMailTemplate(verificationOtp, expiresInMinutes),
  };

  // Send mail first — if it fails, OTP won't be saved to DB
  await sendMail(mailOptions);

  // If OTP save fails after mail is sent, user can retry resend
  try {
    // Atomic upsert — prevents duplicate OTP records on race condition (double-click resend)
    await OtpToken.deleteOne({ userId: user._id, type: 'email_verification' });

    // Create new — pre('save') fires automatically and hashes OTP
    await OtpToken.create({
      userId: user._id,
      type: 'email_verification',
      otpHash: verificationOtp,  // plain OTP — hook will hash it
      expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000),
    });
  } catch {
    // Mail was sent but OTP save failed — user can retry resend
    throw new InternalServerError('OTP sent but failed to save. Please try resending.');
  }

  return null;
};


// forget password
const forgotPassword = async (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await userRepository.findByEmail(normalizedEmail, "_id email");

  if (!user) {
    throw new UnauthorizedError('User not found!');
  }

  if (user.isSocialLogin && !user.password) {
    throw new BadRequestError("Social login users don't have a password to reset!");
  }

  // Validate config first before proceeding
  const expiresInMinutes = Number(config.otp_expires_in);
  if (isNaN(expiresInMinutes) || expiresInMinutes <= 0) {
    throw new InternalServerError('OTP expiry configuration is invalid.');
  }

  // Enforce a 60-second cooldown between resends matching UI countdown
  const existingOtp = await OtpToken.findOne({ userId: user._id, type: 'password_reset' });
  if (existingOtp) {
    const elapsedSeconds = (Date.now() - new Date(existingOtp.createdAt).getTime()) / 1000;
    if (elapsedSeconds < 60) {
      const waitTime = Math.ceil(60 - elapsedSeconds);
      throw new BadRequestError(`Please wait ${waitTime} second${waitTime > 1 ? 's' : ''} before requesting a new code.`);
    }
    await OtpToken.deleteOne({ _id: existingOtp._id });
  }

  const otp = generateOTP();

  // Create OTP first
  await OtpToken.create({
    userId: user._id, // ← was missing
    type: 'password_reset',
    otpHash: otp,
    expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000),
  });

  // Mail fail hole OTP delete kore dao
  try {
    await sendMail({
      from: config.gmail_app_user,
      to: normalizedEmail, // normalized email use koro
      subject: 'Password Reset Verification Code',
      html: otpMailTemplate(otp, expiresInMinutes),
    });
  } catch {
    await OtpToken.deleteOne({ userId: user._id, type: 'password_reset' });
    throw new BadRequestError('Failed to send reset email. Please try again.');
  }

  return null;
};

// reset password otp again
const resetPasswordOtpAgain = async (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await userRepository.findByEmail(normalizedEmail, '_id email');

  if (!user) {
    throw new UnauthorizedError('User not found!');
  }

  if (!user.email) {
    throw new BadRequestError('No email address associated with this account.');
  }

  // Validate config first
  const expiresInMinutes = Number(config.otp_expires_in);
  console.log({ expiresInMinutes });
  if (isNaN(expiresInMinutes) || expiresInMinutes <= 0) {
    throw new InternalServerError('OTP expiry configuration is invalid.');
  }

  // Enforce a 60-second cooldown between resends matching UI countdown
  const existingOtp = await OtpToken.findOne({ userId: user._id, type: 'password_reset' });
  if (existingOtp) {
    const elapsedSeconds = (Date.now() - new Date(existingOtp.createdAt).getTime()) / 1000;
    if (elapsedSeconds < 60) {
      const waitTime = Math.ceil(60 - elapsedSeconds);
      throw new BadRequestError(`Please wait ${waitTime} second${waitTime > 1 ? 's' : ''} before requesting a new code.`);
    }
    await OtpToken.deleteOne({ _id: existingOtp._id });
  }

  // If no OTP found at all — user never initiated forgot password
  const otp = generateOTP();

  // Create new OTP — pre('save') hook will hash it
  await OtpToken.create({
    userId: user._id,
    type: 'password_reset',
    otpHash: otp,
    expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000),
  });

  try {
    await sendMail({
      from: config.gmail_app_user,
      to: user.email,
      subject: 'Password Reset Code',
      html: otpMailTemplate(otp, expiresInMinutes),
    });
  } catch {
    // Mail failed — delete OTP so user can retry
    await OtpToken.deleteOne({ userId: user._id, type: 'password_reset' });
    throw new BadRequestError('Failed to send reset email. Please try again.');
  }

  return null;
};


// verifyForgetPasswordByOtp
const verifyForgetPasswordByOtp = async (email: string, otp: string) => {
  const user = await userRepository.findByEmail(email, '_id');

  if (!user) {
    throw new UnauthorizedError('User not found!');
  }

  const otpToken = await OtpToken.findOne({ userId: user._id, type: 'password_reset' });

  // TTL auto-deletes expired OTPs, so null means expired or never requested
  if (!otpToken) {
    throw new BadRequestError('OTP has expired. Please request a fresh OTP!');
  }

  const isMatched = await otpToken.isVerificationOtpMatched(otp);
  if (!isMatched) {
    throw new BadRequestError('OTP is incorrect.');
  }

  // OTP verified — delete it immediately, no longer needed
  await OtpToken.deleteOne({ userId: user._id, type: 'password_reset' });

  // Issue a short-lived reset token scoped only for password reset
  const resetToken = await jwtHelpers.createToken(
    {
      id: user._id.toString(),
      purpose: 'password_reset',
    },
  );

  return { resetToken };
};

// resetPassword
const resetPassword = async (resetToken: string, newPassword: string) => {
  // Verify and decode reset token
  let decoded: { id?: string; purpose?: string };

  try {
    decoded = jwtHelpers.verifyToken(resetToken, config.jwt_access_token_secret) as { id?: string; purpose?: string };
    console.log(decoded)
  } catch {
    throw new UnauthorizedError('Reset token is invalid or expired. Please verify OTP again.');
  }

  // Ensure token is scoped for password reset only
  if (!decoded.id || decoded.purpose !== 'password_reset') {
    throw new UnauthorizedError('Invalid reset token.');
  }

  const user = await userRepository.findById(decoded.id);
  if (!user) {
    throw new UnauthorizedError('User not found!');
  }

  user.password = newPassword;
  await user.save();

  return null;
};
// resetPasswordIntoDB


//change Password
const changePassword = async (currentUser: IUser, currentPassword: string, newPassword: string) => {
  const user = await userRepository.findById(currentUser._id.toString());
  if (!user) throw new UnauthorizedError('User not found!');

  if (user.isSocialLogin && !user.password) {
    throw new BadRequestError("Social user don't have password to change!");
  }

  const isMatchCurrentPassword = await user.isPasswordMatched(currentPassword);
  if (!isMatchCurrentPassword) throw new BadRequestError('Current password is incorrect');

  const isMatchCurrentPasswordAndNewPassword = await user.isPasswordMatched(newPassword);
  if (isMatchCurrentPasswordAndNewPassword) throw new BadRequestError(`Don't use current password. Provide a new password`);

  user.password = newPassword;
  user.passwordChangedAt = user.passwordChangedAt = new Date(Date.now() - 15000);
  await user.save();

  const JwtPayload: jwtPayload = {
    id: user._id.toString(),
    role: user.role,
  };
  const tokens = await jwtHelpers.generateTokens(JwtPayload);
  return tokens;
};

// get Access Token By Refresh Token

const generateNewAccessTokenByRefreshToken = async (refreshToken: string) => {
  if (!refreshToken) {
    throw new UnauthorizedError('Unauthorized request');
  }
  // decode the refresh token
  const decoded = jwtHelpers.verifyToken(refreshToken, config.jwt_refresh_token_secret!) as any;

  const { id, iat } = decoded;

  // fetch user
  const user = await userRepository.findById(id, '-password');
  if (!user) throw new UnauthorizedError('User not found');

  // check if user is active or deleted

  if (user.status === USER_STATUS.BLOCKED) {
    throw new UnauthorizedError('This account has been blocked. Contact support for more info');
  }
  if (user.deletedAt) {
    throw new UnauthorizedError('This account has been deleted. if you want to restore this account, create account with same email again');
  }

  // fetch session
  const session = await SessionModel.findOne({ user: id });
  if (!session || session.refreshToken !== refreshToken) {
    throw new UnauthorizedError('Refresh token expired or used');
  }

  if (user.passwordChangedAt && iat < user.passwordChangedAt.getTime() / 1000) {
    throw new UnauthorizedError('Token issued before password change');
  }

  // invalidate old session

  const JwtPayload: jwtPayload = {
    id: user._id.toString(),
    role: user.role,
  };

  // generate new tokens
  const tokens = await jwtHelpers.generateTokens(JwtPayload);
  return tokens;
};

export const userAuthService = {
  loginWithCredential,
  loginWithOAuth,
  verifyAccountByOtp,
  resendEmailVerificationOtpAgain,
  changePassword,
  verifyForgetPasswordByOtp,
  forgotPassword,
  resetPassword,
  resetPasswordOtpAgain,
  generateNewAccessTokenByRefreshToken,
};
