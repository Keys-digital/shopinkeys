const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");

// Initialize S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "shopinkeys-avatars";

/**
 * Upload file to S3
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - Original file name
 * @param {string} mimeType - File MIME type
 * @returns {Promise<string>} - S3 file URL
 */
const uploadToS3 = async (fileBuffer, fileName, mimeType) => {
    const fileExtension = fileName.split(".").pop();
    const uniqueFileName = `avatars/${crypto.randomBytes(16).toString("hex")}.${fileExtension}`;

    const params = {
        Bucket: BUCKET_NAME,
        Key: uniqueFileName,
        Body: fileBuffer,
        ContentType: mimeType,
        ACL: "public-read", // Make file publicly accessible
    };

    try {
        await s3Client.send(new PutObjectCommand(params));
        return `https://${BUCKET_NAME}.s3.amazonaws.com/${uniqueFileName}`;
    } catch (error) {
        console.error("S3 Upload Error:", error);
        throw new Error("Failed to upload file to S3");
    }
};

/**
 * Delete file from S3
 * @param {string} fileUrl - S3 file URL
 */
const deleteFromS3 = async (fileUrl) => {
    try {
        // Extract key from URL
        const key = fileUrl.split(".com/")[1];
        if (!key) return;

        const params = {
            Bucket: BUCKET_NAME,
            Key: key,
        };

        await s3Client.send(new DeleteObjectCommand(params));
    } catch (error) {
        console.error("S3 Delete Error:", error);
        // Don't throw - deletion failure shouldn't block profile update
    }
};

module.exports = {
    uploadToS3,
    deleteFromS3,
};
