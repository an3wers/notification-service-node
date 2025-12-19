import multer from "multer";
import { config } from "./env.ts";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

const uploadDir = path.resolve(config.storage.uploadDir);

// create upload directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  // TODO: add validation for file name
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: config.storage.maxFileSize,
  },
});
