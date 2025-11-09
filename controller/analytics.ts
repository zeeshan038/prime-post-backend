//NPM Packages
import { Request, Response } from "express";

//service
import { calculateEngagementTrends, calculateOptimalPostingTimes, getDashboardOverview, getPerformanceComparison, getPlatformPerformance, getTopPosts } from "../services/analytics";

/**
 * @Description Get optimal posting times
 * @Routes GET /api/analytics/optimal-times
 * @Access Private
 */
export const getOptimalPostingTimes = async (req: Request, res: Response) => {
    const { id } = req.user;
    try {
        const optimalTimes = await calculateOptimalPostingTimes(id);
        return res.status(200).json(
            {
                status: true,
                data: optimalTimes
            });
    } catch (error: any) {
        return res.status(500).json(
            {
                status: false,
                error: error.message
            });
    }
}

/**
 * @Description Get engagment trends
 * @Routes GET /api/analytics/engagment-trends?period=7d&granularity=daily&metric=engagement
 * @Access Private
 */
export const getEngagmentTrends = async (req: Request, res: Response) => {
    const { id } = req.user;
    const periodStr = (req.query.period as string) || "7d";
    const granStr = (req.query.granularity as string) || "daily";
    const metricStr = (req.query.metric as string) || "engagement";

    const allowedGran = ["hourly", "daily", "weekly"] as const;
    const gran = (allowedGran as readonly string[]).includes(granStr)
        ? (granStr as typeof allowedGran[number])
        : "daily";

    const allowedMetric = ["likes", "comments", "shares", "clicks", "impressions", "engagement"] as const;
    const met = (allowedMetric as readonly string[]).includes(metricStr)
        ? (metricStr as typeof allowedMetric[number])
        : "engagement";
    try {
        const trends = await calculateEngagementTrends(id, periodStr, gran, met);
        return res.status(200).json(
            {
                status: true,
                data: trends
            });
    } catch (error: any) {
        return res.status(500).json(
            {
                status: false,
                error: error.message
            });
    }
}

/**
 * @Description Get platform performance
 * @Route GET /api/analytics/performance/platforms
 * @Access private
 */
export const platformPerformance = async (req: Request, res: Response) => {
    const { id } = req.user;
    const { platform } = req.query;
    try {
        const performance = await getPlatformPerformance(id, platform as string);
        return res.status(200).json({
            status: true,
            data: performance,
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            error: error.message,
        });
    }
};


/**
 * @Description Get analytics performance for top posts
 * @Route GET /api/analytics/performance/top-posts?limit=10
 * @Access private
 */
export const topPosts = async (req: Request, res: Response) => {
    const { id } = req.user;
    const limit = parseInt(req.query.limit as string) || 5;
    try {
        const performance = await getTopPosts(id, limit);
        return res.status(200).json({
            status: true,
            data: performance,
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            error: error.message,
        });
    }
}


/**
 * @Description Get perfomance comparison
 * @Route GET /api/analytics/performance/comparison?startDate=&endDate=
 * @Access private
 */
export const performanceComparison = async (req: Request, res: Response) => {
    const { id } = req.user;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({
            status: false,
            error: "startDate and endDate are required",
        });
    }

    try {
        const data = await getPerformanceComparison(
            id,
            startDate as string,
            endDate as string
        );

        return res.status(200).json({
            status: true,
            data,
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            error: error.message,
        });
    }
};

/**
 * @Description Dashboard overview (best platform is computed internally)
 * @Route GET /api/analytics/dashboard?range=7d|30d|90d
 * @Access private
 */
export const dashboardOverview = async (req: Request, res: Response) => {
    const {id} = req.user;
    const { range = "30d" } = req.query;
    try {
        const data = await getDashboardOverview(id, range as string);
        return res.status(200).json({ status: true, data });
    } catch (error: any) {
        return res.status(500).json({ status: false, message: error.message });
    }
};
