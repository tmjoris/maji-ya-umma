// The table layout. infra/data.yaml declares the same thing for AWS; this copy
// creates the table in DynamoDB Local (npm run db:create).
//
// Single-table design. Every item has pk/sk; items that must be listed by
// customer carry gsi1pk = USER#<uid>, items listed across the whole system
// carry gsi2pk = USERS | METERS | PAYMENTS | TICKETS | CONNREQS | BILLS#<period>.
//
//   pk                    sk               gsi1 (by customer)          gsi2 (system-wide)
//   USER#uid              PROFILE                                       USERS / uid
//   METER#num             A                USER#uid / METER#num         METERS / num
//   METER#num             R#<epoch>        (readings, by time)
//   METER#num             U#<period>       USER#uid / USAGE#period#num
//   USAGETOTAL            <period>
//   BILL#<period>_<num>   A                USER#uid / BILL#period#num   BILLS#period / num
//   BILLINGRUN            <period>
//   PAYMENT#id            A                USER#uid / PAYMENT#time      PAYMENTS / time
//   CHECKOUT#checkoutId   A                (M-Pesa checkout → payment id)
//   UNMATCHED             <checkoutId>
//   TICKET#id             A | ATTACHMENT   USER#uid / TICKET#time       TICKETS / time
//   CONNREQ#id            A                USER#uid / CONNREQ#time      CONNREQS / time
//   NOTIFICATION#id       A
//
// Capacity: 8 read + 8 write units each for the table and both indexes,
// 24 + 24 in total, inside DynamoDB's always-free 25 + 25.
export const CAPACITY = { ReadCapacityUnits: 8, WriteCapacityUnits: 8 };

export const tableDefinition = (TableName) => ({
  TableName,
  BillingMode: "PROVISIONED",
  ProvisionedThroughput: CAPACITY,
  AttributeDefinitions: ["pk", "sk", "gsi1pk", "gsi1sk", "gsi2pk", "gsi2sk"].map((AttributeName) => ({ AttributeName, AttributeType: "S" })),
  KeySchema: [
    { AttributeName: "pk", KeyType: "HASH" },
    { AttributeName: "sk", KeyType: "RANGE" },
  ],
  GlobalSecondaryIndexes: ["gsi1", "gsi2"].map((IndexName) => ({
    IndexName,
    KeySchema: [
      { AttributeName: `${IndexName}pk`, KeyType: "HASH" },
      { AttributeName: `${IndexName}sk`, KeyType: "RANGE" },
    ],
    Projection: { ProjectionType: "ALL" },
    ProvisionedThroughput: CAPACITY,
  })),
});
