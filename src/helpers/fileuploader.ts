import { Request } from 'express';
import multer from 'multer';

const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
  'image/gif',
];

const VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
  'video/x-matroska', // .mkv
];

const SPREADSHEET_MIME_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
];

const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ...SPREADSHEET_MIME_TYPES,
  ...IMAGE_MIME_TYPES,
];

const storage = multer.memoryStorage();

// Per-field max size (bytes)
export const MAX_FILE_SIZES: Record<string, number> = {
  profile_image: 5 * 1024 * 1024,
  blog_image: 10 * 1024 * 1024,
  car_images: 5 * 1024 * 1024,
  verification_image: 5 * 1024 * 1024,
  question_image: 5 * 1024 * 1024,
  option_a_image: 2 * 1024 * 1024,
  option_b_image: 2 * 1024 * 1024,
  option_c_image: 2 * 1024 * 1024,
  option_d_image: 2 * 1024 * 1024,
  passage_image: 5 * 1024 * 1024,
  chat_images: 5 * 1024 * 1024,
  csv_file: 10 * 1024 * 1024,
  // E-commerce Product & General media fields:
  images: 10 * 1024 * 1024,
  image: 10 * 1024 * 1024,
  product_images: 10 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  product_video: 100 * 1024 * 1024,
  file: 20 * 1024 * 1024,
  files: 20 * 1024 * 1024,
};

export const MAX_FILE_COUNTS: Record<string, number> = {
  profile_image: 1,
  blog_image: 1,
  verification_image: 1,
  question_image: 1,
  option_a_image: 1,
  option_b_image: 1,
  option_c_image: 1,
  option_d_image: 1,
  csv_file: 1,
  passage_image: 1,
  image: 1,
  images: 10,
  product_images: 10,
  video: 1,
  product_video: 1,
  file: 1,
  files: 10,
};

const fileFilter = (_req: Request, file: Express.Multer.File, cb: any) => {
  const allowedFieldnames = Object.keys(MAX_FILE_SIZES);

  if (!allowedFieldnames.includes(file.fieldname)) {
    return cb(new Error(`Invalid fieldname: ${file.fieldname}`));
  }

  // 1. Video files
  if (file.fieldname === 'video' || file.fieldname === 'product_video') {
    if (!VIDEO_MIME_TYPES.includes(file.mimetype)) {
      const allowed = VIDEO_MIME_TYPES.map((t) => t.split('/')[1]).join(', ');
      return cb(new Error(`${file.fieldname} must be a valid video file (${allowed})`));
    }
    return cb(null, true);
  }

  // 2. CSV / Spreadsheet
  if (file.fieldname === 'csv_file') {
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    const validExtension = extension === 'csv' || extension === 'xlsx' || extension === 'xls';
    const validMimetype = SPREADSHEET_MIME_TYPES.includes(file.mimetype);

    if (!validExtension || !validMimetype) {
      return cb(new Error('csv_file must be a .csv or .xlsx file'));
    }
    return cb(null, true);
  }

  // 3. Documents / Mixed Files
  if (file.fieldname === 'file' || file.fieldname === 'files') {
    if (!DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error(`${file.fieldname} has an unsupported file format`));
    }
    return cb(null, true);
  }

  // 4. Default: Image files
  if (!IMAGE_MIME_TYPES.includes(file.mimetype)) {
    const allowedFormats = IMAGE_MIME_TYPES.map((type) => type?.split('/')[1]).join(', ');
    return cb(new Error(`${file.fieldname} must be an image file: ${allowedFormats}`));
  }

  cb(null, true);
};

export const uploadFile = () =>
  multer({
    storage,
    fileFilter,
  }).fields([
    { name: 'profile_image', maxCount: 1 },
    { name: 'blog_image', maxCount: 1 },
    { name: 'passage_image', maxCount: 1 },
    { name: 'car_images', maxCount: 5 },
    { name: 'verification_image', maxCount: 1 },
    { name: 'chat_images', maxCount: 3 },
    { name: 'question_image', maxCount: 1 },
    { name: 'option_a_image', maxCount: 1 },
    { name: 'option_b_image', maxCount: 1 },
    { name: 'option_c_image', maxCount: 1 },
    { name: 'option_d_image', maxCount: 1 },
    { name: 'csv_file', maxCount: 1 },
    { name: 'images', maxCount: 10 },
    { name: 'image', maxCount: 1 },
    { name: 'product_images', maxCount: 10 },
    { name: 'video', maxCount: 1 },
    { name: 'product_video', maxCount: 1 },
    { name: 'file', maxCount: 5 },
    { name: 'files', maxCount: 10 },
  ]);