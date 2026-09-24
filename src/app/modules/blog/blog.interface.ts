import { TBlogCategory, TBlogStatus } from "./blog.constant";

export interface BlogFiles {
    blog_image?: Express.Multer.File[];
}

export interface IBlog extends Document {
    title: string;
    slug: string;
    content: string;
    image: string | null;
    seoTitle: string | null;
    category: TBlogCategory;
    seoDescription: string | null;
    status: TBlogStatus;
    views: number;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
