import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { main } from "../lib/product-service/get-products-by-id";

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset();
  process.env.PRODUCTS_TABLE_NAME = "products";
  process.env.STOCK_TABLE_NAME = "stock";
});

test("returns joined product when both items exist", async () => {
  ddbMock
    .on(GetCommand, { TableName: "products", Key: { id: "abc" } })
    .resolves({
      Item: { id: "abc", title: "T", description: "D", price: 10 },
    })
    .on(GetCommand, {
      TableName: "stock",
      Key: { product_id: "abc" },
    })
    .resolves({ Item: { product_id: "abc", count: 7 } });

  const res = await main({
    pathParameters: { productId: "abc" },
  });

  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({
    id: "abc",
    title: "T",
    description: "D",
    price: 10,
    count: 7,
  });
});

test("returns count zero when stock item is missing", async () => {
  ddbMock.on(GetCommand).callsFake((input) => {
    if (input.TableName === "products") {
      return Promise.resolve({
        Item: { id: "abc", title: "T", description: "D", price: 10 },
      });
    }
    return Promise.resolve({});
  });

  const res = await main({
    pathParameters: { productId: "abc" },
  });

  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body).count).toBe(0);
});

test("returns 404 when product not found", async () => {
  ddbMock.on(GetCommand).resolves({});

  const res = await main({
    pathParameters: { productId: "missing" },
  });

  expect(res.statusCode).toBe(404);
  expect(JSON.parse(res.body)).toEqual({
    message: "Product not found",
  });
});

test("returns 500 when DynamoDB throws", async () => {
  ddbMock.on(GetCommand).rejects(new Error("ddb down"));

  const res = await main({
    pathParameters: { productId: "abc" },
  });

  expect(res.statusCode).toBe(500);
  expect(JSON.parse(res.body)).toEqual({
    message: "Internal Server Error",
  });
});

test("returns 400 when productId is missing", async () => {
  const res = await main({ pathParameters: {} });

  expect(res.statusCode).toBe(400);
  expect(JSON.parse(res.body)).toEqual({
    message: "productId is required",
  });
});
