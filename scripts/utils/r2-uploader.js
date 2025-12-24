/**
 * R2 Uploader - Handles file uploads to Cloudflare R2
 * Uses AWS S3 SDK with custom endpoint
 */

const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

class R2Uploader {
  constructor(config) {
    this.client = new S3Client({
      region: config.region || 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
      signatureVersion: 'v4',
    });
    this.bucket = config.bucket;
    this.endpoint = config.endpoint;
    this.publicUrl = config.publicUrl; // Custom domain for public access
  }

  /**
   * Upload file buffer to R2
   * @param {Object} params - Upload parameters
   * @param {Buffer} params.buffer - File buffer
   * @param {string} params.key - File key (path in bucket)
   * @param {string} params.contentType - MIME type
   * @returns {Promise<string>} - Public URL of uploaded file
   */
  async upload({ buffer, key, contentType }) {
    try {
      // For large files, use multipart upload
      if (buffer.length > 5 * 1024 * 1024) {
        return await this.multipartUpload({ buffer, key, contentType });
      }

      // For small files, use simple put
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      await this.client.send(command);

      // Construct public URL
      return this.getPublicUrl(key);
    } catch (error) {
      throw new Error(`Failed to upload to R2: ${error.message}`);
    }
  }

  /**
   * Multipart upload for large files
   */
  async multipartUpload({ buffer, key, contentType }) {
    try {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        },
        partSize: 5 * 1024 * 1024, // 5MB chunks
        queueSize: 4, // 4 concurrent uploads
      });

      await upload.done();

      return this.getPublicUrl(key);
    } catch (error) {
      throw new Error(`Failed multipart upload to R2: ${error.message}`);
    }
  }

  /**
   * Check if file exists in R2
   * @param {string} key - File key
   * @returns {Promise<boolean>}
   */
  async fileExists(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get public URL for a file
   * @param {string} key - File key
   * @returns {string} - Public URL
   */
  getPublicUrl(key) {
    // Use custom domain if configured, otherwise fall back to R2 URL
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }
    // Fallback to R2 public URL format
    const accountId = this.extractAccountId();
    return `https://${this.bucket}.${accountId}.r2.cloudflarestorage.com/${key}`;
  }

  /**
   * Extract account ID from endpoint
   */
  extractAccountId() {
    // Endpoint format: https://{accountId}.r2.cloudflarestorage.com
    const match = this.endpoint.match(/https:\/\/([^.]+)\.r2\.cloudflarestorage\.com/);
    if (match) {
      return match[1];
    }
    throw new Error('Invalid R2 endpoint format');
  }

  /**
   * Create uploader from environment variables
   */
  static fromEnv(env) {
    return new R2Uploader({
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_ACCESS_SECRET,
      region: env.AWS_REGION || 'auto',
      bucket: env.AWS_BUCKET,
      endpoint: env.AWS_ENDPOINT,
      publicUrl: env.R2_PUBLIC_URL, // Custom domain, e.g., https://cdn.z-image.ai
    });
  }
}

module.exports = R2Uploader;
