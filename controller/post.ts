//NPM Package
import { Request, Response } from "express";
import mongoose from "mongoose";

//Schema
import { createPostSchema, updatePostSchema } from "../schema/Post";

//Models
import Post from '../models/post';

//interface
import { ListPostOptions } from "../interface/IPost";
import engagment from "../models/engagment";


/**
 * @Description create post
 * @Route POST /api/post/create
 * @Access Private
 */
export const create = async (req: Request, res: Response) => {
    const { id } = req.user;
    const payload = req.body;

    const result = createPostSchema(payload);
    if (result.error) {
        const errors = result.error.details.map((detail) => detail.message);
        return res.status(400).json({
            status: false,
            msg: errors,
        });
    }

    try {
        const post = await Post.create({ userId: id, ...payload })
        return res.status(200).json({
            status: true,
            msg: "Post created",
            post,
        });
    } catch (error: any) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @Description get all posts
 * @Route POST /api/post/posts
 * @Access Private
 */
export const getAllPosts = async (req: Request, res: Response) => {
  const { id } = req.user;
  const {
    search="",
    limit ="20",
    status,
    platform,
    sort = "-createdAt",
    cursor,
  }: ListPostOptions = req.query;
 console.log(req.query);
  try {
    // Build filter
    const filter: any = { userId: id };

    if (status) filter.status = status;
    if (platform) filter.platform = platform;

    // Add text search filter
    if (search.trim()) {
      filter.$or = [
        { content: { $regex: search, $options: "i" } }, 
        { platform: { $regex: search, $options: "i" } }, 
        { status: { $regex: search, $options: "i" } }, 
      ];
    }

    // Handle cursor-based pagination
    if (cursor) {
      if (!mongoose.Types.ObjectId.isValid(cursor)) {
        return res.status(400).json({ status: false, msg: "Invalid cursor" });
      }
      filter._id = { $gt: new mongoose.Types.ObjectId(cursor) };
    }

    // Fetch posts
    const posts = await Post.find(filter)
      .sort(sort === "-createdAt" ? { _id: 1 } : { _id: -1 })
      .limit(Number(limit))
      .lean();

    // Determine next cursor
    const nextCursor = posts.length ? posts[posts.length - 1]._id : null;

    return res.status(200).json({
      status: true,
      msg: "Posts fetched successfully",
      data: posts,
      nextCursor,
    });
  } catch (error: any) {
    console.error("Error fetching posts:", error);
    return res.status(500).json({
      status: false,
      msg: error.message,
    });
  }
};

/**
 * @Description get specific post
 * @Route POST /api/post/posts/:postId
 * @Access Private
 */
export const getPostById = async (req: Request, res: Response) => {
    const { id } = req.user;
    const { postId } = req.params;
    try {
        const post = await Post.findById(postId).lean();
        if (!post) {
            return res.status(404).json({
                status: false,
                msg: "Post not found",
            });
        }
        return res.status(200).json({
            status: true,
            msg: "Post fetched",
            post,
        });
    } catch (error: any) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @Description upadate post
 * @Route POST /api/post/update/:postId
 * @Access Private
 */
export const updatePost = async (req: Request, res: Response) => {
    const { id } = req.user;
    const { postId } = req.params;
    const payload = req.body;


    const result = updatePostSchema(payload);
    if (result.error) {
        const errors = result.error.details.map((detail) => detail.message);
        return res.status(400).json({
            status: false,
            msg: errors,
        });
    }
    try {
        const post = await Post.findById(postId).lean();
        if (!post) {
            return res.status(404).json({
                status: false,
                msg: "Post not found",
            });
        }
        const upadatedPost = await Post.findByIdAndUpdate(postId, payload, { new: true }).lean();
        return res.status(200).json({
            status: true,
            msg: "Post updated",
            post: upadatedPost,
        });
    } catch (error: any) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @Description delete post
 * @Route POST /api/post/delete/:postId
 * @Access Private
 */
export const deletePost = async (req: Request, res: Response) => {
    const { id } = req.user;
    const { postId } = req.params;
    try {
        const post = await Post.findById(postId).lean();
        if (!post) {
            return res.status(404).json({
                status: false,
                msg: "Post not found",
            });
        }
        await Post.findByIdAndDelete(postId);
        return res.status(200).json({
            status: true,
            msg: "Post deleted",
        });
    } catch (error: any) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};


/**
 * @Description get post analytics
 * @Route POST /api/post/analtics/:postId
 * @Access Private
 */
export const postAnalytics = async (req: Request, res: Response) => {
  const { id } = req.user as { id: string };
  const { postId } = req.params;

  try {
    // Fetch analytics for a specific post
    const analytics = await engagment.findOne({ postId, userId: id });

    if (!analytics) {
      return res.status(404).json({ message: "Analytics not found for this post." });
    }

    return res.status(200).json({ success: true, data: analytics });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};
