import cron from "node-cron";
import Post from "../models/post";
import Engagement from "../models/engagment";

/**
 * Weighted random generator helpers
 */
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Weight multipliers:
 * - Peak hours 9..17 => x1.4
 * - Weekends (Sat=6, Sun=0) => x0.7
 * - Post age: newer posts get boost, older dampened (exponential decay)
 */
function computeMultipliers(publishedAt?: Date) {
    const now = new Date();
    const hour = now.getUTCHours();
    const day = now.getUTCDay();

    let timeMultiplier = (hour >= 9 && hour <= 17) ? 1.4 : 0.9;
    let dayMultiplier = (day === 0 || day === 6) ? 0.7 : 1;

    let ageMultiplier = 1;
    if (publishedAt) {
        const ageDays = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24));
        ageMultiplier = Math.pow(2, Math.max(0, (30 - ageDays) / 30));
    }

    return { timeMultiplier, dayMultiplier, ageMultiplier };
}

export const startEngagementSimulator = () => {
    // every 30 seconds
    cron.schedule("*/30 * * * * *", async () => {
        try {
            const posts = await Post.find({ status: "published" })
                .select("_id userId platform publishedAt")
                .lean()
                .limit(1000);

            const now = new Date();

            const operations = posts.map((p) => {
                const { timeMultiplier, dayMultiplier, ageMultiplier } = computeMultipliers(p.publishedAt);
                const multiplier = timeMultiplier * dayMultiplier * ageMultiplier;

                const likes = Math.round(rand(0, 50) * multiplier);
                const comments = Math.round(rand(0, 20) * multiplier);
                const shares = Math.round(rand(0, 15) * multiplier);
                const clicks = Math.round(rand(0, 100) * multiplier);
                const impressions = Math.round(rand(100, 1000) * multiplier);

                return {
                    updateOne: {
                        filter: {
                            postId: p._id,
                            hourOfDay: now.getUTCHours(),
                            dayOfWeek: now.getUTCDay(),
                        },
                        update: {
                            $inc: {
                                "metrics.likes": likes,
                                "metrics.comments": comments,
                                "metrics.shares": shares,
                                "metrics.clicks": clicks,
                                "metrics.impressions": impressions,
                            },
                            $set: {
                                timestamp: now,
                                userId: p.userId,
                                platform: p.platform,
                            },
                        },
                        upsert: true,
                    },
                };
            });

            if (operations.length) {
                await Engagement.bulkWrite(operations);
            }
        } catch (err) {
            console.error("simulateEngagement error:", err);
        }
    }, { timezone: "UTC" });
};
