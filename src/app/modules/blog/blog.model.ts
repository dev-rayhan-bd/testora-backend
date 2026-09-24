import mongoose, { Schema } from "mongoose";
import { BLOG_CATEGORY, BLOG_STATUS } from "./blog.constant";
import { IBlog } from "./blog.interface";


const blogSchema = new Schema<IBlog>(
    {
        title: { type: String, required: true },
        slug: { type: String, required: true, unique: true },
        content: { type: String, required: true },
        image: { type: String, default: null },
        seoTitle: { type: String, default: null },
        seoDescription: { type: String, default: null },
        publishedAt: { type: Date, default: null },
        status: {
                    type: String,
                    enum: Object.values(BLOG_STATUS),
                    required: true,
                },
        views: { type: Number, default: 0 },
        category: {
            type: String,
            enum: Object.values(BLOG_CATEGORY),
            required: true,
        }
    },
    { timestamps: true, versionKey: false }
);


const Blog = mongoose.model<IBlog>("Blog", blogSchema);
export default Blog;