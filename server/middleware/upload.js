import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Strict allowlists
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm', '.mov', '.avi']);
const ALLOWED_MIMETYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
]);

// Configure storage with cryptographically random filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomUUID();
    cb(null, uniqueSuffix + path.extname(file.originalname).toLowerCase());
  }
});

// Strict file filter — check both extension and mimetype against exact allowlists
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = ALLOWED_MIMETYPES.has(file.mimetype);
  const extOk = ALLOWED_EXTENSIONS.has(ext);

  if (extOk && mimeOk) {
    cb(null, true);
  } else {
    cb(new Error('Only images (jpg, png, gif) and videos (mp4, webm, mov, avi) are allowed'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit (reduced from 100MB)
  },
  fileFilter
});

export default upload;
