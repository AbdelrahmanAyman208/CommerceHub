const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { env } = require('../config/env');

const pdfDir = path.join(env.UPLOAD_DIR, 'pdfs');
if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, pdfDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    cb(null, `lecture-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed!'), false);
  }
};

const uploadPdf = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE },
  fileFilter,
});

module.exports = {
  uploadPdf,
  pdfDir,
};
