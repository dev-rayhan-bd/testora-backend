import { randomUserImage } from '../../../utilities/randomUserImage';
import { deleteImageFromCloudinary } from '../../cloudinary/deleteImageFromCloudinary';
import { uploadToCloudinary } from '../../cloudinary/uploadImageToCLoudinary';
import { BadRequestError } from '../../errors/request/apiError';

import { sendVerificationOtp } from '../auth/auth.utils';
import { USER_ROLE, USER_STATUS } from './user.constant';
import { IUser, TProfileImage } from './user.interface';
import User from './user.model';
import Faculty from '../faculty/faculty.model';
import { TRegistrationPayload, TUserLanguagePayload, TUserProfileUpdatePayload } from './user.validations';

// create account
const createAccount = async (payload: TRegistrationPayload) => {
  const existingUser = await User.findOne({ email: payload.email }).select('+password');

  if (existingUser) {
    if (existingUser.deletedAt) {
      // Restore user
      existingUser.deletedAt = null;
      existingUser.status = USER_STATUS.ACTIVE;
      existingUser.password = payload.password;
      existingUser.verification.emailVerifiedAt = null; // reset verification

      try {
        await sendVerificationOtp(existingUser._id, payload.email);
      } catch {
        // Mail failed — don't restore, keep as deleted
        throw new BadRequestError('Failed to send verification email. Try again.');
      }

      // Save only after mail succeeds
      await existingUser.save();
      return { status: 'UNVERIFIED' };
    }

    if (existingUser.status === USER_STATUS.BLOCKED) {
      throw new BadRequestError('This account is blocked. Contact support.');
    }

    if (existingUser.status === USER_STATUS.DISABLED) {
      throw new BadRequestError('This account is currently disabled. Please login again to enable it.');
    }

    if (!existingUser.verification.emailVerifiedAt) {
      await sendVerificationOtp(existingUser._id, payload.email);
      return { status: 'UNVERIFIED' };
    }

    throw new BadRequestError('An account with this email already exists.');
  }

  // Create user without saving to DB first
  const newUser = new User({
    ...payload,
    avatar: randomUserImage(),
    role: USER_ROLE.STUDENT,
    status: USER_STATUS.ACTIVE,
  });

  try {
    await sendVerificationOtp(newUser._id, payload.email);
  } catch {
    // Mail failed — don't save user to DB
    throw new BadRequestError('Failed to send verification email. Try again.');
  }

  // Save only after mail succeeds
  await newUser.save();

  return { id: newUser._id, email: newUser.email };
};


const updateUserProfileImage = async (user: IUser, files: TProfileImage) => {
  if (!files?.profile_image?.length) {
    throw new BadRequestError('No profile image provided');
  }

  // save old urls
  const oldAvatarUrl = user.avatar;

  let newProfileImageUrl: string;

  try {
    const result = await uploadToCloudinary(
      files.profile_image[0],
      'profile_images'
    );

    if (!result?.secure_url) {
      throw new BadRequestError('Cloudinary upload failed');
    }

    newProfileImageUrl = result.secure_url;
  } catch (error) {
    throw new BadRequestError('Image upload failed');
  }

  try {

    user.avatar = newProfileImageUrl;
    await user.save();

  } catch (error) {
    // Rollback: delete the newly uploaded image
    await deleteImageFromCloudinary(newProfileImageUrl);
    throw error;
  }

  // Now safely delete the OLD image
  if (oldAvatarUrl) {
    await deleteImageFromCloudinary(oldAvatarUrl);
  }

  return { avatar: newProfileImageUrl };
};

const updateUserLanguage = async (user: IUser, payload: TUserLanguagePayload) => {

  const result = await User.findByIdAndUpdate(
    user._id,
    { $set: { language: payload } },
    { new: true }
  );
  return {
    language: result?.language

  };
};

const updateUserProfile = async (user: IUser, payload: TUserProfileUpdatePayload) => {
  console.log({ payload })
  const result = await User.findByIdAndUpdate(
    user._id,
    { $set: payload },
    { new: true }
  );
  return {
    fullName: result?.fullName,
    email: result?.email,
    city: result?.city,
    avatar: result?.avatar,
    plan: result?.plan,

  };
};

const getUserProfile = async (user: IUser) => {
  return {
    fullName: user.fullName,
    email: user.email,
    city: user.city,
    avatar: user.avatar,
    plan: user.plan,
    language: user.language,
    planStatus: user.subscription || null,
  };
}


const choosePlan = async (user: IUser, payload: { plan: string, faculty?: string }) => {
  user.plan = payload.plan;
  if (payload.plan === 'provime' && payload.faculty) {
    const facultyDoc = await Faculty.findById(payload.faculty);
    if (!facultyDoc) {
      throw new BadRequestError('Faculty not found with the provided ID.');
    }
    user.faculty = facultyDoc.name;
  } else if (payload.plan !== 'provime') {
    user.faculty = undefined;
  }
  await user.save();
  return null;
};


const getUserPlan = async (user: IUser) => {
  let faculty = null;
  if (user.plan === 'provime') {
    faculty = user.faculty ? user.faculty : null;
  }
  return {
    plan: user.plan ? user.plan : null,
    faculty: faculty
  };
};


export const userService = {
  createAccount,
  choosePlan,
  getUserPlan,
  updateUserLanguage,
  updateUserProfileImage,
  updateUserProfile,
  getUserProfile,
};
