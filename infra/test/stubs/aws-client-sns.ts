/// <reference types="jest" />

export class SNSClient {
  static lastInstance: SNSClient;
  public sendMock = jest.fn(async (_command: unknown) => ({
    MessageId: "fake-message-id",
  }));
  constructor(options?: unknown) {
    void options;
    SNSClient.lastInstance = this;
  }
  send(command: unknown) {
    return this.sendMock(command);
  }
}

export class PublishCommand {
  constructor(readonly input: Record<string, unknown>) {}
}
