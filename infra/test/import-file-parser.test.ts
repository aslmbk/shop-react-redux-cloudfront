/* eslint-disable @typescript-eslint/no-empty-function */
jest.mock("@aws-sdk/client-sqs", () => require("./stubs/aws-client-sqs"));

import { Readable } from "stream";
import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { main } from "../lib/import-service/import-file-parser";

function getSqsTestClient() {
  const C = SQSClient as unknown as typeof SQSClient & {
    lastInstance: SQSClient & { sendMock: jest.Mock };
  };
  return C.lastInstance;
}

const csvToStream = (csvText: string) => Readable.from([Buffer.from(csvText)]);

const s3Event = (key = "uploaded/test.csv") => ({
  Records: [
    {
      s3: {
        bucket: { name: "bucket-1" },
        object: { key: encodeURIComponent(key).replace(/%20/g, "+") },
      },
    },
  ],
});

beforeEach(() => {
  process.env.CATALOG_ITEMS_QUEUE_URL =
    "https://sqs.us-east-1.amazonaws.com/123/catalogItemsQueue";
  getSqsTestClient().sendMock.mockReset();
  getSqsTestClient().sendMock.mockImplementation(
    async (
      command: unknown,
    ): Promise<{
      Successful: { Id: string; MessageId?: string }[];
      Failed: { Id: string; Code?: string; Message?: string }[];
    }> => {
      if (command instanceof SendMessageBatchCommand) {
        const input = command.input as { Entries?: { Id: string }[] };
        const entries = input.Entries ?? [];
        return {
          Successful: entries.map((e) => ({
            Id: e.Id,
            MessageId: "mid-" + e.Id,
          })),
          Failed: [],
        };
      }
      return { Successful: [], Failed: [] };
    },
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("happy path: 3 rows → one SendMessageBatch with 3 entries, then Copy + Delete", async () => {
  const csvText =
    "title,description,price,count\nA,da,1,0\nB,db,2,1\nC,dc,3,2\n";
  jest
    .spyOn(S3Client.prototype, "send")
    .mockImplementation(async (command: unknown) => {
      if (command instanceof GetObjectCommand) {
        return { Body: csvToStream(csvText) };
      }
      return {};
    });

  await main(s3Event());

  const sqsCalls = getSqsTestClient().sendMock.mock.calls.map(
    (c: unknown[]) => c[0],
  );
  const batchCmds = sqsCalls.filter(
    (c: unknown): c is InstanceType<typeof SendMessageBatchCommand> =>
      c instanceof SendMessageBatchCommand,
  );
  expect(batchCmds).toHaveLength(1);
  const entries = (batchCmds[0]?.input.Entries ?? []) as {
    Id: string;
    MessageBody: string;
  }[];
  expect(entries).toHaveLength(3);
  const bodies = entries.map((e) => JSON.parse(e.MessageBody));
  expect(bodies[0]).toMatchObject({
    title: "A",
    description: "da",
    price: 1,
    count: 0,
  });

  const s3Spy = S3Client.prototype.send as jest.Mock;
  const copy = s3Spy.mock.calls
    .map((c) => c[0])
    .find((c) => c instanceof CopyObjectCommand);
  const del = s3Spy.mock.calls
    .map((c) => c[0])
    .find((c) => c instanceof DeleteObjectCommand);
  expect(copy).toBeDefined();
  expect(del).toBeDefined();
});

test("15 rows → two batches: 10 + 5", async () => {
  const header = "title,description,price,count\n";
  const lines = Array.from(
    { length: 15 },
    (_, i) => `T${i},d,${i + 1},${i}\n`,
  ).join("");
  const csvText = header + lines;

  jest
    .spyOn(S3Client.prototype, "send")
    .mockImplementation(async (command: unknown) => {
      if (command instanceof GetObjectCommand) {
        return { Body: csvToStream(csvText) };
      }
      return {};
    });

  await main(s3Event());

  const batchCmds = getSqsTestClient()
    .sendMock.mock.calls.map((c: unknown[]) => c[0])
    .filter(
      (c: unknown): c is InstanceType<typeof SendMessageBatchCommand> =>
        c instanceof SendMessageBatchCommand,
    );
  expect(batchCmds).toHaveLength(2);
  expect((batchCmds[0]?.input.Entries as unknown[]).length).toBe(10);
  expect((batchCmds[1]?.input.Entries as unknown[]).length).toBe(5);
});

test("price and count are JSON numbers, not strings", async () => {
  const csvText = "title,description,price,count\nX,,29.99,15\n";
  jest
    .spyOn(S3Client.prototype, "send")
    .mockImplementation(async (command: unknown) => {
      if (command instanceof GetObjectCommand) {
        return { Body: csvToStream(csvText) };
      }
      return {};
    });

  await main(s3Event());

  const batch = getSqsTestClient()
    .sendMock.mock.calls.map((c: unknown[]) => c[0])
    .find((c: unknown) => c instanceof SendMessageBatchCommand) as
    | InstanceType<typeof SendMessageBatchCommand>
    | undefined;
  expect(batch).toBeDefined();
  const body = JSON.parse(
    (batch?.input.Entries as { MessageBody: string }[])[0]?.MessageBody,
  );
  expect(body.price).toBe(29.99);
  expect(typeof body.price).toBe("number");
  expect(body.count).toBe(15);
  expect(typeof body.count).toBe("number");
});

test("malformed row dropped; valid rows sent; S3 move still runs", async () => {
  const csvText =
    "title,description,price,count\n" +
    "Good,ok,10,1\n" +
    ",bad,1,0\n" +
    "BadPrice,ok,abc,1\n" +
    "Ok2,ok,5,2\n";

  jest
    .spyOn(S3Client.prototype, "send")
    .mockImplementation(async (command: unknown) => {
      if (command instanceof GetObjectCommand) {
        return { Body: csvToStream(csvText) };
      }
      return {};
    });

  await main(s3Event());

  const batch = getSqsTestClient()
    .sendMock.mock.calls.map((c: unknown[]) => c[0])
    .find((c: unknown) => c instanceof SendMessageBatchCommand) as
    | InstanceType<typeof SendMessageBatchCommand>
    | undefined;
  const entries = (batch?.input.Entries ?? []) as { MessageBody: string }[];
  expect(entries).toHaveLength(2);
  const titles = entries.map((e) => JSON.parse(e.MessageBody).title);
  expect(titles).toEqual(["Good", "Ok2"]);

  const s3Spy = S3Client.prototype.send as jest.Mock;
  expect(s3Spy.mock.calls.some((c) => c[0] instanceof CopyObjectCommand)).toBe(
    true,
  );
  expect(
    s3Spy.mock.calls.some((c) => c[0] instanceof DeleteObjectCommand),
  ).toBe(true);
});

test("SQS Failed entries → error; no CopyObject or DeleteObject", async () => {
  const csvText = "title,description,price,count\nA,,1,0\n";
  jest
    .spyOn(S3Client.prototype, "send")
    .mockImplementation(async (command: unknown) => {
      if (command instanceof GetObjectCommand) {
        return { Body: csvToStream(csvText) };
      }
      return {};
    });

  getSqsTestClient().sendMock.mockImplementation(async (command: unknown) => {
    if (command instanceof SendMessageBatchCommand) {
      return {
        Successful: [],
        Failed: [{ Id: "m-0", Code: "InternalFailure", Message: "boom" }],
      };
    }
    return { Successful: [], Failed: [] };
  });

  await expect(main(s3Event())).rejects.toThrow(/SQS batch had/);

  const s3Spy = S3Client.prototype.send as jest.Mock;
  expect(s3Spy.mock.calls.some((c) => c[0] instanceof CopyObjectCommand)).toBe(
    false,
  );
  expect(
    s3Spy.mock.calls.some((c) => c[0] instanceof DeleteObjectCommand),
  ).toBe(false);
});

test("no console.log with parsed row for stream rows", async () => {
  const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  const csvText = "title,description,price,count\nA,,1,0\n";
  jest
    .spyOn(S3Client.prototype, "send")
    .mockImplementation(async (command: unknown) => {
      if (command instanceof GetObjectCommand) {
        return { Body: csvToStream(csvText) };
      }
      return {};
    });

  await main(s3Event());

  const hasParsedRow = logSpy.mock.calls.some((args) =>
    args.some((a) => typeof a === "string" && a.includes("parsed row:")),
  );
  expect(hasParsedRow).toBe(false);
  logSpy.mockRestore();
});
