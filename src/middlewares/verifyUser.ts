import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any; 
    }
  }
}

export const verifyUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get Authorization header safely
    const authHeader = req.headers["authorization"] as string | undefined;

    if (!authHeader || !authHeader.startsWith("Bearer")) {
      return res.status(401).json({ status: false, msg: "Not authorized, no token" });
    }

    const token = authHeader.split(" ")[1].trim();

    // Verify token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as any;

    // Attach user to request
    req.user = await User.findById(decoded.userId).select("-password");

    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ status: false, msg: "Not authorized, token failed" });
  }
};
