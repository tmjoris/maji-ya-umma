import "../env.js";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  TransactWriteCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";

// One DynamoDB table holds everything (single-table design, see schema.js).
// DYNAMODB_ENDPOINT points at DynamoDB Local for development and tests.
export const TABLE = process.env.DYNAMODB_TABLE || "maji-ya-umma";
const localEndpoint = process.env.DYNAMODB_ENDPOINT;

export const rawClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "eu-west-1",
  // Capacity is provisioned small to stay in the free tier; throttled
  // requests back off and retry instead of failing.
  maxAttempts: 10,
  ...(localEndpoint ? { endpoint: localEndpoint, credentials: { accessKeyId: "local", secretAccessKey: "local" } } : {}),
});

export const ddb = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true },
});

export const now = () => new Date().toISOString();

// ---------- keys ----------

const pad = (n) => String(n).padStart(15, "0");

export const K = {
  user: (uid) => ({ pk: `USER#${uid}`, sk: "PROFILE" }),
  meter: (meterNumber) => ({ pk: `METER#${meterNumber}`, sk: "A" }),
  reading: (meterNumber, epochMs) => ({ pk: `METER#${meterNumber}`, sk: `R#${pad(epochMs)}` }),
  usage: (meterNumber, period) => ({ pk: `METER#${meterNumber}`, sk: `U#${period}` }),
  usageTotal: (period) => ({ pk: "USAGETOTAL", sk: period }),
  bill: (billId) => ({ pk: `BILL#${billId}`, sk: "A" }),
  billingRun: (period) => ({ pk: "BILLINGRUN", sk: period }),
  payment: (id) => ({ pk: `PAYMENT#${id}`, sk: "A" }),
  checkout: (checkoutRequestId) => ({ pk: `CHECKOUT#${checkoutRequestId}`, sk: "A" }),
  unmatched: (checkoutRequestId) => ({ pk: "UNMATCHED", sk: checkoutRequestId }),
  ticket: (id) => ({ pk: `TICKET#${id}`, sk: "A" }),
  ticketAttachment: (id) => ({ pk: `TICKET#${id}`, sk: "ATTACHMENT" }),
  connectionRequest: (id) => ({ pk: `CONNREQ#${id}`, sk: "A" }),
  notification: (id) => ({ pk: `NOTIFICATION#${id}`, sk: "A" }),
};

// Strips the storage-only attributes before an item leaves the data layer.
const INTERNAL = new Set(["pk", "sk", "gsi1pk", "gsi1sk", "gsi2pk", "gsi2sk", "entity", "version", "openBills"]);
export function clean(item) {
  if (!item) return null;
  return Object.fromEntries(Object.entries(item).filter(([k]) => !INTERNAL.has(k)));
}

// ---------- single-item operations ----------

export async function get(key) {
  const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: key, ConsistentRead: true }));
  return res.Item ?? null;
}

export async function getMany(keys) {
  const found = new Map();
  for (let i = 0; i < keys.length; i += 100) {
    let request = { [TABLE]: { Keys: keys.slice(i, i + 100), ConsistentRead: true } };
    while (request && Object.keys(request).length) {
      const res = await ddb.send(new BatchGetCommand({ RequestItems: request }));
      for (const item of res.Responses?.[TABLE] ?? []) found.set(`${item.pk}|${item.sk}`, item);
      request = res.UnprocessedKeys;
    }
  }
  return keys.map((k) => found.get(`${k.pk}|${k.sk}`) ?? null);
}

export async function put(item) {
  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
}

// Creates the item unless one with the same key exists. Returns false if it did.
export async function putIfAbsent(item) {
  try {
    await ddb.send(new PutCommand({ TableName: TABLE, Item: item, ConditionExpression: "attribute_not_exists(pk)" }));
    return true;
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") return false;
    throw err;
  }
}

// Builds an UpdateItem request from plain objects:
//   set: { field: value }, setIfAbsent, add: { counter: n }, append: { list: [..] }, remove: [field]
//   condition: "…" using #names/:values passed in names/values.
export function updateParams(key, { set = {}, setIfAbsent = {}, add = {}, append = {}, remove = [], condition, names = {}, values = {} } = {}) {
  const N = { ...names };
  const V = { ...values };
  let i = 0;
  const name = (field) => {
    const k = `#f${i++}`;
    N[k] = field;
    return k;
  };
  const value = (v) => {
    const k = `:v${i++}`;
    V[k] = v;
    return k;
  };

  const sets = [
    ...Object.entries(set).map(([f, v]) => `${name(f)} = ${value(v)}`),
    ...Object.entries(setIfAbsent).map(([f, v]) => {
      const n = name(f);
      return `${n} = if_not_exists(${n}, ${value(v)})`;
    }),
    ...Object.entries(append).map(([f, v]) => {
      const n = name(f);
      return `${n} = list_append(if_not_exists(${n}, ${value([])}), ${value(v)})`;
    }),
  ];
  const adds = Object.entries(add).map(([f, v]) => `${name(f)} ${value(v)}`);
  const removes = remove.map((f) => name(f));

  const expression = [
    sets.length && `SET ${sets.join(", ")}`,
    adds.length && `ADD ${adds.join(", ")}`,
    removes.length && `REMOVE ${removes.join(", ")}`,
  ].filter(Boolean).join(" ");

  return {
    TableName: TABLE,
    Key: key,
    UpdateExpression: expression,
    ...(condition ? { ConditionExpression: condition } : {}),
    ...(Object.keys(N).length ? { ExpressionAttributeNames: N } : {}),
    ...(Object.keys(V).length ? { ExpressionAttributeValues: V } : {}),
  };
}

export async function update(key, opts) {
  const res = await ddb.send(new UpdateCommand({ ...updateParams(key, opts), ReturnValues: "ALL_NEW" }));
  return res.Attributes;
}

// ---------- queries ----------

// Query the table or an index ("gsi1" / "gsi2") by partition key, optionally
// narrowing the sort key. Follows pagination; `filter` runs in memory.
export async function query({ index, pk, prefix, before, after, from, desc = false, limit, filter, consistent = false }) {
  const pkAttr = index ? `${index}pk` : "pk";
  const skAttr = index ? `${index}sk` : "sk";
  const N = { "#pk": pkAttr };
  const V = { ":pk": pk };
  let condition = "#pk = :pk";
  const sk = (op, val) => {
    N["#sk"] = skAttr;
    V[":sk"] = val;
    condition += op === "begins_with" ? " AND begins_with(#sk, :sk)" : ` AND #sk ${op} :sk`;
  };
  if (prefix !== undefined) sk("begins_with", prefix);
  else if (before !== undefined) sk("<", before);
  else if (after !== undefined) sk(">", after);
  else if (from !== undefined) sk(">=", from);

  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: index,
        KeyConditionExpression: condition,
        ExpressionAttributeNames: N,
        ExpressionAttributeValues: V,
        ScanIndexForward: !desc,
        ExclusiveStartKey,
        ...(index ? {} : { ConsistentRead: consistent }),
        ...(limit ? { Limit: limit - items.length } : {}),
      })
    );
    items.push(...(res.Items ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey && (!limit || items.length < limit));
  return filter ? items.filter(filter) : items;
}

// ---------- transactions ----------

// Customer items carry a version number that every balance/open-bills change
// bumps. Writes depending on what was read are made conditional on it.
export const versionCondition = (item) =>
  item.version === undefined
    ? { condition: "attribute_not_exists(#ver)", names: { "#ver": "version" }, values: {} }
    : { condition: "#ver = :ver", names: { "#ver": "version" }, values: { ":ver": item.version } };

export const tx = {
  put: (item, condition = "attribute_not_exists(pk)") => ({
    Put: { TableName: TABLE, Item: item, ...(condition ? { ConditionExpression: condition } : {}) },
  }),
  update: (key, opts) => ({ Update: updateParams(key, opts) }),
};

export async function transact(items) {
  await ddb.send(new TransactWriteCommand({ TransactItems: items }));
}

// Per-item reasons a transaction was cancelled, e.g. ["None", "ConditionalCheckFailed"].
export const cancellationCodes = (err) => (err?.CancellationReasons ?? []).map((r) => r.Code);

const RETRYABLE = new Set(["TransactionCanceledException", "ConditionalCheckFailedException", "TransactionConflictException"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Optimistic concurrency: `fn` reads, then writes with conditions on what it
// read. If someone else changed the data in between, it runs again.
export async function retryOnConflict(fn, attempts = 10) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (!RETRYABLE.has(err?.name) || i >= attempts - 1) throw err;
      await sleep(20 * 2 ** i + Math.random() * 50);
    }
  }
}
