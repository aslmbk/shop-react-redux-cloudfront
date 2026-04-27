import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
  aws_apigateway,
  aws_dynamodb,
  aws_lambda,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

export class ProductServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const productsTable = new aws_dynamodb.Table(this, "ProductsTable", {
      tableName: "products",
      partitionKey: { name: "id", type: aws_dynamodb.AttributeType.STRING },
      billingMode: aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const stockTable = new aws_dynamodb.Table(this, "StockTable", {
      tableName: "stock",
      partitionKey: {
        name: "product_id",
        type: aws_dynamodb.AttributeType.STRING,
      },
      billingMode: aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const productServiceCode = aws_lambda.Code.fromAsset(
      path.join(__dirname, "../dist/product-service"),
    );

    const getProductsList = new aws_lambda.Function(this, "getProductsList", {
      runtime: aws_lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: Duration.seconds(5),
      handler: "get-products-list.main",
      code: productServiceCode,
    });

    const getProductsById = new aws_lambda.Function(this, "getProductsById", {
      runtime: aws_lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: Duration.seconds(5),
      handler: "get-products-by-id.main",
      code: productServiceCode,
    });

    const api = new aws_apigateway.RestApi(this, "ProductServiceApi", {
      restApiName: "Product Service",
      description: "Product Service API",
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowOrigins: aws_apigateway.Cors.ALL_ORIGINS,
        allowMethods: ["GET", "OPTIONS"],
      },
    });

    const products = api.root.addResource("products");
    products.addMethod(
      "GET",
      new aws_apigateway.LambdaIntegration(getProductsList),
    );

    const productById = products.addResource("{productId}");
    productById.addMethod(
      "GET",
      new aws_apigateway.LambdaIntegration(getProductsById),
    );

    new CfnOutput(this, "ProductsApiUrl", {
      value: `${api.url}products`,
      description: "GET products endpoint",
      exportName: "ProductsApiUrl",
    });

    new CfnOutput(this, "ProductByIdApiUrl", {
      value: `${api.url}products/{productId}`,
      description: "GET product by id endpoint",
      exportName: "ProductByIdApiUrl",
    });

    new CfnOutput(this, "ProductsTableName", {
      value: productsTable.tableName,
    });

    new CfnOutput(this, "StockTableName", {
      value: stockTable.tableName,
    });
  }
}
