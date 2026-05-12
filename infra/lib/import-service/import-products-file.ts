import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({});

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

type ApiGatewayProxyEvent = {
  queryStringParameters?: Record<string, string | undefined> | null;
};

export async function main(event: ApiGatewayProxyEvent) {
  console.log("importProductsFile:", JSON.stringify({ event }));
  try {
    const fileName = event?.queryStringParameters?.name;
    if (!fileName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: "Query parameter 'name' is required",
        }),
      };
    }
    const Bucket = process.env.IMPORT_BUCKET_NAME!;
    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket,
        Key: `uploaded/${fileName}`,
      }),
      { expiresIn: 60 },
    );
    return { statusCode: 200, headers, body: JSON.stringify(url) };
  } catch (err) {
    console.error("importProductsFile error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
}
