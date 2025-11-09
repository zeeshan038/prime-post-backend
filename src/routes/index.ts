//NPM Package
import express from "express";
const router = express.Router();

//paths
import user from './user';
import post from './post';
import analytics from './analytics';

router.use('/user',user);
router.use('/post',post);
router.use('/analytics',analytics);


export default router;