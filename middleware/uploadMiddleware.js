const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
<<<<<<< HEAD
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(new Error('Only JPEG, PNG, or WebP images are allowed.'));
    callback(null, true);
  },
});

module.exports = upload;
=======
});

module.exports = upload;
>>>>>>> df0a909acaa384d97f588a44aa8d8a80e4356e86
