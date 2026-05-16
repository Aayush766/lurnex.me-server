const Blog = require('../models/blogModel');
const slugify = require('slugify');
const gemini = require("../config/gemini");

// CREATE BLOG
const createBlog = async (req, res) => {
  try {
    const {
      title,
      excerpt,
      contentBlocks, // FIX: Renamed from 'blocks' to match frontend payload
      category,
      featuredImage,
      seoTitle,
      seoDescription,
      tags, // Captured from frontend
    } = req.body;

    // Guard fallback if contentBlocks isn't passed safely
    const activeBlocks = contentBlocks || [];

    const slug = slugify(title, {
      lower: true,
      strict: true,
    });

    const existingBlog = await Blog.findOne({ slug });

    if (existingBlog) {
      return res.status(400).json({
        message: 'Blog already exists',
      });
    }

    // Safely calculate read time using the corrected variable name
    const readTime = `${Math.ceil(
      JSON.stringify(activeBlocks).split(' ').length / 200
    )} min read`;

    const blog = await Blog.create({
      title,
      slug,
      excerpt,
      contentBlocks: activeBlocks, // Maps 'contentBlocks' from req.body to the 'blocks' schema array
      category,
      featuredImage,
      seoTitle,
      seoDescription,
      tags, // FIX: Added tags to database document instance registration
      readTime,
      author: req.user._id,
    });

    res.status(201).json(blog);

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// GET ALL BLOGS
const getBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find()
      .populate('author', 'name email')
      .sort({ createdAt: -1 });

    res.json(blogs);

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// GET SINGLE BLOG
const getBlogBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOne({
      slug: req.params.slug,
    }).populate('author', 'name email'); // Tip: Added populate here too for complete UI visibility

    if (!blog) {
      return res.status(404).json({
        message: 'Blog not found',
      });
    }

    res.json(blog);

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// DELETE BLOG
const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        message: 'Blog not found',
      });
    }

    await blog.deleteOne();

    res.json({
      message: 'Blog deleted successfully',
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// UPDATE BLOG
const updateBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        message: 'Blog not found',
      });
    }

    // Handles slug update dynamically if title is changed during modification
    if (req.body.title && req.body.title !== blog.title) {
      req.body.slug = slugify(req.body.title, { lower: true, strict: true });
    }

    // Fix payload mapping for updates too if contentBlocks is provided
    if (req.body.contentBlocks) {
  blog.contentBlocks = req.body.contentBlocks;
}

    Object.assign(blog, req.body);
    const updatedBlog = await blog.save();

    res.json(updatedBlog);

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};


const generateAIBlog = async (req, res) => {
  try {

    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        message: "Prompt is required",
      });
    }

    const fullPrompt = `
You are an elite SEO blog writer.

Return ONLY valid JSON.

Structure:

{
  "title": "",
  "excerpt": "",
  "category": "",
  "seoTitle": "",
  "seoDescription": "",
  "tags": [],
  "contentBlocks": []
}

Allowed block types:

Heading:
{
  "type":"heading",
  "value":"Heading",
  "level":2
}

Paragraph:
{
  "type":"paragraph",
  "value":"Paragraph content"
}

Quote:
{
  "type":"quote",
  "value":"Quote content"
}

List:
{
  "type":"list",
  "items":["point1","point2"]
}

IMPORTANT:
- Generate long SEO optimized content
- Use multiple headings
- Use multiple paragraphs
- Use readable structure
- No markdown
- No HTML
- Return valid JSON only

USER REQUEST:
${prompt}
`;

    const result =
      await gemini.generateContent(fullPrompt);

    const response =
      await result.response;

    const text =
      response.text();

    const cleaned =
      text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    const parsed =
      JSON.parse(cleaned);

    res.json(parsed);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: error.message,
    });
  }
};



module.exports = {
  createBlog,
  getBlogs,
  getBlogBySlug,
  deleteBlog,
  updateBlog,
  generateAIBlog,
};