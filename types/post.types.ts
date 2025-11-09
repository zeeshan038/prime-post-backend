import { Document, Types } from 'mongoose';

export interface IPost extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  content: string;
  platform: "twitter" | "facebook" | "instagram" | "linkedin";
  scheduleAt?: Date;
  publishedAt?: Date;   
  metadata?: {
    hashtags: string[];
    wordCount: number;
  };
  status: "draft" | "scheduled" | "published" | "failed";
  createdAt: Date;
  updatedAt: Date;
  analytics?: {
    views: number;
    clicks: number;
    likes: number;
  };
}
