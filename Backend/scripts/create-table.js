// Creates the table in DynamoDB Local (DYNAMODB_ENDPOINT). On AWS the table
// comes from infra/data.yaml instead.
//
//   npm run db:create            # create if missing
//   npm run db:create -- --reset # delete and recreate (wipes local data)
import { CreateTableCommand, DeleteTableCommand, DescribeTableCommand, waitUntilTableExists } from "@aws-sdk/client-dynamodb";
import { rawClient, TABLE } from "../data/db.js";
import { tableDefinition } from "../data/schema.js";

if (!process.env.DYNAMODB_ENDPOINT) {
  console.error("Refusing to run: set DYNAMODB_ENDPOINT to DynamoDB Local (e.g. http://localhost:8000). On AWS, use infra/data.yaml.");
  process.exit(1);
}

const exists = await rawClient.send(new DescribeTableCommand({ TableName: TABLE })).then(() => true, () => false);
if (exists && process.argv.includes("--reset")) {
  await rawClient.send(new DeleteTableCommand({ TableName: TABLE }));
  console.log(`Deleted ${TABLE}`);
}
if (!exists || process.argv.includes("--reset")) {
  await rawClient.send(new CreateTableCommand(tableDefinition(TABLE)));
  await waitUntilTableExists({ client: rawClient, maxWaitTime: 30 }, { TableName: TABLE });
  console.log(`Created ${TABLE} at ${process.env.DYNAMODB_ENDPOINT}`);
} else {
  console.log(`${TABLE} already exists at ${process.env.DYNAMODB_ENDPOINT}`);
}
process.exit(0);
