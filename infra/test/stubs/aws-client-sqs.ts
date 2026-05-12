/// <reference types="jest" />

export class SQSClient {
  static lastInstance: SQSClient;
  public sendMock = jest.fn(async (_command: unknown) => ({
    Successful: [] as { Id: string; MessageId?: string }[],
    Failed: [] as { Id: string; Code?: string; Message?: string }[],
  }));
  constructor(options?: unknown) {
    void options;
    SQSClient.lastInstance = this;
  }
  send(command: unknown) {
    return this.sendMock(command);
  }
}

export class SendMessageBatchCommand {
  constructor(readonly input: Record<string, unknown>) {}
}

export class SendMessageCommand {
  constructor(readonly input: Record<string, unknown>) {}
}
