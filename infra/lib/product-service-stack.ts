import {
  CfnOutput,
  Duration,
  Stack,
  type StackProps,
  aws_apigateway,
  aws_lambda,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

export class ProductServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

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
  }
}
