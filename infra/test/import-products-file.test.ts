import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { main } from "../lib/import-service/import-products-file";

const mockedGetSignedUrl = getSignedUrl as jest.MockedFunction<
  typeof getSignedUrl
>;

beforeEach(() => {
  mockedGetSignedUrl.mockReset();
  process.env.IMPORT_BUCKET_NAME = "test-bucket";
});

test("returns 400 when name query parameter is missing", async () => {
  const res = await main({ queryStringParameters: null });

  expect(res.statusCode).toBe(400);
  expect(JSON.parse(res.body)).toEqual({
    message: "Query parameter 'name' is required",
  });
  expect(mockedGetSignedUrl).not.toHaveBeenCalled();
});

test("returns 400 when queryStringParameters is undefined", async () => {
  const res = await main({});

  expect(res.statusCode).toBe(400);
  expect(mockedGetSignedUrl).not.toHaveBeenCalled();
});

test("returns 200 with the presigned URL when name is provided", async () => {
  const expected =
    "https://signed.example.com/uploaded/products.csv?X-Amz-Signature=abc";
  mockedGetSignedUrl.mockResolvedValue(expected);

  const res = await main({ queryStringParameters: { name: "products.csv" } });

  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toBe(expected);
  expect(mockedGetSignedUrl).toHaveBeenCalledTimes(1);
});

test("builds the put command with key uploaded/<fileName>", async () => {
  mockedGetSignedUrl.mockResolvedValue("https://signed.example.com/x");

  await main({ queryStringParameters: { name: "products.csv" } });

  const [, command] = mockedGetSignedUrl.mock.calls[0];
  expect((command as { input: Record<string, string> }).input).toEqual({
    Bucket: "test-bucket",
    Key: "uploaded/products.csv",
  });
});

test("returns 500 when getSignedUrl throws", async () => {
  mockedGetSignedUrl.mockRejectedValue(new Error("boom"));

  const res = await main({ queryStringParameters: { name: "products.csv" } });

  expect(res.statusCode).toBe(500);
  expect(JSON.parse(res.body)).toEqual({ message: "Internal Server Error" });
});
