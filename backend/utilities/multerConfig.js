const multer = require('multer');


//File filter for allowed file types
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'video/mp4',
        'image/jpeg',
        'image/png'
    ];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'), false);
    }
};

// Memory storage instead of multer-s3
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: { fileSize: 1024 * 1024 * 50 }, // 50MB
});

module.exports = upload;
