const mongoose = require("mongoose");

const blockSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      "heading",
      "paragraph",
      "image",
      "list",
      "quote",
      "code",
      "button",
      "divider",
    ],
    required: true,
  },

  value: String,

  level: Number,

  items: [String],

  imageUrl: String,

  alt: String,

  buttonText: String,

  buttonLink: String,

  language: String,

  styles: {
    fontSize: String,
    color: String,
    backgroundColor: String,
    textAlign: String,
    fontWeight: String,
    padding: String,
    margin: String,
    borderRadius: String,
  },
});

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    slug: {
      type: String,
      unique: true,
    },

    excerpt: String,

    category: String,

    featuredImage: String,

    seoTitle: String,

    seoDescription: String,

    tags: [String],

    // KEEPING THIS AS contentBlocks TO PERFECTLY MATCH YOUR FRONTEND PAYLOAD
    contentBlocks: [blockSchema],

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
    },

    // Fixed author type definition to support Mongoose .populate() in your controller safely
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Ensure this matches your exact User model export name string
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Blog", blogSchema);