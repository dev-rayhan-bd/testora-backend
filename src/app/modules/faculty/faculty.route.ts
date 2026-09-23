import { Router } from 'express';

import authMiddleware from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/request.validator';
import { USER_ROLE } from '../user/user.constant';
import { facultyController } from './faculty.controller';
import facultyValidationZodSchema from './faculty.zod';



const facultyRouter = Router();

facultyRouter.post(
    '/add',
    authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
    validateRequest(
        {
            body: facultyValidationZodSchema.createFacultySchema,
        }
    ),
    facultyController.createFacultyIntodb,
);


facultyRouter.get(
    '/',
    authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
    validateRequest({
        query: facultyValidationZodSchema.getAllFacultiesDashboardQuerySchema,
    }),
    facultyController.getAllFacultiesDashboard,
);

facultyRouter.get(
    '/retrieve',
    authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN, USER_ROLE.STUDENT),
    facultyController.getAllFaculties,
);

facultyRouter.patch(
    '/:id',
    authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
    validateRequest({
        body: facultyValidationZodSchema.updateFacultySchema,
    }),
    facultyController.updateFaculty,
);

facultyRouter.delete(
    '/:id',
    authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
    facultyController.deleteFaculty,
);

export default facultyRouter;