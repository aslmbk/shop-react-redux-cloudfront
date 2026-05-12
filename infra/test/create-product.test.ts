import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { main } from "../lib/product-service/create-product";

jest.mock("uuid", () => ({ v4: () => "fixed-uuid-v4" }));

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset();
  process.env.PRODUCTS_TABLE_NAME = "products";
  process.env.STOCK_TABLE_NAME = "stock";
});

const ok = (body: unknown) => ({ body: JSON.stringify(body) });

test("201 + joined product on valid body", async () => {
  ddbMock.on(TransactWriteCommand).resolves({});

  const res = await main(
    ok({ title: "Mug", description: "Coffee mug", price: 12, count: 5 }),
  );

  expect(res.statusCode).toBe(201);
  expect(JSON.parse(res.body as string)).toEqual({
    id: "fixed-uuid-v4",
    title: "Mug",
    description: "Coffee mug",
    price: 12,
    count: 5,
  });
  expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(1);
});

test("count defaults to 0 when omitted", async () => {
  ddbMock.on(TransactWriteCommand).resolves({});
  const res = await main(ok({ title: "T", price: 1 }));
  expect(res.statusCode).toBe(201);
  expect(JSON.parse(res.body as string).count).toBe(0);
  expect(JSON.parse(res.body as string).description).toBe("");
});

test("400 when body is missing", async () => {
  const res = await main({ body: null });
  expect(res.statusCode).toBe(400);
});

test("400 when JSON is invalid", async () => {
  const res = await main({ body: "not-json" });
  expect(res.statusCode).toBe(400);
});

test("400 when title is empty", async () => {
  const res = await main(ok({ title: "   ", price: 10 }));
  expect(res.statusCode).toBe(400);
});

test("400 when price is not positive", async () => {
  const res = await main(ok({ title: "T", price: 0 }));
  expect(res.statusCode).toBe(400);
});

test("400 when price is non-numeric", async () => {
  const res = await main(ok({ title: "T", price: "10" }));
  expect(res.statusCode).toBe(400);
});

test("400 when count is negative", async () => {
  const res = await main(ok({ title: "T", price: 10, count: -1 }));
  expect(res.statusCode).toBe(400);
});

test("400 when body is an array", async () => {
  const res = await main(ok([1, 2, 3]));
  expect(res.statusCode).toBe(400);
});

test("500 when DynamoDB throws", async () => {
  ddbMock.on(TransactWriteCommand).rejects(new Error("ddb down"));
  const res = await main(ok({ title: "T", price: 10 }));
  expect(res.statusCode).toBe(500);
  expect(JSON.parse(res.body as string)).toEqual({
    message: "Internal Server Error",
  });
});

test("sends TransactWriteCommand with both Puts", async () => {
  ddbMock.on(TransactWriteCommand).resolves({});
  await main(ok({ title: "T", price: 10, count: 7 }));

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
