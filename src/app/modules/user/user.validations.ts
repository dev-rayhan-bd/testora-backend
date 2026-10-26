import { z } from 'zod';
import { USER_LANGUAGES } from '../../../interfaces';


const createAuthSchema = z.object({
  fullName: z
    .string({
      error: (issue) => {
        if (issue.input === undefined) return 'Full name is required';
        if (typeof issue.input !== 'string') return 'Full name must be a string';
        return 'Invalid full name format';
      },
    })
    .min(3, 'Full name must be at least 3 characters long')
    .max(30, 'Full name cannot exceed 30 characters')
    .regex(/^[\p{L}\s'-]+$/u, 'Full name can only contain letters, spaces, and hyphens'),


  email: z
    .email({
      error: (issue) => {
        switch (true) {
          case issue.input === undefined:
            return 'Email address is required';
          case issue.input === null:
            return 'Email cannot be null';
          case typeof issue.input !== 'string':
            return 'Email must be text';
          default:
            return 'Please provide a valid email address';
        }
      },
    })
    .pipe(z.string().min(5, 'Email must be at least 5 characters long'))
    .pipe(z.string().max(254, 'Email cannot exceed 254 characters'))
    .pipe(
      z.string().refine((email) => email.includes('@') && email.split('@')[1].includes('.'), 'Email must contain a domain with extension'),
    )
    .transform((email) => email.toLowerCase().trim()),
  password: z
    .string({
      error: (issue) => {
        if (issue.input === undefined) return 'Password is required';
        if (typeof issue.input !== 'string') return 'Password must be a string';
        return 'Invalid password format';
      },
    })
    .min(6, 'Password must be at least 6 characters long')
    .max(20, 'Password cannot exceed 20 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[@$!%*?&#]/, 'Password must contain at least one special character'),

    city: z
    .string({
      error: (issue) => {
        if (issue.input === undefined) return 'City is required';
        if (typeof issue.input !== 'string') return 'City must be a string';
        return 'Invalid city format';
      },
    })
    .min(3, 'City must be at least 3 characters long')
    .max(100, 'City cannot exceed 100 characters'),

});

const createSocialAuthSchema = z.object({
  provider: z.enum(['google', 'apple'], {
    message: 'Provider must be google or apple',
  }),
  token: z
    .string({
      message: 'Token is required',
    })
    .min(10, { message: 'Invalid token' }),

  fcmToken: z.string({
    message: 'FCM token must be a string',
  }),
});



const updateUserProfileSchema = z.object({
  fullName: z
    .string({
      error: (issue) => {
        if (issue.input === undefined) return 'Full name is required';
        if (typeof issue.input !== 'string') return 'Full name must be a string';
        return 'Invalid full name format';
      },
    })
    .min(3, 'Full name must be at least 3 characters long')
    .max(30, 'Full name cannot exceed 30 characters')
    .regex(/^[\p{L}\s'-]+$/u, 'Full name can only contain letters, spaces, and hyphens').optional(),

  city: z.string({
    error: (issue) => {
      if (issue.input === undefined) return 'City is required';
      if (typeof issue.input !== 'string') return 'City must be a string';
      return 'Invalid city format';
    },
  })
    .regex(/^[\p{L}\s'-]+$/u, "City can only contain letters, spaces, and hyphens").optional(),

});

const updateUserLanguageSchema = z.object({
 language: z.enum([USER_LANGUAGES.ENGLISH, USER_LANGUAGES.ALBANIAN], {
    message: 'Invalid language selected! please select either english or albanian',
  }),
});

const updateUserLocationSchema = z.object({
  address: z.string().max(100, 'Address cannot exceed 100 characters'),
  geo: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([
      z.number().refine((lng) => lng >= -180 && lng <= 180, 'Longitude must be between -180 and 180'),
      z.number().refine((lat) => lat >= -90 && lat <= 90, 'Latitude must be between -90 and 90'),
    ])
  })
})



export type TUserLanguagePayload = z.infer<
  typeof updateUserLanguageSchema
>;

export type TUserProfileUpdatePayload = z.infer<
  typeof updateUserProfileSchema
>;

export type TRegistrationPayload = z.infer<
  typeof createAuthSchema
>;
const userValidationZodSchema = {
  createAuthSchema,
  createSocialAuthSchema,
  updateUserProfileSchema,
  updateUserLocationSchema,
  updateUserLanguageSchema
};

export default userValidationZodSchema;

/*

export const registerUserValidationSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100),
    email: z
      .string({ invalid_type_error: 'Please add a valid email' })
      .email('Invalid email format')
      .optional(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    phone: z.string().min(1, 'Phone number is required').max(15).optional(),
  }),
});






phone: z
    .string()
    .min(11, "Phone number must be at least 11 digits")
    .max(15, "Phone number cannot exceed 15 digits")
    .regex(/^[0-9]+$/, "Phone number must contain only numbers"),

  address: z.string().max(200, "Address cannot exceed 200 characters").optional(),

  geoLocation: z
    .object({
      type: z.literal("Point"),
      coordinates: z
        .tuple([
          z.number(),
          z.number(),
        ])
        .refine(
          ([lat, lng]) =>
            lat >= -90 &&
            lat <= 90 &&
            lng >= -180 &&
            lng <= 180,
          "Invalid latitude or longitude values"
        ),
    })
    .optional(),


*/
