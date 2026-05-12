import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
  aws_apigateway,
  aws_lambda,
  aws_s3,
  aws_s3_deployment,
  aws_sqs,
} from "aws-cdk-lib";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import { Construct } from "constructs";
import * as path from "path";

interface ImportServiceStackProps extends StackProps {
  catalogItemsQueue: aws_sqs.IQueue;
}

export class ImportServiceStack extends Stack {
  constructor(scope: Construct, id: string, props: ImportServiceStackProps) {
    super(scope, id, props);

    const importBucket = new aws_s3.Bucket(this, "ImportBucket", {
      blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [aws_s3.HttpMethods.PUT],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
    });

    new aws_s3_deployment.BucketDeployment(this, "UploadFolderPlaceholder", {
      sources: [aws_s3_deployment.Source.data("uploaded/.keep", "")],
      destinationBucket: importBucket,
    });

    const importServiceCode = aws_lambda.Code.fromAsset(
      path.join(__dirname, "../dist/import-service"),
    );

    const importProductsFile = new aws_lambda.Function(
      this,
      "importProductsFile",
      {
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        memorySize: 1024,
        timeout: Duration.seconds(5),
        handler: "import-products-file.main",
        code: importServiceCode,
        environment: { IMPORT_BUCKET_NAME: importBucket.bucketName },
      },
    );

    importBucket.grantPut(importProductsFile);

    const importFileParser = new aws_lambda.Function(this, "importFileParser", {
      runtime: aws_lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: Duration.seconds(30),
      handler: "import-file-parser.main",
      code: importServiceCode,
      environment: {
        IMPORT_BUCKET_NAME: importBucket.bucketName,
        CATALOG_ITEMS_QUEUE_URL: props.catalogItemsQueue.queueUrl,
      },
    });

    importBucket.grantReadWrite(importFileParser);
    props.catalogItemsQueue.grantSendMessages(importFileParser);

    importBucket.addEventNotification(
      aws_s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(importFileParser),
      { prefix: "uploaded/", suffix: ".csv" },
    );

    const api = new aws_apigateway.RestApi(this, "ImportServiceApi", {
      restApiName: "Import Service",
      description: "Import Service API",
      deployOptions: { stageName: "dev" },
      defaultCorsPreflightOptions: {
        allowOrigins: aws_apigateway.Cors.ALL_ORIGINS,
        allowMethods: ["GET", "OPTIONS"],
      },
    });

    const importResource = api.root.addResource("import");
    importResource.addMethod(
      "GET",
      new aws_apigateway.LambdaIntegration(importProductsFile),
    );

    new CfnOutput(this, "ImportServiceBucketName", {
      value: importBucket.bucketName,
      description: "S3 bucket for CSV imports (uploaded/ prefix)",
      exportName: "ImportServiceBucketName",
    });

    new CfnOutput(this, "ImportServiceApiUrl", {
      value: api.url.replace(/\/$/, ""),
      description: "Base URL for Import Service (append /import)",
      exportName: "ImportServiceApiUrl",
    });
  }
}
