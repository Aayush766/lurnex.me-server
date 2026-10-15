const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');
const pages = require('../controllers/pageController');

const router = express.Router();

// Public route must precede /:id so "by-source" is never treated as an id.
router.get('/by-source', pages.getPublishedPageBySource);

router.use(protect, admin);
router.post('/', pages.createPage);
router.get('/', pages.getPages);
router.get('/:id', pages.getPage);
router.patch('/:id', pages.updatePage);
router.delete('/:id', pages.deletePage);
router.patch('/:id/publish', pages.publishPage);
router.patch('/:id/unpublish', pages.unpublishPage);

module.exports = router;
