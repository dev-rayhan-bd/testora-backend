import { Router } from "express";
import dashboardQuestionRouter from "./question/question.route";
import userManagementRouter from "./user-management/user.management.route";
import userOverviewRouter from "./overview/overview.route";
import { adminController } from "./admin/admin.controller";
import authMiddleware from "../../middlewares/auth.middleware";
import { USER_ROLE } from "../user/user.constant";
import blogRouter from "../blog/blog.route";
import productRouter from "../product/product.route";
import orderRouter from "../order/order.route";
import couponRouter from "../coupon/coupon.route";


const adminRouter = Router();


adminRouter.use('/questions', dashboardQuestionRouter);
adminRouter.use('/users', userManagementRouter);
adminRouter.use('/overview', userOverviewRouter);
adminRouter.use('/blog', blogRouter);
adminRouter.use('/products', productRouter);
adminRouter.use('/orders', orderRouter);
adminRouter.use('/coupons', couponRouter);
adminRouter.use('/get-me', authMiddleware(USER_ROLE.SUPER_ADMIN), adminController.getMeIntoDb);


export default adminRouter;