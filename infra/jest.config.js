module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  /**
   * Jest cannot execute the real AWS SDK v3 (transitive ESM). Tests map `@aws-sdk/*` to
   * `test/stubs/*`; product-service tests use `aws-sdk-client-mock` on the stub
   * `DynamoDBDocumentClient` / command classes (`get-products-*.test.ts`, `create-product.test.ts`).
   */
  moduleNameMapper: {
    "^@aws-sdk/client-dynamodb$": "<rootDir>/test/stubs/aws-client-dynamodb.ts",
    "^@aws-sdk/lib-dynamodb$": "<rootDir>/test/stubs/aws-lib-dynamodb.ts",
    "^@aws-sdk/client-s3$": "<rootDir>/test/stubs/aws-client-s3.ts",
    "^@aws-sdk/client-sns$": "<rootDir>/test/stubs/aws-client-sns.ts",
    "^@aws-sdk/client-sqs$": "<rootDir>/test/stubs/aws-client-sqs.ts",
    "^@aws-sdk/s3-request-presigner$":
      "<rootDir>/test/stubs/aws-s3-request-presigner.ts",
  },
  setupFilesAfterEnv: ["aws-cdk-lib/testhelpers/jest-autoclean"],
};
