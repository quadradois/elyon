import { S3Client } from '@aws-sdk/client-s3';

/**
 * Instância singleton do S3Client
 * Reutilizar em vez de criar uma instância por arquivo
 */
export const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});
