import { products } from "./products";

interface GetProductsByIdEvent {
  pathParameters?: {
    productId?: string;
  } | null;
}

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

export async function main(event: GetProductsByIdEvent) {
  const productId = event.pathParameters?.productId;
  const product = products.find(({ id }) => id === productId);

  if (!product) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Product not found" }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(product),
  };
}
