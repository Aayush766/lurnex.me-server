const express = require("express");
const router = express.Router();
const { SitemapStream, streamToPromise } = require("sitemap");
const Blog = require("../models/blogModel");

router.get("/sitemap.xml", async (req, res) => {
  try {
    const smStream = new SitemapStream({
      hostname: "https://lurnex.me",
    });

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

module.exports = router;