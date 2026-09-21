import { Types } from 'mongoose';
import QueryBuilder from '../../../builder/QueryBuilder';
import { BadRequestError, NotFoundError } from '../../errors/request/apiError';
import { storageService } from '../../services/storage.service';
import Product from '../product/product.model';
import { CATEGORY_SEARCHABLE_FIELDS } from './category.constant';
import { ICategory, ICategoryDocument } from './category.interface';
import Category from './category.model';
import { TCreateCategoryPayload, TUpdateCategoryPayload } from './category.zod';

const extractFile = (
  fileOrFiles?: any,
): Express.Multer.File | undefined => {
  if (!fileOrFiles) return undefined;
  if (Array.isArray(fileOrFiles) && fileOrFiles.length > 0) return fileOrFiles[0];
  if ('buffer' in fileOrFiles) return fileOrFiles as Express.Multer.File;
  if (typeof fileOrFiles === 'object') {
    const record = fileOrFiles as Record<string, Express.Multer.File[]>;
    for (const key of ['image', 'thumbnail', 'icon', 'file', 'files']) {
      if (record[key] && Array.isArray(record[key]) && record[key].length > 0) {
        return record[key][0];
      }
    }
  }
  return undefined;
};

// ── 1. Create Category ───────────────────────────────────────────────────────
const createCategory = async (
  payload: TCreateCategoryPayload,
  files?: any,
): Promise<ICategoryDocument> => {
  const isTaken = await Category.isNameTaken(payload.name);
  if (isTaken) {
    throw new BadRequestError(`Category '${payload.name.trim()}' already exists.`);
  }

  let imageUrl = payload.image || '';
  const uploadedFile = extractFile(files);
  if (uploadedFile) {
    const uploadResult = await storageService.uploadFile(uploadedFile, 'categories');
    imageUrl = uploadResult.url;
  }

  const category = await Category.create({
    ...payload,
    image: imageUrl,
    isDeleted: false,
  });

  return category;
};

// ── 2. Get All Categories (Public / Storefront or Admin) ─────────────────────
const getAllCategories = async (
  query: Record<string, unknown>,
  isAdmin = false,
) => {
  const filter: Record<string, any> = {
    isDeleted: false,
  };

  if (!isAdmin) {
    filter.isActive = true;
  } else if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  }

  const cleanQuery = { ...query };
  delete cleanQuery.isActive;

  const categoryQuery = new QueryBuilder<ICategoryDocument>(
    Category.find(filter),
    cleanQuery,
  )
    .search(CATEGORY_SEARCHABLE_FIELDS)
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await categoryQuery.modelQuery;
  const meta = await categoryQuery.countTotal();

  // Attach live active product counts for storefront discovery
  const enrichedData = await Promise.all(
    data.map(async (cat) => {
      const catObj = cat.toObject();
      const productCount = await Product.countDocuments({
        category: cat._id,
        isDeleted: false,
        ...(isAdmin ? {} : { status: 'active' }),
      });
      return {
        ...catObj,
        productCount,
      };
    }),
  );

  return {
    meta,
    data: enrichedData,
  };
};

// ── 3. Get Single Category (by ID or Slug) ──────────────────────────────────
const getCategoryByIdOrSlug = async (
  idOrSlug: string,
  isAdmin = false,
): Promise<ICategoryDocument & { productCount?: number }> => {
  const isObjectId = Types.ObjectId.isValid(idOrSlug);

  const filter: Record<string, any> = {
    isDeleted: false,
    ...(isObjectId ? { _id: new Types.ObjectId(idOrSlug) } : { slug: idOrSlug.toLowerCase() }),
  };

  if (!isAdmin) {
    filter.isActive = true;
  }

  const category = await Category.findOne(filter);
  if (!category) {
    throw new NotFoundError(
      `Category '${idOrSlug}' not found or is currently inactive.`,
    );
  }

  const productCount = await Product.countDocuments({
    category: category._id,
    isDeleted: false,
    ...(isAdmin ? {} : { status: 'active' }),
  });

  const catObj = category.toObject();
  return {
    ...catObj,
    productCount,
  } as any;
};

// ── 4. Update Category ───────────────────────────────────────────────────────
const updateCategory = async (
  id: string,
  payload: TUpdateCategoryPayload,
  files?: any,
): Promise<ICategoryDocument> => {
  const category = await Category.findOne({
    _id: new Types.ObjectId(id),
    isDeleted: false,
  });

  if (!category) {
    throw new NotFoundError('Category not found or has been deleted.');
  }

  if (payload.name && payload.name !== category.name) {
    const isTaken = await Category.isNameTaken(payload.name, id);
    if (isTaken) {
      throw new BadRequestError(
        `Category name '${payload.name.trim()}' is already taken.`,
      );
    }
  }

  let finalImage = payload.image !== undefined ? payload.image : category.image;
  const uploadedFile = extractFile(files);
  if (uploadedFile) {
    const uploadResult = await storageService.uploadFile(uploadedFile, 'categories');
    finalImage = uploadResult.url;
  }

  Object.assign(category, {
    ...payload,
    image: finalImage,
  });

  await category.save();
  return category;
};

// ── 5. Delete Category (Soft Delete with Product Guard) ───────────────────────
const deleteCategory = async (id: string): Promise<ICategoryDocument> => {
  const category = await Category.findOne({
    _id: new Types.ObjectId(id),
    isDeleted: false,
  });

  if (!category) {
    throw new NotFoundError('Category not found or already deleted.');
  }

  // Safety Guard: Check if products are currently assigned to this category
  const assignedProductCount = await Product.countDocuments({
    category: category._id,
    isDeleted: false,
  });

  if (assignedProductCount > 0) {
    throw new BadRequestError(
      `Cannot delete category '${category.name}' because it contains ${assignedProductCount} active product(s). Please reassign or delete the products first.`,
    );
  }

  category.isDeleted = true;
  await category.save();
  return category;
};

export const categoryService = {
  createCategory,
  getAllCategories,
  getCategoryByIdOrSlug,
  updateCategory,
  deleteCategory,
};
