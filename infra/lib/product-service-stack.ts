import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
  aws_apigateway,
  aws_dynamodb,
  aws_lambda,
  aws_sns,
  aws_sns_subscriptions,
  aws_sqs,
} from "aws-cdk-lib";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { Construct } from "constructs";
import * as path from "path";

export class ProductServiceStack extends Stack {
  public readonly catalogItemsQueue: aws_sqs.IQueue;

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

    const catalogItemsDlq = new aws_sqs.Queue(this, "CatalogItemsDLQ", {
      queueName: "catalogItemsDLQ",
      retentionPeriod: Duration.days(14),
    });

    const catalogItemsQueue = new aws_sqs.Queue(this, "CatalogItemsQueue", {
      queueName: "catalogItemsQueue",
      visibilityTimeout: Duration.seconds(60),
      deadLetterQueue: { queue: catalogItemsDlq, maxReceiveCount: 3 },
    });

    const createProductTopic = new aws_sns.Topic(this, "CreateProductTopic", {
      topicName: "createProductTopic",
      displayName: "Product Created",
    });

    createProductTopic.addSubscription(
      new aws_sns_subscriptions.EmailSubscription("assayf95@gmail.com"),
    );

    createProductTopic.addSubscription(
      new aws_sns_subscriptions.EmailSubscription(
        "assayf95+premium@gmail.com",
        {
          filterPolicy: {
            price: aws_sns.SubscriptionFilter.numericFilter({
              greaterThan: 100,
            }),
          },
        },
      ),
    );

    const productServiceCode = aws_lambda.Code.fromAsset(
      path.join(__dirname, "../dist/product-service"),
    );

    const lambdaEnv = {
      PRODUCTS_TABLE_NAME: productsTable.tableName,
      STOCK_TABLE_NAME: stockTable.tableName,
    };

    const getProductsList = new aws_lambda.Function(this, "getProductsList", {
      runtime: aws_lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: Duration.seconds(5),
      handler: "get-products-list.main",
      code: productServiceCode,
      environment: lambdaEnv,
    });

    const getProductsById = new aws_lambda.Function(this, "getProductsById", {
      runtime: aws_lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: Duration.seconds(5),
      handler: "get-products-by-id.main",
      code: productServiceCode,
      environment: lambdaEnv,
    });

    const createProduct = new aws_lambda.Function(this, "createProduct", {
      runtime: aws_lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: Duration.seconds(5),
      handler: "create-product.main",
      code: productServiceCode,
      environment: lambdaEnv,
    });

    const catalogBatchProcess = new aws_lambda.Function(
      this,
      "catalogBatchProcess",
      {
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        memorySize: 1024,
        timeout: Duration.seconds(30),
        handler: "catalog-batch-process.main",
        code: productServiceCode,
        environment: {
          ...lambdaEnv,
          CREATE_PRODUCT_TOPIC_ARN: createProductTopic.topicArn,
        },
      },
    );

    createProductTopic.grantPublish(catalogBatchProcess);

    catalogBatchProcess.addEventSource(
      new SqsEventSource(catalogItemsQueue, {
        batchSize: 5,
        reportBatchItemFailures: true,
      }),
    );

    productsTable.grantReadData(getProductsList);
    stockTable.grantReadData(getProductsList);
    productsTable.grantReadData(getProductsById);
    stockTable.grantReadData(getProductsById);

    productsTable.grantWriteData(createProduct);
    stockTable.grantWriteData(createProduct);

    productsTable.grantWriteData(catalogBatchProcess);
    stockTable.grantWriteData(catalogBatchProcess);

    const api = new aws_apigateway.RestApi(this, "ProductServiceApi", {
      restApiName: "Product Service",
      description: "Product Service API",
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowOrigins: aws_apigateway.Cors.ALL_ORIGINS,
        allowMethods: ["GET", "POST", "OPTIONS"],
      },
    });

    const products = api.root.addResource("products");
    products.addMethod(
      "GET",
      new aws_apigateway.LambdaIntegration(getProductsList),
    );
    products.addMethod(
      "POST",
      new aws_apigateway.LambdaIntegration(createProduct),
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
      description: "DynamoDB products table name",
      exportName: "ProductsTableName",
    });

    new CfnOutput(this, "StockTableName", {
      value: stockTable.tableName,
      description: "DynamoDB stock table name",
      exportName: "StockTableName",
    });

    new CfnOutput(this, "CatalogItemsQueueUrl", {
      value: catalogItemsQueue.queueUrl,
      exportName: "CatalogItemsQueueUrl",
    });

    new CfnOutput(this, "CatalogItemsQueueArn", {
      value: catalogItemsQueue.queueArn,
      exportName: "CatalogItemsQueueArn",
    });

    new CfnOutput(this, "CreateProductTopicArn", {
      value: createProductTopic.topicArn,
      exportName: "CreateProductTopicArn",
    });

    this.catalogItemsQueue = catalogItemsQueue;
  }
}
