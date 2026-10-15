const express = require('express');

const router = express.Router();

const {
  createBlog,
  getBlogs,
  getBlogBySlug,
  deleteBlog,
  updateBlog,
  generateAIBlog
} = require('../controllers/blogController');

const {
  protect,
  admin,
} = require('../middleware/authMiddleware');


// PUBLIC
router.get('/', getBlogs);

router.get('/:slug', getBlogBySlug);


// ADMIN
router.post(
  '/',
  protect,
  admin,
  createBlog
);

router.put(
  '/:id',
  protect,
  admin,
  updateBlog
);

router.delete(
  '/:id',
  protect,
  admin,
  deleteBlog
);

router.post(
  "/generate",
  protect,
  admin,
  generateAIBlog
);

module.exports = router;