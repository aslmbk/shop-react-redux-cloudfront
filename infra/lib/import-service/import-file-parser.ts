import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  SQSClient,
  SendMessageBatchCommand,
  type SendMessageBatchRequestEntry,
} from "@aws-sdk/client-sqs";
import csv from "csv-parser";
import type { Readable } from "stream";

const s3 = new S3Client({});
const sqs = new SQSClient({});

type S3EventRecord = {
  s3: { bucket: { name: string }; object: { key: string } };
};
type S3Event = { Records: S3EventRecord[] };

const QUEUE_URL = () => process.env.CATALOG_ITEMS_QUEUE_URL as string;
const BATCH_SIZE = 10; // SQS SendMessageBatch hard limit

function coerce(row: Record<string, string>) {
  const price = Number(row.price);
  const count = Number(row.count);
  return {
    title: row.title,
    description: row.description ?? "",
    price,
    count,
    _valid:
      typeof row.title === "string" &&
      row.title.trim() !== "" &&
      Number.isFinite(price) &&
      price > 0 &&
      Number.isFinite(count) &&
      Number.isInteger(count) &&
      count >= 0,
  };
}

async function sendAllToSqs(rows: Record<string, string>[]) {
  let sent = 0;
  let dropped = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const entries: SendMessageBatchRequestEntry[] = [];

    chunk.forEach((row, idx) => {
      const { _valid, ...payload } = coerce(row);
      if (!_valid) {
        dropped++;
        console.warn("dropping malformed row", { row });
        return;
      }
      entries.push({
        Id: `m-${i + idx}`,
        MessageBody: JSON.stringify(payload),
      });
    });

    if (entries.length === 0) continue;

    const res = await sqs.send(
      new SendMessageBatchCommand({ QueueUrl: QUEUE_URL(), Entries: entries }),
    );

    sent += res.Successful?.length ?? 0;
    if (res.Failed && res.Failed.length > 0) {
      console.error("SQS partial batch failure", { failed: res.Failed });
      throw new Error(
        `SQS batch had ${res.Failed.length} failed entries; aborting before S3 move`,
      );
    }
  }

  return { sent, dropped };
}

export async function main(event: S3Event) {
  console.log("importFileParser:", JSON.stringify({ event }));

  for (const record of event.Records ?? []) {
    const Bucket = record.s3.bucket.name;
    const Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    const obj = await s3.send(new GetObjectCommand({ Bucket, Key }));
    const body = obj.Body as Readable;

    const rows: Record<string, string>[] = [];
    await new Promise<void>((resolve, reject) => {
      body
        .pipe(csv())
        .on("data", (row: Record<string, string>) => rows.push(row))
        .on("end", () => resolve())
        .on("error", reject);
    });

    const { sent, dropped } = await sendAllToSqs(rows);
    console.log("SQS send complete", {
      total: rows.length,
      sent,
      dropped,
      Key,
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
