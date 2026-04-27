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
  },
  setupFilesAfterEnv: ["aws-cdk-lib/testhelpers/jest-autoclean"],
};
