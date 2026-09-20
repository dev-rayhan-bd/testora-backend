import { Document, Model, Types } from 'mongoose';

export type TProductStatus = 'draft' | 'active' | 'hidden';

export interface IProductVariant {
  _id?: Types.ObjectId;
  sku: string;
  color?: string;
  size?: string;
  price?: number;
  compareAtPrice?: number | null;
  discountPercentage?: number;
  savingsAmount?: number;
  stock: number;
  image?: string;
}

export interface IProduct extends Document {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  sku: string;
  description: string;
  price: number;
  compareAtPrice?: number | null;
  discountPercentage: number;
  savingsAmount: number;
  stock: number;
  status: TProductStatus;
  category: string;
  brand: string;
  images: string[];
  variants: IProductVariant[];
  isDeleted: boolean;
  lowStockAlert: number;
  createdAt: Date;
  updatedAt: Date;
}

export type IProductDocument = IProduct;

export interface IProductModel extends Model<IProduct> {
  isSlugTaken(slug: string, excludeId?: Types.ObjectId | string): Promise<boolean>;
  isSkuTaken(sku: string, excludeId?: Types.ObjectId | string): Promise<boolean>;
}

export interface IStockCheckResult {
  isAvailable: boolean;
  requestedQuantity: number;
  currentStock: number;
  isLowStock: boolean;
  product: {
    _id: Types.ObjectId;
    title: string;
    slug: string;
    sku: string;
    price: number;
    stock: number;
    status: TProductStatus;
    variant?: IProductVariant;
  };
}
