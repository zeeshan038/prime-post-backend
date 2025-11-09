//NPM Package
import express from "express";

//Controllers
import { getEngagmentTrends, getOptimalPostingTimes, platformPerformance, topPosts, performanceComparison, dashboardOverview } from "../controller/analytics";

//middleware
import { verifyUser } from '../middlewares/verifyUser'

const router = express.Router();

router.use(verifyUser)

router.get('/optimal-times', getOptimalPostingTimes);
router.get('/trends', getEngagmentTrends);
router.get('/platform-performance', platformPerformance);
router.get('/top-posts', topPosts);
router.get('/comparison', performanceComparison);
router.get('/dashboard', dashboardOverview);


export default router; 