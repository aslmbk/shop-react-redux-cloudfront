/**
 * Test stub for `@aws-sdk/lib-dynamodb`.
 * The real SDK v3 pulls ESM-only dependencies that Jest does not load well, so tests map `@aws-sdk/*`
 * here. Handlers import the same symbols as production (`ScanCommand`, `GetCommand`,
 * `TransactWriteCommand`, `DynamoDBDocumentClient`); unit tests then use `aws-sdk-client-mock`'s
 * `mockClient(DynamoDBDocumentClient)` and `.on(SomeCommand)` / `.commandCalls(SomeCommand)` against
 * these classes (see `get-products-*.test.ts`, `create-product.test.ts`).
 */
import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export class ScanCommand {
  constructor(readonly input: Record<string, unknown>) {}
}

export class GetCommand {
  constructor(readonly input: Record<string, unknown>) {}
}

export class TransactWriteCommand {
  constructor(readonly input: { TransactItems?: Record<string, unknown>[] }) {}
}

export class DynamoDBDocumentClient {
  send(_command: unknown): Promise<unknown> {
    return Promise.resolve({});
  }

  static from(_client: DynamoDBClient): DynamoDBDocumentClient {
    return new DynamoDBDocumentClient();
  }
}
