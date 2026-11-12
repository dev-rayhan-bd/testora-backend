import 'multer';
import { storageService } from '../services/storage.service';

export const uploadToCloudinary = async (
  file: Express.Multer.File,
  folderName: 'profile_images' | 'question_images' | 'option_images' | 'passage_images' | 'blog_images' | string,
): Promise<{ secure_url: string; public_id: string }> => {
  const result = await storageService.uploadFile(file, folderName);
  return {
    secure_url: result.url,
    public_id: result.key,
  };
};

export default uploadToCloudinary;
