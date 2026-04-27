import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import {
  ddbDocClient,
  getProductsTable,
  getStockTable,
  ProductItem,
  StockItem,
  JoinedProduct,
} from "./dynamodb";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

export async function main(_event?: unknown) {
  console.log("getProductsList:", JSON.stringify({ event: _event }));
  try {
    const [productsRes, stockRes] = await Promise.all([
      ddbDocClient.send(new ScanCommand({ TableName: getProductsTable() })),
      ddbDocClient.send(new ScanCommand({ TableName: getStockTable() })),
    ]);

    const products = (productsRes.Items ?? []) as ProductItem[];
    const stock = (stockRes.Items ?? []) as StockItem[];
    const stockByProductId = new Map(stock.map((s) => [s.product_id, s.count]));

    const joined: JoinedProduct[] = products.map((p) => ({
      ...p,
      count: stockByProductId.get(p.id) ?? 0,
    }));

    return { statusCode: 200, headers, body: JSON.stringify(joined) };
  } catch (err) {
    console.error("getProductsList error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
}
