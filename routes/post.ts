//NPM Package
import express from "express";

//Controllers
import { create, getAllPosts, getPostById, updatePost, deletePost, postAnalytics } from "../controller/post";

//middleware
import { verifyUser } from '../middlewares/verifyUser'

const router = express.Router();

router.use(verifyUser)

router.post("/create", create);
router.get("/posts", getAllPosts);
router.get("/post/:postId", getPostById);
router.put("/update/:postId", updatePost);
router.delete("/delete/:postId", deletePost);
router.get("/analytics/:postId", postAnalytics)


export default router;