import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import csv from "csv-parser";
import type { Readable } from "stream";

const s3 = new S3Client({});

type S3EventRecord = {
  s3: { bucket: { name: string }; object: { key: string } };
};
type S3Event = { Records: S3EventRecord[] };

export async function main(event: S3Event) {
  console.log("importFileParser:", JSON.stringify({ event }));
  for (const record of event.Records ?? []) {
    const Bucket = record.s3.bucket.name;
    const Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    const obj = await s3.send(new GetObjectCommand({ Bucket, Key }));
    const body = obj.Body as Readable;

    await new Promise<void>((resolve, reject) => {
      body
        .pipe(csv())
        .on("data", (row) => console.log("parsed row:", row))
        .on("end", () => resolve())
        .on("error", reject);
    });

    const parsedKey = Key.replace(/^uploaded\//, "parsed/");
    await s3.send(
      new CopyObjectCommand({
        Bucket,
        CopySource: encodeURI(`${Bucket}/${Key}`),
        Key: parsedKey,
      }),
    );
    await s3.send(new DeleteObjectCommand({ Bucket, Key }));
    console.log(`moved s3://${Bucket}/${Key} -> s3://${Bucket}/${parsedKey}`);
  }
}
