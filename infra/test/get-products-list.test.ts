import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { main } from "../lib/product-service/get-products-list";

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset();
  process.env.PRODUCTS_TABLE_NAME = "products";
  process.env.STOCK_TABLE_NAME = "stock";
});

test("returns joined products list", async () => {
  ddbMock
    .on(ScanCommand, { TableName: "products" })
    .resolves({
      Items: [{ id: "abc", title: "T", description: "D", price: 10 }],
    })
    .on(ScanCommand, { TableName: "stock" })
    .resolves({ Items: [{ product_id: "abc", count: 5 }] });

  const res = await main();

  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual([
    { id: "abc", title: "T", description: "D", price: 10, count: 5 },
  ]);
});

test("when stock is empty all counts are zero", async () => {
  ddbMock.on(ScanCommand).callsFake((input) => {
    if (input.TableName === "products") {
      return Promise.resolve({
        Items: [{ id: "x", title: "A", description: "B", price: 1 }],
      });
    }
    return Promise.resolve({ Items: [] });
  });

  const res = await main();

  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual([
    { id: "x", title: "A", description: "B", price: 1, count: 0 },
  ]);
});

test("returns 500 when DynamoDB throws", async () => {
  ddbMock.on(ScanCommand).rejects(new Error("ddb down"));

  const res = await main();

  expect(res.statusCode).toBe(500);
  expect(JSON.parse(res.body)).toEqual({
    message: "Internal Server Error",
  });
});
