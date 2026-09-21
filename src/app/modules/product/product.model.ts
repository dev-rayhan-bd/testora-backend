import { Schema, model, Types } from 'mongoose';
import slugify from 'slugify';
import { BadRequestError } from '../../errors/request/apiError';
import { PRODUCT_BRAND, PRODUCT_STATUS } from './product.constant';
import { IProductDocument, IProductModel, IProductVariant } from './product.interface';

const productVariantSchema = new Schema<IProductVariant>(
  {
    sku: {
      type: String,
      trim: true,
      uppercase: true,
    },
    color: {
      type: String,
      trim: true,
    },
    size: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      min: [0, 'Variant price must be non-negative'],
    },
    compareAtPrice: {
      type: Number,
      default: null,
      min: [0, 'Variant compare at price must be non-negative'],
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    savingsAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    stock: {
      type: Number,
      required: [true, 'Variant stock is required'],
      min: [0, 'Variant stock cannot be negative'],
      default: 0,
    },
    image: {
      type: String,
      required: [true, 'Variant image is required'],
      trim: true,
    },
  },
  {
    _id: true,
    versionKey: false,
  },
);

const productSchema = new Schema<IProductDocument, IProductModel>(
  {
    title: {
      type: String,
      required: [true, 'Product title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters long'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    sku: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters long'],
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price must be non-negative'],
    },
    compareAtPrice: {
      type: Number,
      default: null,
      min: [0, 'Compare at price must be non-negative'],
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    savingsAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    stock: {
      type: Number,
      required: [true, 'Product stock is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    status: {
      type: String,
      enum: {
        values: Object.values(PRODUCT_STATUS),
        message: 'Status must be draft, active, or hidden',
      },
      default: PRODUCT_STATUS.DRAFT,
      index: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Product category is required'],
      index: true,
    },
    brand: {
      type: String,
      default: PRODUCT_BRAND,
      immutable: true,
      trim: true,
    },
    images: {
      type: [String],
      default: [],
    },
    variants: {
      type: [productVariantSchema],
      default: [],
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    lowStockAlert: {
      type: Number,
      default: 5,
      min: [0, 'Low stock alert threshold cannot be negative'],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// ── Compound Indexes for High-Performance Querying ──────────────────────────
productSchema.index({ title: 1, status: 1 });
productSchema.index({ status: 1, isDeleted: 1 });
productSchema.index({ price: 1, status: 1 });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ 'variants.sku': 1 });
productSchema.index({ title: 'text', description: 'text', sku: 'text' });

// ── Static helper to check slug uniqueness ──────────────────────────────────
productSchema.statics.isSlugTaken = async function (
  slug: string,
  excludeId?: Types.ObjectId | string,
): Promise<boolean> {
  const query: Record<string, unknown> = { slug };
  if (excludeId) {
    query._id = { $ne: new Types.ObjectId(excludeId) };
  }
  const existing = await this.findOne(query).select('_id');
  return !!existing;
};

// ── Static helper to check SKU uniqueness ────────────────────────────────────
productSchema.statics.isSkuTaken = async function (
  sku: string,
  excludeId?: Types.ObjectId | string,
): Promise<boolean> {
  const query: Record<string, unknown> = {
    $or: [{ sku }, { 'variants.sku': sku }],
  };
  if (excludeId) {
    query._id = { $ne: new Types.ObjectId(excludeId) };
  }
  const existing = await this.findOne(query).select('_id');
  return !!existing;
};

// ── Pre-Save Hook: Auto Slug, Auto SKU & Enterprise Status Validation ────────
productSchema.pre('save', async function () {
  // 1. Enterprise Validation: No product can go live without a title and at least one image
  if (this.status === PRODUCT_STATUS.ACTIVE) {
    if (!this.title || this.title.trim().length === 0) {
      throw new BadRequestError('An active product must have a valid title.');
    }
    if (!this.images || this.images.length === 0) {
      throw new BadRequestError(
        'No product can go live without at least one image.',
      );
    }
  }

  const ProductModel = this.constructor as IProductModel;

  // 2. Auto-generate slug from title
  if (this.isModified('title') || !this.slug) {
    let baseSlug = slugify(this.title, {
      lower: true,
      strict: true,
      trim: true,
    });

    if (!baseSlug) {
      baseSlug = `product-${Date.now()}`;
    }

    let candidateSlug = baseSlug;
    let counter = 1;

    while (await ProductModel.isSlugTaken(candidateSlug, this._id)) {
      candidateSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    this.slug = candidateSlug;
  }

  // 3. Auto-generate SKU if not supplied
  if (!this.sku) {
    const cleanPrefix = (this.slug || 'PRD').substring(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '');
    let candidateSku = `TST-${cleanPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    while (await ProductModel.isSkuTaken(candidateSku, this._id)) {
      candidateSku = `TST-${cleanPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    this.sku = candidateSku;
  }

  // 4. Auto-generate Variant SKUs if missing
  if (this.variants && this.variants.length > 0) {
    for (let i = 0; i < this.variants.length; i++) {
      const v = this.variants[i];
      if (!v.sku) {
        const colorPart = v.color ? `-${v.color.substring(0, 3).toUpperCase()}` : '';
        const sizePart = v.size ? `-${v.size.substring(0, 3).toUpperCase()}` : '';
        v.sku = `${this.sku}${colorPart}${sizePart}-${i + 1}`;
      }
    }
  }

  // 5. Auto-calculate discount percentage and savings for Base Product
  if (this.compareAtPrice && this.compareAtPrice > this.price) {
    this.discountPercentage = Math.round(
      ((this.compareAtPrice - this.price) / this.compareAtPrice) * 100,
    );
    this.savingsAmount = Number((this.compareAtPrice - this.price).toFixed(2));
  } else {
    this.discountPercentage = 0;
    this.savingsAmount = 0;
  }

  // 6. Auto-calculate discount percentage and savings for Variants
  if (this.variants && this.variants.length > 0) {
    for (const v of this.variants) {
      const variantPrice = v.price ?? this.price;
      if (v.compareAtPrice && v.compareAtPrice > variantPrice) {
        v.discountPercentage = Math.round(
          ((v.compareAtPrice - variantPrice) / v.compareAtPrice) * 100,
        );
        v.savingsAmount = Number((v.compareAtPrice - variantPrice).toFixed(2));
      } else {
        v.discountPercentage = 0;
        v.savingsAmount = 0;
      }
    }
  }
});

const Product = model<IProductDocument, IProductModel>('Product', productSchema);

export default Product;
