import type { BatchWriteCommandOutput } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";

const REGION =
  process.env.AWS_REGION ?? process.env.CDK_DEFAULT_REGION ?? "us-east-1";
const PRODUCTS_TABLE = "products";
const STOCK_TABLE = "stock";

interface SeedProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  count: number;
}

/** Twelve catalog items with fixed UUID v4 ids (pre-generated locally, not at runtime). */
const SEED_DATA: SeedProduct[] = [
  {
    id: "d4d91c4d-9cbc-4851-8bdb-8db434963467",
    title: "Wireless Noise-Cancelling Headphones",
    description:
      "Over-ear Bluetooth headphones with active noise cancellation and up to 30 hours of playback on a single charge.",
    price: 199,
    count: 12,
  },
  {
    id: "1d93258d-eeb7-420e-9516-51fb015adcdf",
    title: "Mechanical Gaming Keyboard",
    description:
      "RGB-backlit mechanical switches with tactile feedback, programmable macros, and durable double-shot keycaps.",
    price: 89,
    count: 25,
  },
  {
    id: "09d40f79-424c-4281-91d0-59d9fa4a8eea",
    title: "Ergonomic Office Chair",
    description:
      "Breathable mesh back, adjustable lumbar support, and synchronized tilt for long work sessions.",
    price: 349,
    count: 3,
  },
  {
    id: "cd335f57-f211-4a68-b746-245eedaa3a35",
    title: "Stainless Steel Water Bottle",
    description:
      "Double-wall vacuum insulation keeps drinks cold for 24 hours or hot for 12; leak-proof flip lid.",
    price: 22,
    count: 50,
  },
  {
    id: "c0520b85-0488-4982-8cd8-dc7134755904",
    title: "Smart Fitness Tracker",
    description:
      "Tracks heart rate, sleep stages, and workouts with a bright AMOLED display and week-long battery life.",
    price: 129,
    count: 8,
  },
  {
    id: "872d2730-3566-428a-abc0-1913d0e78b32",
    title: "Compact Espresso Machine",
    description:
      "15-bar pump pressure, removable drip tray, and steam wand for café-style drinks at home.",
    price: 279,
    count: 5,
  },
  {
    id: "b3d82cec-410b-41f3-9290-1b5ccbf782fa",
    title: "Leather Messenger Bag",
    description:
      "Full-grain leather with padded laptop sleeve and organizer pockets for commute and travel.",
    price: 159,
    count: 15,
  },
  {
    id: "b317d440-a897-4233-af71-c677083ab827",
    title: "4K Action Camera",
    description:
      "Records stabilized 4K video at 60 fps, waterproof housing included, voice control support.",
    price: 399,
    count: 7,
  },
  {
    id: "777a8269-6f36-44d3-bfc0-63ca6c353909",
    title: "Yoga Mat Premium",
    description:
      "Extra-thick cushioning with non-slip texture on both sides; rolls up with carrying strap.",
    price: 45,
    count: 20,
  },
  {
    id: "c53988fe-522c-49a2-b5fa-950649ed806b",
    title: "Bluetooth Portable Speaker",
    description:
      "360-degree sound, IPX7 waterproof rating, and 12-hour battery — ideal for indoor and outdoor use.",
    price: 79,
    count: 0,
  },
  {
    id: "a0e470ca-b6c1-4590-8b6e-67114fe617e3",
    title: "Cast Iron Skillet",
    description:
      "Pre-seasoned 12-inch skillet for even heat retention on the stove, oven, or grill.",
    price: 55,
    count: 14,
  },
  {
    id: "526cfcc2-4767-45cc-96a3-7b92ae424d22",
    title: "Memory Foam Pillow",
    description:
      "Contoured cervical support with breathable cover; helps align neck and shoulders during sleep.",
    price: 39,
    count: 0,
  },
];

type PendingWrites = NonNullable<BatchWriteCommandOutput["UnprocessedItems"]>;

async function batchWriteWithRetry(
  ddb: DynamoDBDocumentClient,
  requestItems: PendingWrites,
): Promise<void> {
  let pending: PendingWrites = requestItems;

  for (
    let attempt = 1;
    attempt <= 5 && Object.keys(pending).length;
    attempt++
  ) {
    const res = await ddb.send(
      new BatchWriteCommand({ RequestItems: pending }),
    );
    pending = res.UnprocessedItems ?? {};
    if (Object.keys(pending).length) {
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }

  if (Object.keys(pending).length) {
    console.error(
      "Still unprocessed after retries:",
      JSON.stringify(pending, null, 2),
    );
    process.exit(1);
  }
}

async function main() {
  console.log(
    `Seeding into region ${REGION} (tables: ${PRODUCTS_TABLE}, ${STOCK_TABLE})`,
  );

  const ddb = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: REGION }),
  );

  const productItems = SEED_DATA.map((p) => ({
    PutRequest: {
      Item: {
        id: p.id,
        title: p.title,
        description: p.description,
        price: p.price,
      },
    },
  }));

  const stockItems = SEED_DATA.map((p) => ({
    PutRequest: { Item: { product_id: p.id, count: p.count } },
  }));

  await batchWriteWithRetry(ddb, {
    [PRODUCTS_TABLE]: productItems,
    [STOCK_TABLE]: stockItems,
  });

  console.log(
    `Seeded ${SEED_DATA.length} products and stock entries into region ${REGION}`,
  );
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
