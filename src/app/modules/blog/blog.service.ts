
import slugify from 'slugify';
import { deleteImageFromCloudinary } from "../../cloudinary/deleteImageFromCloudinary";
import { uploadToCloudinary } from "../../cloudinary/uploadImageToCLoudinary";
import { BadRequestError, NotFoundError } from "../../errors/request/apiError";
import { BlogFiles } from "./blog.interface";

import Blog from "./blog.model";
import { TCreateBlogPayload } from "./blog.zod";


const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createBlog = async (payload: TCreateBlogPayload, files: BlogFiles) => {
    // 1. Duplicate title check (regex-safe)
    const isExist = await Blog.findOne({
        title: { $regex: new RegExp(`^${escapeRegex(payload.title)}$`, 'i') },
    });

    if (isExist) {
        throw new BadRequestError(
            `The blog title "${payload.title}" already exists`
        );
    }

    // 2. Business rule: published blogs can't come with a manual publishedAt
    if (payload.status === 'published' && payload.publishedAt) {
        throw new BadRequestError(
            `Published blogs should not have a publishedAt date`
        );
    }

    // 3. Upload image (if provided)
    let passageImageUrl: string | undefined;
    if (files?.blog_image?.[0]) {
        const uploaded = await uploadToCloudinary(
            files.blog_image[0],
            'blog_images'
        );
        passageImageUrl = uploaded.secure_url;
    }

    // 4. Build blog data — status stays status, publishedAt stays publishedAt
    const blogData = {
        ...payload,
        image: passageImageUrl || null,
        status: payload.status,
        slug: slugify(payload.title, { lower: true, strict: true }),
        publishedAt:
            payload.status === 'published' && !payload.publishedAt
                ? new Date()
                : payload.publishedAt,
    };

    // 5. Create blog with proper error handling + cloudinary rollback
    let result;
    try {
        result = await Blog.create(blogData);
    } catch (err) {
        if (passageImageUrl) {
            await deleteImageFromCloudinary(passageImageUrl);
        }
        throw new BadRequestError(`Failed to create the blog`);
    }

    return {
        blog: result._id,
        title: result.title,
    };
};

// update blog
const updateBlog = async (id: string, payload: Partial<TCreateBlogPayload>, files: BlogFiles) => {
    const blog = await Blog.findById(id);
    if (!blog) {
        throw new BadRequestError("Blog not found");
    }

    let passageImageUrl: string | undefined;
    if (files?.blog_image?.[0]) {
        const uploaded = await uploadToCloudinary(
            files.blog_image[0],
            "blog_images"
        );
        passageImageUrl = uploaded.secure_url;
    }

    const blogData = {
        ...payload,
        image: passageImageUrl || blog.image,
    };

    const result = await Blog.findByIdAndUpdate(id, blogData, { new: true });
    if (!result) {
        if (passageImageUrl) {
            await deleteImageFromCloudinary(passageImageUrl);
        }
        throw new BadRequestError("Failed to update the blog");
    }

    return {
        blog: result._id,
        title: result.title,
    };
};

const getAllBlogs = async (query: Record<string, unknown>) => {
        const { page = 1, limit = 10, searchTerm, status, category} = query;
      
          const matchStage: any = {};
          
          // Status filter
          if (status) matchStage.status = status;
          if (category) matchStage.category = category;
      
          // Search Term logic add kora hoyeche
          if (searchTerm) {
              matchStage.$or = [
                  { title: { $regex: searchTerm, $options: 'i' } },
                  { content: { $regex: searchTerm, $options: 'i' } }
              ];
          }
      
          const result = await Blog.aggregate([
              { $match: matchStage },
              {
                  $facet: {
                      data: [
                          { $sort: { createdAt: -1 } },
                          { $skip: (Number(page) - 1) * Number(limit) },
                          { $limit: Number(limit) },
                          {
                              $project: {
                                  _id: 1,
                                  title: 1,
                                  slug: 1,
                                  category: 1,
                                  image: 1,
                                  status: 1,
                                  views: 1,
                                  publishedAt: 1,
                              },
                          },
                      ],
                      total: [{ $count: 'count' }],
                  },
              },
          ]);
      
          // Data handling securely check kora hoyeche jeno array empty thakle crash na kore
          const blogs = result[0]?.data || [];
          const total = result[0]?.total[0]?.count || 0;
      
          const data = blogs.map((blog: any) => ({
              ...blog,
          }));
      
          return {
              meta: {
                  page: Number(page),
                  limit: Number(limit),
                  total,
                  totalPages: Math.ceil(total / Number(limit)),
              },
              data,
          };
};


const getBlogDetails = async (id: string) => {
       const blog = await Blog.findById(id);
       if (!blog) {
           throw new NotFoundError("Blog not found");
       }
       return blog;
};

const getBlogDetailsBySlug = async (slug: string) => {
       const blog = await Blog.findOneAndUpdate({ slug }, { $inc: { views: 1 } }, { new: true });
       if (!blog) {
           throw new NotFoundError("Blog not found");
       }
       return blog;
};

const deleteBlog = async (id: string) => {
       const blog = await Blog.findByIdAndDelete(id);
       if (!blog) {
           throw new NotFoundError("Blog not found");
       }
       return blog;
};

export const blogService = {
    createBlog,
    updateBlog,
    getAllBlogs,
    getBlogDetails,
    getBlogDetailsBySlug,
    deleteBlog
};