import { main } from "../lib/product-service/get-products-by-id";
import { products } from "../lib/product-service/products";

test("getProductsById returns a matched product", async () => {
  const product = products[0];
  const response = await main({
    pathParameters: {
      productId: product.id,
    },
  });

  expect(response.statusCode).toBe(200);
  expect(response.headers["Content-Type"]).toBe("application/json");
  expect(JSON.parse(response.body)).toEqual(product);
});

test("getProductsById returns 404 for an unknown product", async () => {
  const response = await main({
    pathParameters: {
      productId: "unknown-id",
    },
  });

  expect(response.statusCode).toBe(404);
  expect(response.headers["Content-Type"]).toBe("application/json");
  expect(JSON.parse(response.body)).toEqual({ message: "Product not found" });
});
