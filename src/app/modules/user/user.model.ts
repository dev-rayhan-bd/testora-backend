import bcrypt from 'bcrypt';
import mongoose, { Schema } from 'mongoose';
import config from '../../../config';
import { PROVIDER, USER_ROLE, USER_STATUS } from './user.constant';
import { IUser, IUserModel } from './user.interface';
import { EXAM_TYPES, USER_LANGUAGES } from '../../../interfaces';


export const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
    },
    password: {
      type: String,
      required: false,
    },
    passwordChangedAt: {
      type: Date,
      select: false,
    },
    verification: {
      emailVerifiedAt: { type: Date, default: null },
      phoneVerifiedAt: { type: Date, default: null },
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLE),
      default: USER_ROLE.STUDENT,
    },
    city: {
      type: String,
      default: null
    },
    provider: {
      type: String,
      enum: Object.values(PROVIDER),
    },
    isSocialLogin: {
      type: Boolean,
      default: false,
    },
    plan: {
      type: String,
      enum: Object.values(EXAM_TYPES),
      required: false
    },
    language: {
      type: String,
      enum: Object.values(USER_LANGUAGES),
      default: USER_LANGUAGES.ENGLISH,
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.PENDING,
    },
    faculty: { type: String, default: null },
    purchasedFaculties: [{
      type: Schema.Types.ObjectId,
      ref: 'Faculty',
      default: []
    }],
    subscription: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      default: null
    },
    disabledAt: {
      type: Date,
      default: null
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  const salt = await bcrypt.genSalt(Number(config.salt_rounds));
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, salt);
  }

});

// isUserExistsByEmail
userSchema.statics.isUserExistsByEmail = async function (email: string): Promise<IUser | null> {
  return await User.findOne({ email }).select('+password');
};

// isPasswordMatched
userSchema.methods.isPasswordMatched = async function (plainTextPassword: string): Promise<boolean> {
  return await bcrypt.compare(plainTextPassword, this.password);
};

// isJWTIssuedBeforePasswordChanged
userSchema.methods.isJWTIssuedBeforePasswordChanged = function (jwtIssuedTimestamp: number): boolean {
  const passwordChangedTime = new Date(this.passwordChangedAt).getTime() / 1000;
  return passwordChangedTime > jwtIssuedTimestamp;
};


userSchema.index({ "email": 1 })
userSchema.index({ "fullName": 1 })

const User = mongoose.model<IUser, IUserModel>('User', userSchema);
export default User;
