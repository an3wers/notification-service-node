import multer from "multer";
import { config } from "./env.ts";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

// create upload directory if it doesn't exist
if (!fs.existsSync(config.storage.uploadDir)) {
  fs.mkdirSync(config.storage.uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.storage.uploadDir);
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
