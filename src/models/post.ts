import mongoose from "mongoose";
import { IPost } from "../types/post.types";


const postSchema = new mongoose.Schema<IPost>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 1000,
      trim: true,
    },
    platform: {
      type: String,
      enum: ["twitter", "facebook", "instagram", "linkedin"],
      required: true,
      index: true,
    },
    scheduleAt: {
      type: Date,
      index: true,
    },
    publishedAt: {
      type: Date,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "published", "failed"],
      default: "draft",
      index: true,
    },
    metadata: {
      hashtags: [{ type: String }],
      wordCount: { type: Number, default: 0 },
    },
    analytics: {
      views: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IPost>("Post", postSchema);
