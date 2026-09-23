import { Router } from 'express';

import authMiddleware from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/request.validator';
import { USER_ROLE } from '../user/user.constant';
import { departmentController } from './department.controller';
import departmentValidationZodSchema from './department.zod';


const departmentRouter = Router();

departmentRouter.post(
    '/add/:faculty',
    authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
    validateRequest(
        {
            body: departmentValidationZodSchema.createDepartmentSchema,
        }
    ),
    departmentController.createDepartmentIntodb,
);

departmentRouter.get(
    '/',
    authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
    validateRequest({
        query: departmentValidationZodSchema.getAllDepartmentsDashboardQuerySchema,
    }),
    departmentController.getAllDepartmentsDashboard,
);

departmentRouter.get(
    '/retrieve/:facultyId',
    authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN, USER_ROLE.STUDENT),
    departmentController.getAllDepartments,
);

departmentRouter.patch(
    '/:id',
    authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
    validateRequest({
        body: departmentValidationZodSchema.updateDepartmentSchema,
    }),
    departmentController.updateDepartment,
);

departmentRouter.delete(
    '/:id',
    authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
    departmentController.deleteDepartment,
);

export default departmentRouter;