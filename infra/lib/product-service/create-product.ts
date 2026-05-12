import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import {
  ddbDocClient,
  getProductsTable,
  getStockTable,
  ProductItem,
  JoinedProduct,
} from "./dynamodb";
import { validateProductBody } from "./validate";

interface APIGatewayEvent {
  body?: string | null;
}

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

const badRequest = (message: string) => ({
  statusCode: 400,
  headers,
  body: JSON.stringify({ message }),
});

export async function main(event: APIGatewayEvent) {
  console.log("createProduct:", JSON.stringify({ event }));

  if (!event.body) {
    return badRequest("Request body is required");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(event.body);
  } catch {
    return badRequest("Invalid JSON");
  }

  const validation = validateProductBody(parsed);
  if (!validation.ok) {
    return badRequest(validation.error);
  }

  const id = uuidv4();
  const product: ProductItem = {
    id,
    title: validation.data.title,
    description: validation.data.description,
    price: validation.data.price,
  };
  const stockEntry = { product_id: id, count: validation.data.count };

  try {
    await ddbDocClient.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: getProductsTable(), Item: product } },
          { Put: { TableName: getStockTable(), Item: stockEntry } },
        ],
      }),
    );

    const created: JoinedProduct = { ...product, count: validation.data.count };
    return { statusCode: 201, headers, body: JSON.stringify(created) };
  } catch (err) {
    console.error("createProduct error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
}
