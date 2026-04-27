import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const getProductsTable = () => process.env.PRODUCTS_TABLE_NAME as string;
export const getStockTable = () => process.env.STOCK_TABLE_NAME as string;

export interface ProductItem {
  id: string;
  title: string;
  description: string;
  price: number;
}

export interface StockItem {
  product_id: string;
  count: number;
}

export interface JoinedProduct extends ProductItem {
  count: number;
}
