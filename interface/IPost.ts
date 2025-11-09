import { Document, Types } from "mongoose";

export interface IPost extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  content: string;
  platform: "twitter" | "facebook" | "instagram" | "linkedin";
  status: "draft" | "scheduled" | "published" | "failed";
  scheduleAt?: Date;
  publishedAt?: Date;
  metadata?: {
    hashtags?: string[];
    wordCount?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}


export interface ListPostOptions {
  page?: number;
  limit?: string;
  status?: string;
  platform?: string;
  sort?: string;
  cursor?: string;
  search?:string;
}