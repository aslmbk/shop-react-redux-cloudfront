import { GetCommand } from "@aws-sdk/lib-dynamodb";
import {
  ddbDocClient,
  getProductsTable,
  getStockTable,
  ProductItem,
  StockItem,
} from "./dynamodb";

interface Event {
  pathParameters?: { productId?: string } | null;
}

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

export async function main(event: Event) {
  console.log("getProductsById:", JSON.stringify({ event }));
  const productId = event.pathParameters?.productId;

  if (!productId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "productId is required" }),
    };
  }

  try {
    const [productRes, stockRes] = await Promise.all([
      ddbDocClient.send(
        new GetCommand({
          TableName: getProductsTable(),
          Key: { id: productId },
        }),
      ),
      ddbDocClient.send(
        new GetCommand({
          TableName: getStockTable(),
          Key: { product_id: productId },
        }),
      ),
    ]);

    if (!productRes.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Product not found" }),
      };
    }

    const product = productRes.Item as ProductItem;
    const stock = stockRes.Item as StockItem | undefined;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ...product, count: stock?.count ?? 0 }),
    };
  } catch (err) {
    console.error("getProductsById error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
}
