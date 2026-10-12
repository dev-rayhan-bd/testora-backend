import { Document, Model, Types } from 'mongoose';
import { TProvider, TUserRole, TUserStatus } from './user.constant';
import { TUserLanguages } from '../../../interfaces';


export type TProfileImage = {
  profile_image: Express.Multer.File[];
};

export interface registerSocialPayload {
  email: string;
  fullName: string;
  provider: TProvider;
}


//Instance methods
export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  fullName: string;
  avatar?: string;
  password: string;
  city?: string;
  passwordChangedAt?: Date;
  verification: {
    emailVerifiedAt: Date | null;
    phoneVerifiedAt: Date | null;
  };
  plan?: string;
  faculty?: string;
  subscription?: Types.ObjectId;
  language?: TUserLanguages;
  role: TUserRole;
  provider?: TProvider;
  isSocialLogin: boolean;
  status: TUserStatus;
  disabledAt: Date | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;

  // Instance methods
  isPasswordMatched(plainTextPassword: string): Promise<boolean>;
  isJWTIssuedBeforePasswordChanged(jwtIssuedTimestamp: number | undefined): boolean;
}

// Static methods
export interface IUserModel extends Model<IUser> {
  isUserExistsByEmail(email: string): Promise<IUser | null>;
}
