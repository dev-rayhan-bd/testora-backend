
export const BLOG_STATUS = {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    HIDDEN: 'hidden',
} as const;


export const BLOG_CATEGORY = {
    ENTRANCE_EXAM: 'Entrance Exams',
    MATURA: 'Matura',
    SEMI_MATURA: 'Semi Matura',
    PLATFORM_UPDATES: 'Platform Updates',
    UNIVERSITY_PREPARATIONS: 'University Preparations',
    STUDY_TIPS: 'Study Tips',
    QUIZ_TIPS: 'Quiz Tips',
} as const;

export type TBlogStatus = (typeof BLOG_STATUS)[keyof typeof BLOG_STATUS];
export type TBlogCategory = (typeof BLOG_CATEGORY)[keyof typeof BLOG_CATEGORY];