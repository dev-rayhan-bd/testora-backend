import { Document, Model, Types } from 'mongoose';

export interface ICategory extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  isActive: boolean;
  isDeleted: boolean;
  productCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ICategoryDocument = ICategory;

export interface ICategoryModel extends Model<ICategory> {
  isNameTaken(name: string, excludeId?: string | Types.ObjectId): Promise<boolean>;
  isSlugTaken(slug: string, excludeId?: string | Types.ObjectId): Promise<boolean>;
}
