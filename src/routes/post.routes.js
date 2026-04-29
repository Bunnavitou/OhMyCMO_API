import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  listPostsSchema,
  getPostSchema,
  createPostSchema,
  updatePostSchema,
  deletePostSchema,
} from '../validators/post.validator.js';
import {
  listPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
} from '../controllers/post.controller.js';

const router = Router();

// Public reads, authed writes.
router.get('/', validate(listPostsSchema), asyncHandler(listPosts));
router.get('/:id', validate(getPostSchema), asyncHandler(getPost));

router.post('/', requireAuth, validate(createPostSchema), asyncHandler(createPost));
router.patch('/:id', requireAuth, validate(updatePostSchema), asyncHandler(updatePost));
router.delete('/:id', requireAuth, validate(deletePostSchema), asyncHandler(deletePost));

export default router;
