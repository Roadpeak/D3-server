// services/cloudflareR2Service.js - Cloudflare R2 Storage Service
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');

class CloudflareR2Service {
    constructor() {
        // Initialize S3 client for Cloudflare R2
        this.s3Client = new S3Client({
            region: 'auto', // Cloudflare R2 uses 'auto' for region
            endpoint: process.env.R2_ENDPOINT, // Your R2 endpoint: https://<account-id>.r2.cloudflarestorage.com
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            },
        });

        this.bucketName = process.env.R2_BUCKET_NAME || 'discoun3ree-reels';
        this.publicUrl = process.env.R2_PUBLIC_URL; // Your custom domain or R2.dev URL
    }

    /**
     * Generate unique filename
     */
    generateFileName(originalName, type = 'video') {
        const ext = path.extname(originalName);
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString('hex');
        return `reels/${type}/${timestamp}-${randomString}${ext}`;
    }

    /**
     * Upload video to R2
     */
    async uploadVideo(file) {
        try {
            const fileName = this.generateFileName(file.originalname, 'video');

            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: fileName,
                Body: file.buffer,
                ContentType: file.mimetype,
                Metadata: {
                    originalName: file.originalname,
                    uploadedAt: new Date().toISOString()
                }
            });

            await this.s3Client.send(command);

            // Return public URL
            const url = this.publicUrl
                ? `${this.publicUrl}/${fileName}`
                : `https://${this.bucketName}.r2.dev/${fileName}`;

            return {
                success: true,
                url: url,
                key: fileName,
                size: file.size
            };
        } catch (error) {
            console.error('Error uploading video to R2:', error);
            throw new Error('Failed to upload video');
        }
    }

    /**
     * Upload thumbnail to R2
     */
    async uploadThumbnail(file) {
        try {
            const fileName = this.generateFileName(file.originalname, 'thumbnail');

            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: fileName,
                Body: file.buffer,
                ContentType: file.mimetype,
                Metadata: {
                    originalName: file.originalname,
                    uploadedAt: new Date().toISOString()
                }
            });

            await this.s3Client.send(command);

            const url = this.publicUrl
                ? `${this.publicUrl}/${fileName}`
                : `https://${this.bucketName}.r2.dev/${fileName}`;

            return {
                success: true,
                url: url,
                key: fileName,
                size: file.size
            };
        } catch (error) {
            console.error('Error uploading thumbnail to R2:', error);
            throw new Error('Failed to upload thumbnail');
        }
    }

    /**
     * Delete file from R2
     */
    async deleteFile(fileUrl) {
        try {
            // Extract key from URL
            const key = this.extractKeyFromUrl(fileUrl);

            if (!key) {
                console.warn('Could not extract key from URL:', fileUrl);
                return { success: false, message: 'Invalid file URL' };
            }

            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });

            await this.s3Client.send(command);

            return { success: true, message: 'File deleted successfully' };
        } catch (error) {
            console.error('Error deleting file from R2:', error);
            throw new Error('Failed to delete file');
        }
    }

    /**
     * Extract key from URL
     */
    extractKeyFromUrl(url) {
        try {
            // Handle both custom domain and R2.dev URLs
            if (this.publicUrl && url.startsWith(this.publicUrl)) {
                return url.replace(`${this.publicUrl}/`, '');
            }

            if (url.includes('.r2.dev/')) {
                return url.split('.r2.dev/')[1];
            }

            // If URL is just the key
            if (url.startsWith('reels/')) {
                return url;
            }

            return null;
        } catch (error) {
            console.error('Error extracting key from URL:', error);
            return null;
        }
    }

    /**
     * Generate presigned URL for temporary access (optional)
     */
    async getPresignedUrl(key, expiresIn = 3600) {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });

            const url = await getSignedUrl(this.s3Client, command, { expiresIn });
            return url;
        } catch (error) {
            console.error('Error generating presigned URL:', error);
            throw new Error('Failed to generate presigned URL');
        }
    }

    /**
     * Get file metadata
     */
    async getFileMetadata(key) {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });

            const response = await this.s3Client.send(command);

            return {
                size: response.ContentLength,
                contentType: response.ContentType,
                lastModified: response.LastModified,
                metadata: response.Metadata
            };
        } catch (error) {
            console.error('Error getting file metadata:', error);
            throw new Error('Failed to get file metadata');
        }
    }

    /**
     * Validate video file
     */
    validateVideoFile(file) {
        const maxSize = 100 * 1024 * 1024; // 100MB
        const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm'];

        if (!allowedTypes.includes(file.mimetype)) {
            return {
                valid: false,
                error: 'Invalid file type. Only MP4, MOV, and WebM are allowed.'
            };
        }

        if (file.size > maxSize) {
            return {
                valid: false,
                error: 'File too large. Maximum size is 100MB.'
            };
        }

        return { valid: true };
    }

    /**
     * Validate thumbnail file
     */
    validateThumbnailFile(file) {
        const maxSize = 5 * 1024 * 1024; // 5MB
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

        if (!allowedTypes.includes(file.mimetype)) {
            return {
                valid: false,
                error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.'
            };
        }

        if (file.size > maxSize) {
            return {
                valid: false,
                error: 'File too large. Maximum size is 5MB.'
            };
        }

        return { valid: true };
    }
}

module.exports = new CloudflareR2Service();