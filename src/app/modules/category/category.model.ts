import { Schema, model, Types } from 'mongoose';
import slugify from 'slugify';
import { ICategory, ICategoryModel } from './category.interface';

const categorySchema = new Schema<ICategory, ICategoryModel>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      unique: true,
      minlength: [2, 'Category name must be at least 2 characters long'],
      maxlength: [100, 'Category name cannot exceed 100 characters'],
      index: true,
    },
    slug: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    image: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

categorySchema.index({ name: 1, slug: 1, isActive: 1, isDeleted: 1 });

categorySchema.statics.isNameTaken = async function (
  name: string,
  excludeId?: string | Types.ObjectId,
): Promise<boolean> {
  const query: Record<string, unknown> = {
    name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    isDeleted: false,
  };
  if (excludeId) {
    query._id = { $ne: new Types.ObjectId(excludeId) };
  }
  const existing = await this.findOne(query).select('_id');
  return !!existing;
};

categorySchema.statics.isSlugTaken = async function (
  slug: string,
  excludeId?: string | Types.ObjectId,
): Promise<boolean> {
  const query: Record<string, unknown> = {
    slug: slug.toLowerCase().trim(),
    isDeleted: false,
  };
  if (excludeId) {
    query._id = { $ne: new Types.ObjectId(excludeId) };
  }
  const existing = await this.findOne(query).select('_id');
  return !!existing;
};

categorySchema.pre('save', async function () {
  if (this.isModified('name') || !this.slug) {
    let baseSlug = slugify(this.name, { lower: true, strict: true, trim: true });
    let uniqueSlug = baseSlug;
    let counter = 1;

    // Ensure slug uniqueness
    const CategoryModel = this.constructor as ICategoryModel;
    while (await CategoryModel.isSlugTaken(uniqueSlug, this._id)) {
      uniqueSlug = `${baseSlug}-${counter}`;
      counter++;
    }
    this.slug = uniqueSlug;
  }
});

const Category = model<ICategory, ICategoryModel>('Category', categorySchema);

export default Category;
