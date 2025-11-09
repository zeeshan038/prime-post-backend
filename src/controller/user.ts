// NPM Package
import { Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import bcrypt from "bcrypt";

// Models
import User from "../models/user";

// Schema
import { loginSchema, registerSchema } from "../schema/User";

// Utils
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";

/**
 * @Description Register a new user
 * @Route POST /api/user/register
 * @Access Public
 */
export const registerUser = async (req: Request, res: Response) => {
  const payload = req.body;

  // Error Handling
  const result = registerSchema(payload);
  if (result.error) {
    const errors = result.error.details.map((detail) => detail.message);
    return res.status(400).json({
      status: false,
      msg: errors,
    });
  }

  try {
    const userExists = await User.findOne({ email: payload.email });
    if (userExists) {
      return res
        .status(400)
        .json({ msg: "User already exists", status: false });
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(payload.password, salt);

    // Create User
    const user = await User.create({ ...payload, password: hash });

    // Generate tokens
    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    // Save refresh token in user document
    user.refreshToken = refreshToken;
    await user.save();

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Response
    return res.status(200).json({
      status: true,
      msg: "Account Created",
      id: user._id,
      token: accessToken,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ status: false, msg: "Internal Server Error" });
  }
};

/**
 * @Description Login a user
 * @Route POST /api/user/login
 * @Access Public
 */
export const loginUser = async (req: Request, res: Response) => {
  const payload = req.body;

  // Error Handling
  const result = loginSchema(payload);
  if (result.error) {
    const errors = result.error.details.map((detail) => detail.message);
    return res.status(400).json({
      status: false,
      msg: errors,
    });
  }

  try {
    const user = await User.findOne({ email: payload.email }).select(
      "+password"
    );
    if (!user || !user.password) {
      return res
        .status(400)
        .json({ msg: "Invalid credentials", status: false });
    }

    const isMatch = await bcrypt.compare(payload.password, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ msg: "Invalid credentials", status: false });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    // Save refresh token in user document
    user.refreshToken = refreshToken;
    await user.save();

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    // Response
    return res.status(200).json({
      status: true,
      msg: "Login successful",
      id: user._id,
      token: accessToken,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ status: false, msg: "Internal Server Error" });
  }
};

/**
 * @Description refresh token
 * @Route POST /api/user/refresh-token
 * @Access Public
 */
export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return res.status(401).json({
      status: false,
      msg: "No refresh token provided",
    });
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET!
    ) as JwtPayload;

    // Find user with the refresh token
    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({
        status: false,
        msg: "Invalid refresh token",
      });
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(user._id.toString());
    const newRefreshToken = generateRefreshToken(user._id.toString());

    // Update refresh token in database
    user.refreshToken = newRefreshToken;
    await user.save();

    // Set new refresh token in HTTP-only cookie
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.json({
      status: true,
      accessToken: newAccessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        status: false,
        msg: "Refresh token expired",
      });
    }
    return res.status(403).json({
      status: false,
      msg: "Invalid refresh token",
    });
  }
};

/**
 * @Description logout
 * @Route POST /api/user/logout
 * @Access Private
 */
export const logout = async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;
  try {
    if (!refreshToken) {
      return res.status(400).json({
        status: false,
        msg: "No refresh token found",
      });
    }

    // Clear cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      sameSite: "strict",
    });

    return res.status(200).json({
      status: true,
      msg: "Logged out successfully",
    });
  } catch (error: any) {
    console.error("Logout error:", error);
    return res.status(500).json({
      status: false,
      msg: "Something went wrong",
    });
  }
};
