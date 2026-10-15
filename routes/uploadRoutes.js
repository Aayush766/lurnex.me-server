
const express = require("express");

const router = express.Router();

const multer = require("../middleware/uploadMiddleware");

const cloudinary = require("../config/cloudinary");

router.post(
  "/",
  multer.single("image"),
  async (req, res) => {
    try {

      if (!req.file) {
        return res.status(400).json({
          message: "No image uploaded",
        });
      }

      const b64 = Buffer.from(req.file.buffer).toString("base64");

      const dataURI =
        `data:${req.file.mimetype};base64,${b64}`;

      const result = await cloudinary.uploader.upload(
        dataURI,
        {
          folder: "lurnex-blog",
        }
      );

      res.json({
        url: result.secure_url,
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        message: "Image upload failed",
      });
    }
  }
);

module.exports = router;

