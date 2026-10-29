import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { cloudinary } from "../config/cloudinary.js";

const makePublicId = (prefix = "file") =>
  `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "rebot/images",
    resource_type: "image",
    public_id: makePublicId("img"),
  }),
});

const certificateStorage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "rebot/certificates",
    resource_type: "auto",
    public_id: makePublicId("cert"),
  }),
});

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image files are allowed!"), false);
  }
  cb(null, true);
};

const certificateFileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error("Only PDF, JPG, and PNG files are allowed!"), false);
  }

  cb(null, true);
};

const upload = multer({
  storage: imageStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadImage = upload.array("images", 5); // 'images' is the field name in the form data
export default uploadImage;

const uploadAnyFile = multer({
  storage: certificateStorage,
  fileFilter: certificateFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});
export const uploadCertificateFile = uploadAnyFile.single("uploadDocument");
