import express from 'express';
import authRouter from '../modules/auth/auth.route';
import contentRouter from '../modules/content/content.route';
import adminRouter from '../modules/dashboard';
import departmentRouter from '../modules/department/department.route';
import facultyRouter from '../modules/faculty/faculty.route';
import homeDashboardRouter from '../modules/home/user.dashboard.route';
import passageRouter from '../modules/passage/passage.route';
import questionRouter from '../modules/question/question.route';
import quizRouter from '../modules/quiz-session/quiz.session.route';
import subjectRouter from '../modules/subject/subject.route';
import testRouter from '../modules/test/test.route';
import userRouter from '../modules/user/user.route';
import blogRouter from '../modules/blog/blog.route';
import productRouter from '../modules/product/product.route';
import orderRouter from '../modules/order/order.route';
import couponRouter from '../modules/coupon/coupon.route';
import shippingRouter from '../modules/shipping/shipping.route';
import categoryRouter from '../modules/category/category.route';


const routersVersionOne = express.Router();

const appRouters = [
  {
    path: '/user',
    router: userRouter,
  },
  {
    path: '/admin',
    router: adminRouter,
  },
  {
    path: '/auth',
    router: authRouter,
  },

  {
    path: '/blog',
    router: blogRouter,
  },

  {
    path: '/product',
    router: productRouter,
  },

  {
    path: '/products',
    router: productRouter,
  },

  {
    path: '/orders',
    router: orderRouter,
  },

  {
    path: '/order',
    router: orderRouter,
  },

  {
    path: '/coupons',
    router: couponRouter,
  },

  {
    path: '/coupon',
    router: couponRouter,
  },
  {
    path: '/shipping',
    router: shippingRouter,
  },
  {
    path: '/shipping-settings',
    router: shippingRouter,
  },
  {
    path: '/category',
    router: categoryRouter,
  },
  {
    path: '/categories',
    router: categoryRouter,
  },

  {
    path: '/content',
    router: contentRouter,
  },

  {
    path: '/home/dashboard',
    router: homeDashboardRouter,
  },

  {
    path: '/subject',
    router: subjectRouter,
  },

  {
    path: '/faculty',
    router: facultyRouter,
  },

  {
    path: '/department',
    router: departmentRouter,
  },

  {
    path: '/question',
    router: questionRouter,
  },

  {
    path: '/test-archive',
    router: testRouter,
  },

  {
    path: '/quiz',
    router: quizRouter,
  },

  {
    path: '/passage',
    router: passageRouter,
  },

];

appRouters.forEach((router) => {
  routersVersionOne.use(router.path, router.router);
});

export default routersVersionOne;
