/**
 * Test stub for `@aws-sdk/client-s3`.
 * Jest cannot load the real SDK v3 (transitive ESM); tests map `@aws-sdk/client-s3`
 * to this file. Handlers import the same symbols as production; the import-products-file
 * Lambda only uses `S3Client` as the first arg to `getSignedUrl`, so its `send` is
 * irrelevant for tests — the presigner stub is what tests configure.
 */
export class S3Client {
  constructor(options?: unknown) {
    void options;
  }
  send(_command: unknown): Promise<unknown> {
    return Promise.resolve({});
  }
}

export class PutObjectCommand {
  constructor(readonly input: Record<string, unknown>) {}
}

export class GetObjectCommand {
  constructor(readonly input: Record<string, unknown>) {}
}

export class CopyObjectCommand {
  constructor(readonly input: Record<string, unknown>) {}
}

export class DeleteObjectCommand {
  constructor(readonly input: Record<string, unknown>) {}
}
