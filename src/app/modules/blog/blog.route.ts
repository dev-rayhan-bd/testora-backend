import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware';
import { USER_ROLE } from '../user/user.constant';
import { uploadFile } from '../../../helpers/fileuploader';
import { validateFileSizes } from '../../middlewares/validateFileSize';
import { validateFormDataRequest } from '../../middlewares/request.validator';
import { blogController } from './blog.controller';
import blogValidationZodSchema from './blog.zod';


const  blogRouter = Router();

blogRouter.post(
    '/add',
    authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
    uploadFile(),
    validateFileSizes,
    validateFormDataRequest(blogValidationZodSchema.createBlogSchema),
    blogController.createBlogIntoDb,
);


blogRouter.put(
    '/update/:id',
    authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
    uploadFile(),
    validateFileSizes,
    validateFormDataRequest(blogValidationZodSchema.createBlogSchema),
    blogController.updateBlogIntoDb,
);

blogRouter.get(
    '/list',
    authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN,USER_ROLE.STUDENT),
    blogController.getAllBlogsFromDb,
);


blogRouter.get(
    '/details/:id',
    authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN,USER_ROLE.STUDENT),
    blogController.getAllBlogDetailsFromDb,
);

blogRouter.get(
    '/slug/:slug',
    blogController.getBlogDetailsBySlugFromDb,
);

blogRouter.delete(
    '/delete/:id',
    authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
    blogController.deleteBlogFromDb,
);

export default blogRouter;