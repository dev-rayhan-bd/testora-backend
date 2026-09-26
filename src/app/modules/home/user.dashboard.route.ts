import { Router } from "express";
import { userDashboardController } from "./user.dashboard.controller";
import authMiddleware from "../../middlewares/auth.middleware";
import { USER_ROLE } from "../user/user.constant";


const homeDashboardRouter = Router();

homeDashboardRouter.get('/exam-readiness',authMiddleware(USER_ROLE.STUDENT), userDashboardController.getExamReadiness);
homeDashboardRouter.get('/in-progress-sessions', authMiddleware(USER_ROLE.STUDENT), userDashboardController.getInProgressSessions);
homeDashboardRouter.get('/recent-activity', authMiddleware(USER_ROLE.STUDENT), userDashboardController.getRecentActivity);
homeDashboardRouter.get('/subscription-plan', authMiddleware(USER_ROLE.STUDENT), userDashboardController.getSubscriptionPlan);
homeDashboardRouter.get('/weak-topics', authMiddleware(USER_ROLE.STUDENT), userDashboardController.getWeakTopics);

// Public route - no auth needed (for landing page stats)
homeDashboardRouter.get('/platform-stats', userDashboardController.getPlatformStats);

export default homeDashboardRouter;