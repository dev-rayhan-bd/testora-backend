import { ClientSession, Types } from 'mongoose';
import QueryBuilder from '../../../builder/QueryBuilder';
import { BadRequestError, NotFoundError } from '../../errors/request/apiError';
import { storageService } from '../../services/storage.service';
import {
  PRODUCT_BRAND,
  PRODUCT_SEARCHABLE_FIELDS,
  PRODUCT_STATUS,
} from './product.constant';
import {
  IProduct,
  IProductDocument,
  IStockCheckResult,
} from './product.interface';
import Product from './product.model';
import Category from '../category/category.model';
import Order from '../order/order.model';
import { ORDER_STATUS } from '../order/order.constant';
import {
  TCreateProductPayload,
  TUpdateProductPayload,
} from './product.zod';

const extractFiles = (
  files?: Record<string, Express.Multer.File[]> | Express.Multer.File[],
): Express.Multer.File[] => {
  if (!files) return [];
  if (Array.isArray(files)) return files;
  const list: Express.Multer.File[] = [];
  for (const key of ['images', 'product_images', 'image', 'file', 'files']) {
    if (files[key] && Array.isArray(files[key])) {
      list.push(...files[key]);
    }
  }
  return list;
};

// ── 1. Create Product ────────────────────────────────────────────────────────
const createProduct = async (
  payload: TCreateProductPayload,
  files?: Record<string, Express.Multer.File[]> | Express.Multer.File[],
): Promise<IProductDocument> => {
  const uploadedFiles = extractFiles(files);
  let finalImages = payload.images ? [...payload.images] : [];
  if (uploadedFiles.length > 0) {
    const uploadedUrls = await storageService.uploadMultipleFiles(
      uploadedFiles,
      'products',
    );
    finalImages = [...finalImages, ...uploadedUrls];
  }

  // Strictly validate category by Category ID
  if (!Types.ObjectId.isValid(payload.category)) {
    throw new BadRequestError(
      'Invalid Category ID. Must be a 24-character hexadecimal ObjectId.',
    );
  }

  const categoryExists = await Category.findOne({
    _id: payload.category,
    isDeleted: false,
  });

  if (!categoryExists) {
    throw new NotFoundError('Category not found with the provided Category ID.');
  }

  const categoryId = new Types.ObjectId(payload.category);

  // Ensure every variant has an image
  if (payload.variants && payload.variants.length > 0) {
    for (let i = 0; i < payload.variants.length; i++) {
      const v = payload.variants[i];
      if (!v.image) {
        if (finalImages[i]) {
          v.image = finalImages[i];
        } else if (finalImages[0]) {
          v.image = finalImages[0];
        } else {
          throw new BadRequestError(
            `Variant ${v.color || '#' + (i + 1)} must have an image.`,
          );
        }
      }
    }
  }

  // Enforce enterprise brand
  const productData = {
    ...payload,
    category: categoryId,
    images: finalImages,
    brand: payload.brand,
    isDeleted: false,
  };

  // Enterprise Workflow: Active product must have title & >=1 image
  if (productData.status === PRODUCT_STATUS.ACTIVE) {
    if (!productData.title || productData.title.trim().length === 0) {
      throw new BadRequestError('Product must have a valid title before publishing.');
    }
    if (!productData.images || productData.images.length === 0) {
      throw new BadRequestError(
        'No product can go live without at least one image.',
      );
    }
  }

  const result = await Product.create(productData);
  return result;
};

// ── 2. Get All Products (Storefront / Public or Admin) ───────────────────────
const getAllProducts = async (
  query: Record<string, unknown>,
  isAdmin = false,
) => {
  const filterConditions: Record<string, any> = {
    isDeleted: false,
  };

  // If public storefront, only show active (live) products
  if (!isAdmin) {
    filterConditions.status = PRODUCT_STATUS.ACTIVE;
  } else if (query.status) {
    filterConditions.status = query.status as string;
  }

  // Category filter (supports Category ObjectId, Category Slug, and Category Name)
  if (query.category) {
    const catVal = String(query.category).trim();
    if (Types.ObjectId.isValid(catVal)) {
      if (!filterConditions.$and) filterConditions.$and = [];
      filterConditions.$and.push({
        $or: [
          { category: new Types.ObjectId(catVal) },
          { category: catVal },
        ],
      });
    } else {
      const Category = (await import('../category/category.model')).default;
      const matchedCategories = await Category.find({
        $or: [
          { slug: catVal.toLowerCase() },
          { name: { $regex: new RegExp(catVal, 'i') } },
        ],
        isDeleted: false,
      }).select('_id');

      const matchedIds = matchedCategories.map((c) => c._id);

      if (!filterConditions.$and) filterConditions.$and = [];
      filterConditions.$and.push({
        $or: [
          { category: { $in: matchedIds } },
          { category: { $regex: new RegExp(catVal, 'i') } },
        ],
      });
    }
  }

  // Dynamic Price Filtering (minPrice / maxPrice) - checks base price and variant prices
  const minPrice =
    query.minPrice !== undefined && query.minPrice !== '' ? Number(query.minPrice) : undefined;
  const maxPrice =
    query.maxPrice !== undefined && query.maxPrice !== '' ? Number(query.maxPrice) : undefined;

  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceCondition: Record<string, any> = {};
    if (minPrice !== undefined && !isNaN(minPrice)) {
      priceCondition.$gte = minPrice;
    }
    if (maxPrice !== undefined && !isNaN(maxPrice)) {
      priceCondition.$lte = maxPrice;
    }

    if (!filterConditions.$and) {
      filterConditions.$and = [];
    }
    filterConditions.$and.push({
      $or: [
        { price: priceCondition },
        { 'variants.price': priceCondition },
      ],
    });
  }

  // Stock status filter
  if (query.inStock === 'true') {
    filterConditions.stock = { $gt: 0 };
  } else if (query.inStock === 'false') {
    filterConditions.stock = 0;
  }

  // Discount filter
  if (query.hasDiscount === 'true') {
    filterConditions.discountPercentage = { $gt: 0 };
  } else if (query.hasDiscount === 'false') {
    filterConditions.discountPercentage = 0;
  }

  // SKU exact filter
  if (query.sku) {
    const skuCode = (query.sku as string).toUpperCase();
    if (!filterConditions.$and) {
      filterConditions.$and = [];
    }
    filterConditions.$and.push({
      $or: [
        { sku: skuCode },
        { 'variants.sku': skuCode },
      ],
    });
  }

  // Brand filter
  if (query.brand) {
    filterConditions.brand = query.brand as string;
  }

  // Admin: Low Stock Alert Filter
  if (isAdmin && query.isLowStock === 'true') {
    filterConditions.$expr = { $lte: ['$stock', '$lowStockAlert'] };
  }

  // Handle robust multi-field search including category and variants
  if (query.searchTerm && typeof query.searchTerm === 'string') {
    const term = query.searchTerm.trim();
    if (term) {
      const matchingCategories = await Category.find({
        name: { $regex: term, $options: 'i' },
        isDeleted: false,
      }).select('_id');

      const catIds = matchingCategories.map((c) => c._id);
      if (!filterConditions.$and) {
        filterConditions.$and = [];
      }

      const searchOr: any[] = [
        { title: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
        { slug: { $regex: term, $options: 'i' } },
        { sku: { $regex: term, $options: 'i' } },
        { 'variants.sku': { $regex: term, $options: 'i' } },
        { 'variants.color': { $regex: term, $options: 'i' } },
      ];

      if (catIds.length > 0) {
        searchOr.push({ category: { $in: catIds } });
      }

      filterConditions.$and.push({ $or: searchOr });
    }
  }

  // Exclude custom query keys from QueryBuilder raw filter
  const cleanQuery = { ...query };
  delete cleanQuery.searchTerm;
  delete cleanQuery.minPrice;
  delete cleanQuery.maxPrice;
  delete cleanQuery.inStock;
  delete cleanQuery.isLowStock;
  delete cleanQuery.hasDiscount;
  delete cleanQuery.sku;
  delete cleanQuery.category;
  delete cleanQuery.brand;
  if (!isAdmin) {
    delete cleanQuery.status;
  }

  // Normalize friendly sorting aliases
  if (cleanQuery.sort) {
    const sortVal = String(cleanQuery.sort).trim();
    const sortMap: Record<string, string> = {
      price_asc: 'price',
      price_low_to_high: 'price',
      low_to_high: 'price',
      'price-asc': 'price',
      price_desc: '-price',
      price_high_to_low: '-price',
      high_to_low: '-price',
      'price-desc': '-price',
      newest: '-createdAt',
      latest: '-createdAt',
      oldest: 'createdAt',
      discount: '-discountPercentage',
      top_deals: '-discountPercentage',
      best_discount: '-discountPercentage',
      'a-z': 'title',
      name_asc: 'title',
      'z-a': '-title',
      name_desc: '-title',
      stock: '-stock',
    };
    cleanQuery.sort = sortMap[sortVal.toLowerCase()] || sortVal;
  }

  // Initialize QueryBuilder
  const productQuery = new QueryBuilder<IProductDocument>(
    Product.find(filterConditions),
    cleanQuery,
  )
    .search(PRODUCT_SEARCHABLE_FIELDS)
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await productQuery.modelQuery.populate('category', 'name slug image');
  const meta = await productQuery.countTotal();

  return {
    meta: {
      page: meta.page,
      limit: meta.limit,
      total: meta.total,
      totalPages: meta.totalPage,
    },
    data,
  };
};

// ── 3. Get Product by ID or Slug ─────────────────────────────────────────────
const getProductByIdOrSlug = async (
  idOrSlug: string,
  isAdmin = false,
): Promise<IProductDocument> => {
  const isObjectId = Types.ObjectId.isValid(idOrSlug);

  const filter: Record<string, any> = {
    isDeleted: false,
    ...(isObjectId ? { _id: new Types.ObjectId(idOrSlug) } : { slug: idOrSlug }),
  };

  // If public request, product must be active
  if (!isAdmin) {
    filter.status = PRODUCT_STATUS.ACTIVE;
  }

  const product = await Product.findOne(filter).populate('category', 'name slug image');

  if (!product) {
    throw new NotFoundError(
      `Product not found with identifier '${idOrSlug}' or is currently inactive.`,
    );
  }

  return product;
};

// ── 4. Update Product ────────────────────────────────────────────────────────
const updateProduct = async (
  id: string,
  payload: TUpdateProductPayload,
  files?: Record<string, Express.Multer.File[]> | Express.Multer.File[],
): Promise<IProductDocument> => {
  const existingProduct = await Product.findOne({
    _id: new Types.ObjectId(id),
    isDeleted: false,
  });

  if (!existingProduct) {
    throw new NotFoundError('Product not found or has been deleted.');
  }

  const uploadedFiles = extractFiles(files);
  let finalImages = payload.images ? [...payload.images] : [...existingProduct.images];
  if (uploadedFiles.length > 0) {
    const uploadedUrls = await storageService.uploadMultipleFiles(
      uploadedFiles,
      'products',
    );
    finalImages = [...finalImages, ...uploadedUrls];
  }

  // Determine final status, title, and images after update
  const finalStatus = payload.status ?? existingProduct.status;
  const finalTitle = payload.title ?? existingProduct.title;

  // Enterprise Workflow: Cannot go live without title and at least one image
  if (finalStatus === PRODUCT_STATUS.ACTIVE) {
    if (!finalTitle || finalTitle.trim().length === 0) {
      throw new BadRequestError(
        'Product must have a title before switching to active status.',
      );
    }
    if (!finalImages || finalImages.length === 0) {
      throw new BadRequestError(
        'Product must have at least one image before going live.',
      );
    }
  }

  // Strictly validate category by Category ID if updated
  let categoryVal: Types.ObjectId | undefined = undefined;
  if (payload.category) {
    if (!Types.ObjectId.isValid(payload.category)) {
      throw new BadRequestError(
        'Invalid Category ID. Must be a 24-character hexadecimal ObjectId.',
      );
    }

    const categoryExists = await Category.findOne({
      _id: payload.category,
      isDeleted: false,
    });

    if (!categoryExists) {
      throw new NotFoundError('Category not found with the provided Category ID.');
    }

    categoryVal = new Types.ObjectId(payload.category);
  }

  // Ensure every variant has an image if variants are updated
  if (payload.variants && payload.variants.length > 0) {
    for (let i = 0; i < payload.variants.length; i++) {
      const v = payload.variants[i];
      if (!v.image) {
        if (finalImages[i]) {
          v.image = finalImages[i];
        } else if (finalImages[0]) {
          v.image = finalImages[0];
        } else if (existingProduct.images && existingProduct.images[0]) {
          v.image = existingProduct.images[0];
        } else {
          throw new BadRequestError(
            `Variant ${v.color || '#' + (i + 1)} must have an image.`,
          );
        }
      }
    }
  }

  // Apply payload to existing document and save to trigger pre-save hooks (auto discount, slug, variants)
  Object.assign(existingProduct, payload, {
    ...(categoryVal ? { category: categoryVal } : {}),
    images: finalImages,
    brand: PRODUCT_BRAND,
  });

  const updatedProduct = await existingProduct.save();
  return updatedProduct;
};

// ── 5. Soft-Delete Product ───────────────────────────────────────────────────
const deleteProduct = async (id: string): Promise<IProductDocument> => {
  const productObjectId = new Types.ObjectId(id);

  const product = await Product.findOne({
    _id: productObjectId,
    isDeleted: false,
  });

  if (!product) {
    throw new NotFoundError('Product not found or already deleted.');
  }

  // Enterprise Guard: Check if product is part of any active/unfulfilled orders
  const activeOrder = await Order.findOne({
    'items.product': productObjectId,
    orderStatus: {
      $in: [
        ORDER_STATUS.PENDING,
        ORDER_STATUS.CONFIRMED,
        ORDER_STATUS.SHIPPED,
      ],
    },
  }).select('orderNumber orderStatus');

  if (activeOrder) {
    throw new BadRequestError(
      `Cannot delete product '${product.title}'. It is currently part of an active order (${activeOrder.orderNumber}) with status '${activeOrder.orderStatus}'. Please complete, deliver, or cancel the order first.`,
    );
  }

  product.isDeleted = true;
  product.status = PRODUCT_STATUS.HIDDEN;
  await product.save();

  return product;
};

// ── 6. Restore Soft-Deleted Product ──────────────────────────────────────────
const restoreProduct = async (id: string): Promise<IProductDocument> => {
  const product = await Product.findOne({
    _id: new Types.ObjectId(id),
    isDeleted: true,
  });

  if (!product) {
    throw new NotFoundError('Deleted product not found.');
  }

  product.isDeleted = false;
  product.status = PRODUCT_STATUS.DRAFT; // Starts in draft for safety
  await product.save();

  return product;
};

// ── 7. Stock Logic: checkStockAvailability ───────────────────────────────────
/**
 * Helper function used during order placement or cart verification.
 * Checks whether the requested quantity can be fulfilled by the current inventory (base product or specific variant).
 */
const checkStockAvailability = async (
  productId: string,
  requestedQuantity: number,
  variantId?: string,
): Promise<IStockCheckResult> => {
  if (requestedQuantity <= 0) {
    throw new BadRequestError('Requested quantity must be greater than zero.');
  }

  const product = await Product.findOne({
    _id: new Types.ObjectId(productId),
    isDeleted: false,
  });

  if (!product) {
    throw new NotFoundError('Product does not exist or is unavailable.');
  }

  if (product.status !== PRODUCT_STATUS.ACTIVE) {
    throw new BadRequestError(
      `Product '${product.title}' is currently not available for purchase (Status: ${product.status}).`,
    );
  }

  let effectiveStock = product.stock;
  let selectedVariant = undefined;

  if (variantId) {
    const variant = product.variants?.find((v) => v._id?.toString() === variantId);
    if (!variant) {
      throw new NotFoundError(`Product variant with ID '${variantId}' not found.`);
    }
    effectiveStock = variant.stock;
    selectedVariant = variant;
  }

  const isAvailable = effectiveStock >= requestedQuantity;
  const isLowStock = effectiveStock <= product.lowStockAlert;

  return {
    isAvailable,
    requestedQuantity,
    currentStock: effectiveStock,
    isLowStock,
    product: {
      _id: product._id as Types.ObjectId,
      title: product.title,
      slug: product.slug,
      sku: selectedVariant ? selectedVariant.sku : product.sku,
      price: selectedVariant?.price ?? product.price,
      stock: effectiveStock,
      status: product.status,
      variant: selectedVariant,
    },
  };
};

// ── 8. Stock Logic: deductStock (Atomic Order Deduction) ─────────────────────
/**
 * Deducts stock atomically to prevent race conditions during concurrent checkouts.
 */
const deductStock = async (
  productId: string,
  quantity: number,
  variantId?: string,
  session?: ClientSession,
): Promise<IProductDocument> => {
  if (quantity <= 0) {
    throw new BadRequestError('Deduct quantity must be greater than zero.');
  }

  let updated: IProductDocument | null = null;

  if (variantId) {
    updated = await Product.findOneAndUpdate(
      {
        _id: new Types.ObjectId(productId),
        isDeleted: false,
        status: PRODUCT_STATUS.ACTIVE,
        'variants._id': new Types.ObjectId(variantId),
        'variants.stock': { $gte: quantity },
      },
      {
        $inc: {
          'variants.$.stock': -quantity,
          stock: -quantity,
        },
      },
      { new: true, session },
    );
  } else {
    updated = await Product.findOneAndUpdate(
      {
        _id: new Types.ObjectId(productId),
        isDeleted: false,
        status: PRODUCT_STATUS.ACTIVE,
        stock: { $gte: quantity },
      },
      { $inc: { stock: -quantity } },
      { new: true, session },
    );
  }

  if (!updated) {
    throw new BadRequestError(
      'Insufficient stock or product unavailable during inventory deduction.',
    );
  }

  return updated;
};

// ── 9. Stock Logic: restoreStock (Atomic Order Cancellation / Refund) ────────
/**
 * Restores stock atomically during order cancellation or refunds.
 */
const restoreStock = async (
  productId: string,
  quantity: number,
  variantId?: string,
  session?: ClientSession,
): Promise<IProductDocument> => {
  if (quantity <= 0) return {} as IProductDocument;

  let updated: IProductDocument | null = null;

  if (variantId) {
    updated = await Product.findOneAndUpdate(
      {
        _id: new Types.ObjectId(productId),
        'variants._id': new Types.ObjectId(variantId),
      },
      {
        $inc: {
          'variants.$.stock': quantity,
          stock: quantity,
        },
      },
      { new: true, session },
    );
  } else {
    updated = await Product.findOneAndUpdate(
      { _id: new Types.ObjectId(productId) },
      { $inc: { stock: quantity } },
      { new: true, session },
    );
  }

  if (!updated) {
    throw new NotFoundError(
      `Failed to restore stock: Product '${productId}' not found.`,
    );
  }

  return updated;
};

export const productService = {
  createProduct,
  getAllProducts,
  getProductByIdOrSlug,
  updateProduct,
  deleteProduct,
  restoreProduct,
  checkStockAvailability,
  deductStock,
  restoreStock,
};
