/* eslint-disable @typescript-eslint/no-empty-function */
import type { SQSEvent } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { main } from "../lib/product-service/catalog-batch-process";

jest.mock("uuid", () => ({ v4: () => "fixed-uuid-v4" }));

const ddbMock = mockClient(DynamoDBDocumentClient);

function getSnsTestClient() {
  const C = SNSClient as unknown as typeof SNSClient & {
    lastInstance: SNSClient & { sendMock: jest.Mock };
  };
  return C.lastInstance;
}

beforeEach(() => {
  ddbMock.reset();
  process.env.PRODUCTS_TABLE_NAME = "products";
  process.env.STOCK_TABLE_NAME = "stock";
  process.env.CREATE_PRODUCT_TOPIC_ARN =
    "arn:aws:sns:us-east-1:123456789012:createProductTopic";
  const sns = getSnsTestClient();
  sns.sendMock.mockReset();
  sns.sendMock.mockResolvedValue({ MessageId: "mid" });
});

const sqsEvent = (bodies: unknown[]): SQSEvent =>
  ({
    Records: bodies.map((b, i) => ({
      messageId: `m-${i}`,
      receiptHandle: "",
      body: typeof b === "string" ? b : JSON.stringify(b),
      attributes: {} as never,
      messageAttributes: {},
      md5OfBody: "",
      eventSource: "aws:sqs",
      eventSourceARN: "",
      awsRegion: "us-east-1",
    })),
  } as SQSEvent);

test("happy path: 5 valid messages → 5 TransactWrite, no failures", async () => {
  ddbMock.on(TransactWriteCommand).resolves({});

  const bodies = Array.from({ length: 5 }, (_, i) => ({
    title: `P${i}`,
    price: 10 + i,
    count: 1,
  }));
  const res = await main(sqsEvent(bodies));

  expect(res.batchItemFailures).toEqual([]);
  expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(5);
});

test("partial batch: 2 invalid, 3 valid → 3 TransactWrite, 2 failures", async () => {
  ddbMock.on(TransactWriteCommand).resolves({});

  const event = sqsEvent([
    "not-json",
    { title: "Bad", price: 0 },
    { title: "G1", price: 1 },
    { title: "G2", price: 2 },
    { title: "G3", price: 3 },
  ]);

  const res = await main(event);

  expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(3);
  expect(res.batchItemFailures).toEqual([
    { itemIdentifier: "m-0" },
    { itemIdentifier: "m-1" },
  ]);
});

test("DynamoDB error → that messageId in batchItemFailures", async () => {
  ddbMock.on(TransactWriteCommand).rejects(new Error("ddb down"));

  const res = await main(sqsEvent([{ title: "T", price: 10, count: 1 }]));

  expect(res.batchItemFailures).toEqual([{ itemIdentifier: "m-0" }]);
  expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(1);
});

test("empty Records → no TransactWrite, empty failures", async () => {
  const res = await main({ Records: [] } as SQSEvent);

  expect(res.batchItemFailures).toEqual([]);
  expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
});

test("TransactWrite has products + stock Puts with env table names", async () => {
  ddbMock.on(TransactWriteCommand).resolves({});

  await main(sqsEvent([{ title: "T", price: 10, count: 7 }]));

  const calls = ddbMock.commandCalls(TransactWriteCommand);
  expect(calls).toHaveLength(1);
  const first = calls[0];
  expect(first).toBeDefined();
  const cmd = first.args[0] as { input?: { TransactItems?: unknown[] } };
  const items = cmd.input?.TransactItems ?? [];
  expect(items).toHaveLength(2);
  expect(items[0]).toEqual({
    Put: {
      TableName: "products",
      Item: { id: "fixed-uuid-v4", title: "T", description: "", price: 10 },
    },
  });
  expect(items[1]).toEqual({
    Put: {
      TableName: "stock",
      Item: { product_id: "fixed-uuid-v4", count: 7 },
    },
  });
});

test("publish per product: 3 valid messages → 3 DDB then 3 SNS in order", async () => {
  const order: string[] = [];
  ddbMock.on(TransactWriteCommand).callsFake(async () => {
    order.push("ddb");
    return {};
  });
  const sns = getSnsTestClient();
  sns.sendMock.mockImplementation(async (command: unknown) => {
    if (command instanceof PublishCommand) {
      order.push("sns");
    }
    return { MessageId: "mid" };
  });

  const bodies = [
    { title: "A", price: 1, count: 0 },
    { title: "B", price: 2, count: 1 },
    { title: "C", price: 3, count: 2 },
  ];
  const res = await main(sqsEvent(bodies));

  expect(res.batchItemFailures).toEqual([]);
  expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(3);
  expect(
    sns.sendMock.mock.calls
      .map((c) => c[0])
      .filter((c) => c instanceof PublishCommand),
  ).toHaveLength(3);
  expect(order).toEqual(["ddb", "sns", "ddb", "sns", "ddb", "sns"]);
});

test("MessageAttributes.price uses Number type and string value", async () => {
  ddbMock.on(TransactWriteCommand).resolves({});

  await main(sqsEvent([{ title: "Lux", price: 150, count: 1 }]));

  const sns = getSnsTestClient();
  const pub = sns.sendMock.mock.calls
    .map((c) => c[0])
    .find(
      (c): c is InstanceType<typeof PublishCommand> =>
        c instanceof PublishCommand,
    );
  expect(pub).toBeDefined();
  const attrs = (pub?.input.MessageAttributes ?? {}) as Record<
    string,
    { DataType?: string; StringValue?: string }
  >;
  expect(attrs.price).toEqual({
    DataType: "Number",
    StringValue: "150",
  });
});

test("SNS error after successful DDB does not add batchItemFailures", async () => {
  ddbMock.on(TransactWriteCommand).resolves({});
  const sns = getSnsTestClient();
  sns.sendMock.mockRejectedValueOnce(new Error("sns down"));

  const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});

  const res = await main(sqsEvent([{ title: "T", price: 10, count: 1 }]));

  expect(res.batchItemFailures).toEqual([]);
  expect(
    errSpy.mock.calls.some((args) =>
      args.some(
        (a) => typeof a === "string" && a.includes("SNS publish failed"),
      ),
    ),
  ).toBe(true);

  errSpy.mockRestore();
});

test("DynamoDB error → no SNS Publish for that message", async () => {
  ddbMock.on(TransactWriteCommand).rejects(new Error("ddb down"));
  const sns = getSnsTestClient();

  const res = await main(sqsEvent([{ title: "T", price: 10, count: 1 }]));

  expect(res.batchItemFailures).toEqual([{ itemIdentifier: "m-0" }]);
  const publishCalls = sns.sendMock.mock.calls.filter(
    (c) => c[0] instanceof PublishCommand,
  );
  expect(publishCalls).toHaveLength(0);
});

test("Publish Subject includes product title", async () => {
  ddbMock.on(TransactWriteCommand).resolves({});

  await main(sqsEvent([{ title: "Mug", price: 10, count: 1 }]));

  const sns = getSnsTestClient();
  const pub = sns.sendMock.mock.calls
    .map((c) => c[0])
    .find(
      (c): c is InstanceType<typeof PublishCommand> =>
        c instanceof PublishCommand,
    );
  expect(pub?.input.Subject).toBe("New product created: Mug");
});
