/**
 * Test stub for `@aws-sdk/lib-dynamodb`.
 * Real SDK v3 pulls ESM-only deps Jest cannot load; handlers are tested with `aws-sdk-client-mock`
 * against this stub (`mockClient(DynamoDBDocumentClient)` matches the same class `dynamodb.ts` uses).
 */
import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export class ScanCommand {
  constructor(readonly input: Record<string, unknown>) {}
}

export class GetCommand {
  constructor(readonly input: Record<string, unknown>) {}
}

export class DynamoDBDocumentClient {
  send(_command: unknown): Promise<unknown> {
    return Promise.resolve({});
  }

  static from(_client: DynamoDBClient): DynamoDBDocumentClient {
    return new DynamoDBDocumentClient();
  }
}
