import Engagement from "../models/engagment";
import Post from "../models/post";
import { getOrSetCache } from "../utils/cache";
import { Types, PipelineStage } from "mongoose";

interface OptimalSlot {
    dayOfWeek: number;
    hour: number;
    averageEngagement: number;
    sampleSize: number;
    confidenceScore: number;
}
/**
 * A) Post Performance Metrics
 */
export async function getPostPerformance(postId: string) {
  const cacheKey = `post:performance:${postId}`;

  // cache for 10 minutes (600 seconds)
  return await getOrSetCache(cacheKey, 600, async () => {
    const post = await Post.findById(postId).lean();
    if (!post) throw new Error("Post not found");

    const result = await Engagement.aggregate([
      { $match: { postId: post._id } },
      {
        $group: {
          _id: "$postId",
          totalLikes: { $sum: "$metrics.likes" },
          totalComments: { $sum: "$metrics.comments" },
          totalShares: { $sum: "$metrics.shares" },
          totalClicks: { $sum: "$metrics.clicks" },
          totalImpressions: { $sum: "$metrics.impressions" },
        },
      },
    ]);

    const data = result[0] || {
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalClicks: 0,
      totalImpressions: 0,
    };

    const totalEngagement =
      data.totalLikes + data.totalComments + data.totalShares;
    const engagementRate = data.totalImpressions
      ? (totalEngagement / data.totalImpressions) * 100
      : 0;
    const clickThroughRate = data.totalImpressions
      ? (data.totalClicks / data.totalImpressions) * 100
      : 0;

    const publishedAtMs = post.publishedAt
      ? new Date(post.publishedAt as any).getTime()
      : Date.now();
    const hoursSincePublished = Math.max(
      1,
      (Date.now() - publishedAtMs) / (1000 * 60 * 60)
    );
    const averageEngagementPerHour = totalEngagement / hoursSincePublished;

    const performanceScore =
      engagementRate * 0.4 + clickThroughRate * 0.3 + data.totalShares * 0.3;

    return {
      postId: post._id,
      totalEngagement,
      engagementRate,
      clickThroughRate,
      averageEngagementPerHour,
      performanceScore,
    };
  });
}

/**
 * B) Optimal Posting Time Analysis
 *
 * Steps:
 * - look at last 30 days
 * - per (dayOfWeek, hourOfDay) compute weighted average engagement
 * - filter outlier slots (avgRaw > globalAvg * 3)
 * - compute confidence = min(1, sampleSize/10) * (avgWeighted / maxEngagement)
 * - return top N
 */
export async function calculateOptimalPostingTimes(userId: string): Promise<OptimalSlot[]> {
  const cacheKey = `optimalTimes:${userId}`;

  return getOrSetCache<OptimalSlot[]>(cacheKey, 3600, async () => {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const data = await Engagement.aggregate([
      { $match: { userId: new Types.ObjectId(userId), timestamp: { $gte: last30Days } } },
      {
        $addFields: {
          ageInDays: {
            $divide: [{ $subtract: [now, "$timestamp"] }, 1000 * 60 * 60 * 24],
          },
          totalEngagement: { $add: ["$metrics.likes", "$metrics.comments", "$metrics.shares"] },
        },
      },
      {
        $addFields: {
          weightedEngagement: {
            $multiply: [
              "$totalEngagement",
              { $pow: [2, { $divide: [{ $subtract: [30, "$ageInDays"] }, 30] }] },
            ],
          },
        },
      },
      {
        $group: {
          _id: { dayOfWeek: "$dayOfWeek", hour: "$hourOfDay" },
          weightedValues: { $push: "$weightedEngagement" },
          sampleSize: { $sum: 1 },
        },
      },
      {
        $project: {
          weightedValues: 1,
          sampleSize: 1,
          avgWeighted: { $avg: "$weightedValues" },
          stdDev: { $stdDevPop: "$weightedValues" },
        },
      },
      {
        $project: {
          avgWeighted: 1,
          sampleSize: 1,
          filteredAvg: {
            $avg: {
              $filter: {
                input: "$weightedValues",
                as: "v",
                cond: { $lte: ["$$v", { $add: ["$avgWeighted", { $multiply: [3, "$stdDev"] }] }] },
              },
            },
          },
        },
      },
      { $sort: { filteredAvg: -1 } },
      { $limit: 5 },
    ]);

    if (!data.length) return [];

    const maxEngagement = Math.max(...data.map((d: any) => d.filteredAvg));

    return data.map((d: any) => ({
      dayOfWeek: d._id.dayOfWeek,
      hour: d._id.hour,
      averageEngagement: d.filteredAvg,
      sampleSize: d.sampleSize,
      confidenceScore: Math.min(1, d.sampleSize / 10) * (d.filteredAvg / maxEngagement),
    }));
  });
}

/**
 * C) Engagement Trends (supports periodDays and granularity)
 * granularity: 'hourly' | 'daily' | 'weekly'
 */
type Granularity = "hourly" | "daily" | "weekly";

interface TrendResult {
    date: string;
    value: number;
    movingAvg?: number;
}

interface TrendSummary {
    total: number;
    average: number;
    growth: number;
    peak: { date: string; value: number };
}



export async function calculateEngagementTrends(
    userId: string,
    period: string,
    granularity: Granularity,
    metric: "likes" | "comments" | "shares" | "clicks" | "impressions" | "engagement" = "engagement"
) {
    const cacheKey = `trends:${userId}:${period}:${granularity}:${metric}`;
    return getOrSetCache(cacheKey, 60 * 15, async () => {
    const now = new Date();
    let days = 7;
    if (period.endsWith("d")) days = parseInt(period.slice(0, -1));
    const lastDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Determine date format for grouping
    let dateFormat = "%Y-%m-%d"; // daily default
    if (granularity === "hourly") dateFormat = "%Y-%m-%dT%H:00:00";
    else if (granularity === "weekly") dateFormat = "%Y-%U";

    // Determine field to sum
    const engagementField =
        metric === "engagement"
            ? { $add: ["$metrics.likes", "$metrics.comments", "$metrics.shares"] }
            : `$metrics.${metric}`;

    const aggPipeline: PipelineStage[] = [
        { $match: { userId: new Types.ObjectId(userId), timestamp: { $gte: lastDate } } },
        { $project: { timestamp: 1, value: engagementField } },
        {
            $group: {
                _id: { $dateToString: { format: dateFormat, date: "$timestamp" } },
                total: { $sum: "$value" },
                count: { $sum: 1 },
            },
        },
        { $sort: { "_id": 1 } },
        {
            $setWindowFields: {
                sortBy: { "_id": 1 },
                output: {
                    movingAvg: { $avg: "$total", window: { documents: [-6, 0] } },
                },
            },
        },
    ];

    const result = await Engagement.aggregate(aggPipeline as PipelineStage[]);

    // Growth calculation
    let growth = 0;
    if (result.length >= 2) {
        const prevTotal = result[0].total;
        const currTotal = result[result.length - 1].total;
        growth = ((currTotal - prevTotal) / Math.max(prevTotal, 1)) * 100;
    }

    // Peak record
    const peak = result.reduce(
        (prev, curr) => (curr.total > prev.total ? curr : prev),
        { _id: "", total: 0 } as any
    );

    return {
        data: result.map(r => ({
            date: r._id,
            value: r.total,
            movingAvg: r.movingAvg,
        })) as TrendResult[],
        summary: {
            total: result.reduce((acc, r) => acc + r.total, 0),
            average: result.reduce((acc, r) => acc + r.total, 0) / Math.max(result.length, 1),
            growth,
            peak: { date: peak._id, value: peak.total },
        } as TrendSummary,
    };
    });
}

/**
 * D) Platform comparison & Top posts
 */
export async function getPlatformPerformance(userId: string, platform?: string) {
  // Unique cache key — include platform if provided
  const cacheKey = platform
    ? `platformPerf:${userId}:${platform}`
    : `platformPerf:${userId}`;

  // Cache for 15 minutes (900 seconds)
  return getOrSetCache(cacheKey, 60 * 15, async () => {
    const matchStage: Record<string, any> = { userId: new Types.ObjectId(userId) };
    if (platform) matchStage.platform = platform;

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $group: {
          _id: "$platform",
          likes: { $sum: "$metrics.likes" },
          comments: { $sum: "$metrics.comments" },
          shares: { $sum: "$metrics.shares" },
          clicks: { $sum: "$metrics.clicks" },
          impressions: { $sum: "$metrics.impressions" },
        },
      },
      {
        $project: {
          platform: "$_id",
          totalEngagement: { $add: ["$likes", "$comments", "$shares"] },
          likes: 1,
          comments: 1,
          shares: 1,
          clicks: 1,
          impressions: 1,
          _id: 0,
        },
      },
      { $sort: { totalEngagement: -1 } },
    ];

    const result = await Engagement.aggregate(pipeline).allowDiskUse(true);

    return result;
  });
}


export async function getTopPosts(userId: string, limit = 5) {
  const cacheKey = `topPosts:${userId}:${limit}`;
  
  return getOrSetCache(cacheKey, 60 * 5, async () => {
    const pipeline: PipelineStage[] = [
      { $match: { userId: new Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$postId",
          likes: { $sum: "$metrics.likes" },
          comments: { $sum: "$metrics.comments" },
          shares: { $sum: "$metrics.shares" },
          clicks: { $sum: "$metrics.clicks" },
          impressions: { $sum: "$metrics.impressions" },
        },
      },
      {
        $project: {
          totalEngagement: { $add: ["$likes", "$comments", "$shares"] },
          engagementRate: {
            $cond: [
              { $eq: ["$impressions", 0] },
              0,
              {
                $multiply: [
                  { $divide: [{ $add: ["$likes", "$comments", "$shares"] }, "$impressions"] },
                  100,
                ],
              },
            ],
          },
          clicks: 1,
          impressions: 1,
        },
      },
      { $sort: { engagementRate: -1, totalEngagement: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "posts",
          localField: "_id",
          foreignField: "_id",
          as: "post",
        },
      },
      { $unwind: "$post" },
      { $project: { post: 1, totalEngagement: 1, engagementRate: 1 } },
    ];

    const result = await Engagement.aggregate(pipeline).allowDiskUse(true);
    return result;
  });
}

export async function getPerformanceComparison(
  userId: string,
  startDate: string,
  endDate: string,
) {
  const cacheKey = `performanceComparison:${userId}:${startDate}:${endDate}`;
  console.log(cacheKey)

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Auto-calculate previous period if not given
  const diff = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - diff);

  const matchBase: any = { userId: new Types.ObjectId(userId) };

  const makePipeline = (from: Date, to: Date): PipelineStage[] => [
    { $match: { ...matchBase, timestamp: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: null,
        likes: { $sum: "$metrics.likes" },
        comments: { $sum: "$metrics.comments" },
        shares: { $sum: "$metrics.shares" },
        clicks: { $sum: "$metrics.clicks" },
        impressions: { $sum: "$metrics.impressions" },
      },
    },
    {
      $project: {
        _id: 0,
        totalEngagement: { $add: ["$likes", "$comments", "$shares"] },
        likes: 1,
        comments: 1,
        shares: 1,
        clicks: 1,
        impressions: 1,
      },
    },
  ];

  return getOrSetCache(cacheKey, 60 * 5, async () => {
    const [currentData, previousData] = await Promise.all([
      Engagement.aggregate(makePipeline(start, end)),
      Engagement.aggregate(makePipeline(prevStart, prevEnd)),
    ]);

    const current = currentData[0] || {
      totalEngagement: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: 0,
      impressions: 0,
    };

    const previous = previousData[0] || {
      totalEngagement: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: 0,
      impressions: 0,
    };

    const calcGrowth = (curr: number, prev: number) =>
      prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;

    return {
      currentPeriod: { startDate, endDate, ...current },
      previousPeriod: {
        startDate: prevStart.toISOString(),
        endDate: prevEnd.toISOString(),
        ...previous,
      },
      growth: {
        engagement: calcGrowth(current.totalEngagement, previous.totalEngagement),
        clicks: calcGrowth(current.clicks, previous.clicks),
        impressions: calcGrowth(current.impressions, previous.impressions),
      },
    };
  });
}



export async function getDashboardOverview(userId: string, range = '30d') {
  const cacheKey = `dashboard:${userId}:${range}`;
  return getOrSetCache(cacheKey, 60 * 5, async () => {
    const now = new Date();
    const start = new Date(now);
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    start.setDate(now.getDate() - days);

    const matchUser: any = { userId: new Types.ObjectId(userId) };

    // Aggregate concurrently
    const [postsByStatus, engagementByPlatform, engagementAllTimeAgg, topPosts, chart, optimalTimes] = await Promise.all([
      // Posts count by status
      Post.aggregate([
        { $match: { userId: new Types.ObjectId(userId) } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      // Engagement per platform within range
      Engagement.aggregate([
        { $match: { ...matchUser, timestamp: { $gte: start, $lte: now } } },
        { $group: { _id: "$platform", likes: { $sum: "$metrics.likes" }, comments: { $sum: "$metrics.comments" }, shares: { $sum: "$metrics.shares" } } },
      ]),
      // All-time engagement total
      Engagement.aggregate([
        { $match: matchUser },
        { $group: { _id: null, total: { $sum: { $add: ["$metrics.likes", "$metrics.comments", "$metrics.shares"] } } } },
      ]),
      // Top 5 posts by engagement rate
      getTopPosts(userId, 5),
      // Engagement chart for range (daily granularity)
      calculateEngagementTrends(userId, `${days}d`, "daily", "engagement"),
      // Optimal posting times
      calculateOptimalPostingTimes(userId),
    ]);

    const totalEngagementAllTime = engagementAllTimeAgg[0]?.total || 0;
    const totalEngagementInRange = engagementByPlatform.reduce(
      (sum: number, e: any) => sum + e.likes + e.comments + e.shares,
      0
    );

    // Best performing platform in the selected range
    const best = engagementByPlatform
      .map((e: any) => ({ platform: e._id, engagement: e.likes + e.comments + e.shares }))
      .sort((a: any, b: any) => b.engagement - a.engagement)[0] || null;

    const avgEngagementRate = totalEngagementAllTime
      ? Number(((totalEngagementInRange / totalEngagementAllTime) * 100).toFixed(1))
      : 0;

    return {
      totals: {
        posts: {
          published: postsByStatus.find((p: any) => p._id === "published")?.count || 0,
          scheduled: postsByStatus.find((p: any) => p._id === "scheduled")?.count || 0,
          draft: postsByStatus.find((p: any) => p._id === "draft")?.count || 0,
        },
        engagement: {
          allTime: totalEngagementAllTime,
          lastPeriod: totalEngagementInRange,
        },
        avgEngagementRate,
      },
      bestPlatform: best,
      topPosts,
      chart: chart.data, 
      optimalPostingTimes: optimalTimes, 
    };
  });
}


