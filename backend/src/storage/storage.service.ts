import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { randomUUID } from 'node:crypto';
import * as path from 'path';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Minio.Client;
  private readonly bucket: string;

  constructor(private config: ConfigService) {
    this.bucket = this.config.get<string>('MINIO_BUCKET_NAME', 'svt-resources');
    this.client = new Minio.Client({
      endPoint: this.config.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(this.config.get<string>('MINIO_PORT', '9000'), 10),
      useSSL: this.config.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY', ''),
      secretKey: this.config.get<string>('MINIO_SECRET_KEY', ''),
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
   * Returns a unique storage key (object name).
   */
  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<string> {
    const ext = path.extname(originalName);
    const storageKey = `${randomUUID()}${ext}`;
    try {
      await this.client.putObject(this.bucket, storageKey, buffer, buffer.length, {
        'Content-Type': mimeType,
      });
      return storageKey;
    } catch (err) {
      this.logger.error(`Failed to upload file: ${String(err)}`);
      throw new InternalServerErrorException('File upload failed');
    }
  }

  /**
   * Get a readable stream for a stored object.
   */
  async getFileStream(storageKey: string): Promise<NodeJS.ReadableStream> {
    try {
      return await this.client.getObject(this.bucket, storageKey);
    } catch (err) {
      this.logger.error(`Failed to get file: ${String(err)}`);
      throw new InternalServerErrorException('File retrieval failed');
    }
  }

  /**
   * Get the stat (size, content-type) of a stored object.
   */
  async getFileStat(storageKey: string): Promise<Minio.BucketItemStat> {
    try {
      return await this.client.statObject(this.bucket, storageKey);
    } catch (err) {
      this.logger.error(`Failed to stat file: ${String(err)}`);
      throw new InternalServerErrorException('File stat failed');
    }
  }

  /**
   * Delete a stored object (internal use only, not exposed via API).
   */
  async deleteFile(storageKey: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, storageKey);
    } catch (err) {
      this.logger.error(`Failed to delete file: ${String(err)}`);
      throw new InternalServerErrorException('File deletion failed');
    }
  }
}
