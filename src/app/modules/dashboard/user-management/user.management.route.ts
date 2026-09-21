import { Router } from "express";
import authMiddleware from "../../../middlewares/auth.middleware";
import { USER_ROLE } from "../../user/user.constant";
import { userManagementController } from "./user.management.controller";



const userManagementRouter = Router();

userManagementRouter.get(
    '/overview',
    authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
    userManagementController.getUserStatsIntoDb,
);

userManagementRouter.get(
    '/list',
    authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
    userManagementController.getAllUsersIntoDb,
);

userManagementRouter.get(
    '/:id',
    authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
    userManagementController.getUserByIdIntoDb,
);

userManagementRouter.patch(
    '/:id/status',
    authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
    userManagementController.updateUserStatusIntoDb,
);

export default userManagementRouter;