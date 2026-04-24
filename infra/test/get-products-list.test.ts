import { main } from "../lib/product-service/get-products-list";
import { products } from "../lib/product-service/products";

test("getProductsList returns all products", async () => {
  const response = await main();

  expect(response.statusCode).toBe(200);
  expect(response.headers["Content-Type"]).toBe("application/json");
  expect(JSON.parse(response.body)).toEqual(products);
});
