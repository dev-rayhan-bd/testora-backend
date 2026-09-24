import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import slugify from "slugify";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import Blog from "../../src/app/modules/blog/blog.model";

const MONGODB_URI = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/elearning";

async function run() {
  console.log("Connecting to MongoDB:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  const blogs = await Blog.find({});
  for (const blog of blogs) {
    if (!blog.slug) {
      // @ts-ignore
      blog.slug = slugify(blog.title, { lower: true, strict: true });
      await blog.save();
      console.log(`Updated slug for blog: ${blog.title} -> ${blog.slug}`);
    }
  }

  console.log("Done!");
  mongoose.disconnect();
}

run().catch(console.error);
