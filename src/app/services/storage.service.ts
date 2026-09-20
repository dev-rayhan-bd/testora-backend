import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import cloudinary from '../../config/cloudinary.config';
import config from '../../config';
import { getCloudinaryPublicId } from '../cloudinary/getCoudinaryPublicId';

export interface IUploadResult {
  url: string;
  key: string;
  provider: 'cloudinary' | 's3';
}

class StorageService {
  private s3Client: S3Client | null = null;

  constructor() {
    this.initS3Client();
  }

  private initS3Client(): void {
    if (config.aws_access_key_id && config.aws_secret_access_key) {
      this.s3Client = new S3Client({
        region: config.aws_region || 'us-east-1',
        credentials: {
          accessKeyId: config.aws_access_key_id,
          secretAccessKey: config.aws_secret_access_key,
        },
      });
    }
  }

  /**
   * Determine whether S3 should be used instead of Cloudinary.
   * Uses S3 if S3 credentials + bucket are present, unless storage_driver is explicitly 'cloudinary'.
   */
  public shouldUseS3(): boolean {
    if (config.storage_driver === 'cloudinary') return false;
    if (config.storage_driver === 's3') return true;

    return Boolean(
      config.aws_access_key_id &&
      config.aws_secret_access_key &&
      config.aws_bucket_name,
    );
  }

  /**
   * Upload a single file (image, video, document) to S3 or Cloudinary.
   */
  public async uploadFile(
    file: Express.Multer.File,
    folderName: string = 'general',
  ): Promise<IUploadResult> {
    if (this.shouldUseS3()) {
      return this.uploadToS3(file, folderName);
    }
    return this.uploadToCloudinary(file, folderName);
  }

  /**
   * Upload multiple files in parallel and return their URLs.
   */
  public async uploadMultipleFiles(
    files: Express.Multer.File[],
    folderName: string = 'products',
  ): Promise<string[]> {
    if (!files || files.length === 0) return [];
    const results = await Promise.all(
      files.map((file) => this.uploadFile(file, folderName)),
    );
    return results.map((r) => r.url);
  }

  /**
   * Upload to AWS S3
   */
  private async uploadToS3(
    file: Express.Multer.File,
    folderName: string,
  ): Promise<IUploadResult> {
    if (!this.s3Client) {
      this.initS3Client();
    }
    if (!this.s3Client || !config.aws_bucket_name) {
      throw new Error('AWS S3 configuration is incomplete (missing credentials or bucket name).');
    }

    const isImage = file.mimetype.startsWith('image/') && !file.mimetype.includes('svg');
    let buffer = file.buffer;
    let contentType = file.mimetype;
    let extension = file.originalname.split('.').pop() || 'bin';

    if (isImage) {
      buffer = await sharp(file.buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      contentType = 'image/webp';
      extension = 'webp';
    }

    const cleanFilename = file.originalname
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const key = `${folderName}/${Date.now()}_${cleanFilename}_${uuidv4().slice(0, 8)}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: config.aws_bucket_name,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);

    const region = config.aws_region || 'us-east-1';
    const url = `https://${config.aws_bucket_name}.s3.${region}.amazonaws.com/${key}`;

    return {
      url,
      key,
      provider: 's3',
    };
  }

  /**
   * Upload to Cloudinary (Fallback / Default)
   */
  private uploadToCloudinary(
    file: Express.Multer.File,
    folderName: string,
  ): Promise<IUploadResult> {
    return new Promise(async (resolve, reject) => {
      try {
        const isImage = file.mimetype.startsWith('image/') && !file.mimetype.includes('svg');
        const isVideo = file.mimetype.startsWith('video/');

        let uploadBuffer = file.buffer;
        const uploadOptions: Record<string, any> = {
          folder: folderName,
          resource_type: isVideo ? 'video' : isImage ? 'image' : 'auto',
        };

        if (isImage) {
          uploadBuffer = await sharp(file.buffer)
            .resize({ width: 1200, withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer();
          uploadOptions.format = 'webp';
        }

        const stream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error || !result) {
              return reject(new Error(`Cloudinary upload failed: ${error?.message || 'Unknown error'}`));
            }
            resolve({
              url: result.secure_url,
              key: result.public_id,
              provider: 'cloudinary',
            });
          },
        );

        stream.end(uploadBuffer);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Delete file from whichever provider it belongs to.
   */
  public async deleteFile(fileUrlOrKey: string): Promise<boolean> {
    if (!fileUrlOrKey) return false;

    try {
      if (fileUrlOrKey.includes('.amazonaws.com/') || (this.shouldUseS3() && !fileUrlOrKey.includes('cloudinary'))) {
        if (!this.s3Client || !config.aws_bucket_name) return false;

        let s3Key = fileUrlOrKey;
        if (fileUrlOrKey.includes('.amazonaws.com/')) {
          const parts = fileUrlOrKey.split('.amazonaws.com/');
          s3Key = parts[1] ? decodeURIComponent(parts[1]) : fileUrlOrKey;
        }

        const command = new DeleteObjectCommand({
          Bucket: config.aws_bucket_name,
          Key: s3Key,
        });
        await this.s3Client.send(command);
        return true;
      } else {
        const publicId = getCloudinaryPublicId(fileUrlOrKey) || fileUrlOrKey;
        await cloudinary.uploader.destroy(publicId);
        return true;
      }
    } catch (error) {
      console.error('Storage deletion failed:', error);
      return false;
    }
  }
}

export const storageService = new StorageService();
export default storageService;
