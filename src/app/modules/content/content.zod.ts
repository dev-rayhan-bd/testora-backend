import { z } from 'zod';
import { CONTENT, TContent } from './content.constant';

const createOrUpdatePageSchema = z.object({
  type: z.enum(Object.values(CONTENT) as [TContent, ...TContent[]], {
    error: (issue) => {
        if (issue.input === undefined) return 'Content Type is required';
        if (typeof issue.input !== 'string') return 'Content Type must be a string';
      },
  }),
  title: z.string().min(3, 'Title must be at least 3 characters long').optional(),
  content: z.string().min(10, 'Content must be at least 10 characters long'),
});

export const contentZodValidation = {
  createOrUpdatePageSchema,
};
