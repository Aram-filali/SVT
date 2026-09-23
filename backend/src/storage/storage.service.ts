import { Injectable, InternalServerErrorException, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { randomUUID } from 'node:crypto';
import * as path from 'path';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Minio.Client;
  private readonly bucket: string;

  constructor(@Optional() private config?: ConfigService) {
    this.bucket = this.config?.get?.('MINIO_BUCKET_NAME', 'svt-resources') ?? 'svt-resources';
    const endpoint = this.config?.get?.('MINIO_ENDPOINT', 'localhost') ?? 'localhost';
    const portStr = this.config?.get?.('MINIO_PORT', '9000') ?? '9000';
    const port = parseInt(portStr, 10) || 9000;
    const useSSL = (this.config?.get?.('MINIO_USE_SSL', 'false') ?? 'false') === 'true';
    const accessKey = this.config?.get?.('MINIO_ACCESS_KEY', '') ?? '';
    const secretKey = this.config?.get?.('MINIO_SECRET_KEY', '') ?? '';

    this.client = new Minio.Client({
      endPoint: endpoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'eu-west-1');
        this.logger.log(`Bucket "${this.bucket}" created.`);
      } else {
        this.logger.log(`Bucket "${this.bucket}" already exists.`);
      }
    } catch (err) {
      this.logger.error(`Failed to initialize MinIO bucket: ${String(err)}`);
      // Don't crash the app if MinIO is unavailable (e.g. test env)
    }
  }

  /**
   * Upload a file buffer to MinIO.
   * Returns the generated storageKey.
   */
  async uploadFile(
    fileBuffer: Buffer,
    originalFilename: string,
    mimeType: string,
  ): Promise<string> {
    const ext = path.extname(originalFilename);
    const storageKey = `${randomUUID()}${ext}`;

    try {
      await this.client.putObject(
        this.bucket,
        storageKey,
        fileBuffer,
        fileBuffer.length,
        { 'Content-Type': mimeType },
      );
      return storageKey;
    } catch (err) {
      this.logger.error(`MinIO upload error: ${String(err)}`);
      throw new InternalServerErrorException('Failed to upload file to storage');
    }
  }

  /**
   * Get a readable stream for a file from MinIO.
   */
  async getFileStream(storageKey: string) {
    try {
      return await this.client.getObject(this.bucket, storageKey);
    } catch (err) {
      this.logger.error(`MinIO getObject error for key "${storageKey}": ${String(err)}`);
      throw new InternalServerErrorException('Failed to retrieve file from storage');
    }
  }

  /**
   * Get file metadata/stat from MinIO.
   */
  async getFileStat(storageKey: string) {
    try {
      return await this.client.statObject(this.bucket, storageKey);
    } catch (err) {
      this.logger.error(`MinIO statObject error for key "${storageKey}": ${String(err)}`);
      throw new InternalServerErrorException('Failed to retrieve file metadata from storage');
    }
  }

  /**
   * Delete a file from MinIO (soft-delete does not call this, but available).
   */
  async deleteFile(storageKey: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, storageKey);
    } catch (err) {
      this.logger.error(`MinIO removeObject error for key "${storageKey}": ${String(err)}`);
    }
  }
}