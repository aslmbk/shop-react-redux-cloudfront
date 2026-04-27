import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import {
  ddbDocClient,
  getProductsTable,
  getStockTable,
  ProductItem,
  JoinedProduct,
} from "./dynamodb";

interface APIGatewayEvent {
  body?: string | null;
}

interface ValidatedBody {
  title: string;
  description: string;
  price: number;
  count: number;
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

function validateBody(
  raw: unknown,
): { ok: true; data: ValidatedBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Body must be a JSON object" };
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.title !== "string" || obj.title.trim() === "") {
    return {
      ok: false,
      error: "title is required and must be a non-empty string",
    };
  }
  if (
    typeof obj.price !== "number" ||
    !Number.isFinite(obj.price) ||
    obj.price <= 0
  ) {
    return {
      ok: false,
      error: "price is required and must be a positive number",
    };
  }

  let description = "";
  if (obj.description !== undefined) {
    if (typeof obj.description !== "string") {
      return { ok: false, error: "description must be a string" };
    }
    description = obj.description;
  }

  let count = 0;
  if (obj.count !== undefined) {
    if (
      typeof obj.count !== "number" ||
      !Number.isInteger(obj.count) ||
      obj.count < 0
    ) {
      return { ok: false, error: "count must be a non-negative integer" };
    }
    count = obj.count;
  }

  return {
    ok: true,
    data: { title: obj.title.trim(), description, price: obj.price, count },
  };
}

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

  const validation = validateBody(parsed);
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
