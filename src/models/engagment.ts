import mongoose, { Document, Schema, Types, Query } from "mongoose";
import { delCache } from "../utils/cache";

export interface IEngagement extends Document {
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  platform: string;
  timestamp: Date;
  metrics: {
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
    impressions: number;
  };
  hourOfDay: number;
  dayOfWeek: number;
}

const engagementSchema = new Schema<IEngagement>(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    platform: { type: String, index: true },
    timestamp: { type: Date, default: () => new Date(), index: true },
    metrics: {
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      impressions: { type: Number, default: 0 },
    },
    hourOfDay: { type: Number, index: true },
    dayOfWeek: { type: Number, index: true },
  },
  { timestamps: true }
);

// TTL index: documents expire after 90 days (90 * 24 * 3600)
engagementSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Useful compound indexes
engagementSchema.index({ postId: 1, timestamp: -1 });
engagementSchema.index({ userId: 1, timestamp: -1 });
engagementSchema.index({ userId: 1, dayOfWeek: 1, hourOfDay: 1 });

/* 🧹 Automatically delete cache when engagement updates */
async function invalidateCache(
  this: Query<any, IEngagement> | any,
  doc: IEngagement
) {
  const postId = doc?.postId || this.getQuery()?.postId;
  if (postId) {
    delCache(`post:performance:${postId}`);
  }
}

engagementSchema.post("save", invalidateCache);
engagementSchema.post("findOneAndUpdate", invalidateCache);
engagementSchema.post("deleteOne", invalidateCache);
engagementSchema.post("deleteMany", invalidateCache);

export default mongoose.model<IEngagement>("Engagement", engagementSchema);
