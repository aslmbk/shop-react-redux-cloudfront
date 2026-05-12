import type {
  SQSEvent,
  SQSBatchResponse,
  SQSBatchItemFailure,
} from "aws-lambda";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import {
  ddbDocClient,
  getProductsTable,
  getStockTable,
  ProductItem,
} from "./dynamodb";
import { validateProductBody } from "./validate";

const snsClient = new SNSClient({});
const getTopicArn = () => process.env.CREATE_PRODUCT_TOPIC_ARN as string;

export async function main(event: SQSEvent): Promise<SQSBatchResponse> {
  console.log(
    "catalogBatchProcess: received",
    event.Records.length,
    "messages",
  );
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    try {
      const parsed = JSON.parse(record.body);
      const validation = validateProductBody(parsed);
      if (!validation.ok) {
        console.error("validation failed", {
          messageId: record.messageId,
          error: validation.error,
        });
        batchItemFailures.push({ itemIdentifier: record.messageId });
        continue;
      }
      const id = uuidv4();
      const product: ProductItem = {
        id,
        title: validation.data.title,
        description: validation.data.description,
        price: validation.data.price,
      };
      await ddbDocClient.send(
        new TransactWriteCommand({
          TransactItems: [
            { Put: { TableName: getProductsTable(), Item: product } },
            {
              Put: {
                TableName: getStockTable(),
                Item: { product_id: id, count: validation.data.count },
              },
            },
          ],
        }),
      );
      try {
        await snsClient.send(
          new PublishCommand({
            TopicArn: getTopicArn(),
            Subject: `New product created: ${validation.data.title}`,
            Message: JSON.stringify({
              id,
              title: validation.data.title,
              description: validation.data.description,
              price: validation.data.price,
              count: validation.data.count,
            }),
            MessageAttributes: {
              price: {
                DataType: "Number",
                StringValue: String(validation.data.price),
              },
            },
          }),
        );
      } catch (snsErr) {
        console.error("SNS publish failed (DB already committed)", {
          messageId: record.messageId,
          id,
          err: snsErr,
        });
      }
      console.log("created product", { id, messageId: record.messageId });
    } catch (err) {
      console.error("processing error", { messageId: record.messageId, err });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}
