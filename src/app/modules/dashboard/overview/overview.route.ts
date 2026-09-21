import { Router } from 'express';
import authMiddleware from '../../../middlewares/auth.middleware';
import { USER_ROLE } from '../../user/user.constant';
import { overviewController } from './overview.controller';

const userOverviewRouter = Router();

/**
 * @route   GET /api/v1/admin/overview
 * @desc    Comprehensive all-in-one aggregation covering user stats, growth trends, product breakdowns, content summaries, and alerts
 * @query   year (e.g. ?year=2026, defaults to current year)
 * @access  Admin & Super Admin
 */
userOverviewRouter.get(
  '/',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  overviewController.getCompleteOverviewIntoDb,
);

/**
 * @route   GET /api/v1/admin/overview/stats
 * @desc    Legacy / Standalone user count statistics
 * @access  Admin & Super Admin
 */
userOverviewRouter.get(
  '/stats',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  overviewController.getStatsOverviewIntoDb,
);

/**
 * @route   GET /api/v1/admin/overview/user-growth
 * @desc    Legacy / Standalone monthly user growth
 * @query   year (optional)
 * @access  Admin & Super Admin
 */
userOverviewRouter.get(
  '/user-growth',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  overviewController.getUserGrowthIntoDb,
);

/**
 * @route   GET /api/v1/admin/overview/recent-active-users
 * @desc    Legacy / Standalone recent active student accounts
 * @access  Admin & Super Admin
 */
userOverviewRouter.get(
  '/recent-active-users',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  overviewController.getRecentUsersIntoDb,
);

export default userOverviewRouter;
