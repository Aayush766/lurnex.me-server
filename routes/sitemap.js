const express = require("express");
const router = express.Router();
const { SitemapStream, streamToPromise } = require("sitemap");
const Blog = require("../models/blogModel");

router.get("/sitemap.xml", async (req, res) => {
  try {
    const smStream = new SitemapStream({
      hostname: "https://lurnex.me",
    });

<<<<<<< HEAD
    // Public landing pages only; the assessment flow is intentionally excluded.
    const staticRoutes = [
      '/', '/about', '/blog', '/languages', '/online-tuition',
      ...['ib', 'igcse', 'ap', 'sat', 'cbse', 'neet', 'foundation', 'jee'].map((id) => `/courses/${id}`),
      ...['english', 'hindi', 'french'].map((id) => `/languages/${id}`),
      ...['oman', 'saudi-arabia', 'uae', 'bahrain', 'qatar', 'kuwait', 'india', 'singapore', 'usa', 'uk'].map((id) => `/online-tuition/${id}`),
    ];
    staticRoutes.forEach((url) => smStream.write({ url, changefreq: 'weekly', priority: url === '/' ? 1 : 0.8 }));

    // BLOG PAGES
    const blogs = await Blog.find({ status: 'published' }).select('slug updatedAt');
=======
    // STATIC PAGES
    smStream.write({
      url: "/",
      changefreq: "daily",
      priority: 1.0,
    });

    smStream.write({
      url: "/about",
      changefreq: "monthly",
      priority: 0.8,
    });

    smStream.write({
      url: "/blog",
      changefreq: "daily",
      priority: 0.9,
    });

    smStream.write({
      url: "/languages",
      changefreq: "weekly",
      priority: 0.8,
    });

    // BLOG PAGES
    const blogs = await Blog.find();
>>>>>>> df0a909acaa384d97f588a44aa8d8a80e4356e86

    blogs.forEach((blog) => {
      smStream.write({
        url: `/blog/${blog.slug}`,
        changefreq: "weekly",
        priority: 0.9,
        lastmod: blog.updatedAt,
      });
    });

    smStream.end();

    const sitemap = await streamToPromise(smStream);

    res.header("Content-Type", "application/xml");
    res.send(sitemap.toString());
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

<<<<<<< HEAD
module.exports = router;
=======
module.exports = router;
>>>>>>> df0a909acaa384d97f588a44aa8d8a80e4356e86
