import { ClientSession, Types } from 'mongoose';
import QueryBuilder from '../../../builder/QueryBuilder';
import { BadRequestError, NotFoundError } from '../../errors/request/apiError';
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
import {
  TCreateProductPayload,
  TUpdateProductPayload,
} from './product.zod';

// ── 1. Create Product ────────────────────────────────────────────────────────
const createProduct = async (
  payload: TCreateProductPayload,
): Promise<IProductDocument> => {
  // Enforce enterprise brand
  const productData = {
    ...payload,
    brand: PRODUCT_BRAND,
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

  // Category filter
  if (query.category) {
    filterConditions.category = query.category as string;
  }

  // Dynamic Price Filtering (minPrice / maxPrice)
  const minPrice = query.minPrice !== undefined ? Number(query.minPrice) : undefined;
  const maxPrice = query.maxPrice !== undefined ? Number(query.maxPrice) : undefined;

  if (minPrice !== undefined || maxPrice !== undefined) {
    filterConditions.price = {};
    if (minPrice !== undefined && !isNaN(minPrice)) {
      filterConditions.price.$gte = minPrice;
    }
    if (maxPrice !== undefined && !isNaN(maxPrice)) {
      filterConditions.price.$lte = maxPrice;
    }
  }

  // Stock status filter
  if (query.inStock === 'true') {
    filterConditions.stock = { $gt: 0 };
  } else if (query.inStock === 'false') {
    filterConditions.stock = 0;
  }

  // Admin: Low Stock Alert Filter
  if (isAdmin && query.isLowStock === 'true') {
    filterConditions.$expr = { $lte: ['$stock', '$lowStockAlert'] };
  }

  // Exclude custom query keys from QueryBuilder raw filter
  const cleanQuery = { ...query };
  delete cleanQuery.minPrice;
  delete cleanQuery.maxPrice;
  delete cleanQuery.inStock;
  delete cleanQuery.isLowStock;
  delete cleanQuery.category;
  if (!isAdmin) {
    delete cleanQuery.status;
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

  const data = await productQuery.modelQuery;
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

  const product = await Product.findOne(filter);

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
): Promise<IProductDocument> => {
  const existingProduct = await Product.findOne({
    _id: new Types.ObjectId(id),
    isDeleted: false,
  });

  if (!existingProduct) {
    throw new NotFoundError('Product not found or has been deleted.');
  }

  // Determine final status, title, and images after update
  const finalStatus = payload.status ?? existingProduct.status;
  const finalTitle = payload.title ?? existingProduct.title;
  const finalImages = payload.images ?? existingProduct.images;

  // Enterprise Workflow: Cannot go live without title and at least one image
  if (finalStatus === PRODUCT_STATUS.ACTIVE) {
    if (!finalTitle || finalTitle.trim().length === 0) {
      throw new BadRequestError(
        'Product title cannot be empty when publishing an active product.',
      );
    }
    if (!finalImages || finalImages.length === 0) {
      throw new BadRequestError(
        'No product can go live without at least one image.',
      );
    }
  }

  // Apply updates
  Object.assign(existingProduct, payload);

  const updated = await existingProduct.save();
  return updated;
};

// ── 5. Soft-Delete Product ───────────────────────────────────────────────────
const deleteProduct = async (id: string): Promise<IProductDocument> => {
  const product = await Product.findOne({
    _id: new Types.ObjectId(id),
    isDeleted: false,
  });

  if (!product) {
    throw new NotFoundError('Product not found or already deleted.');
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
