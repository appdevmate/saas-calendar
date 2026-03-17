const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);
const TABLE = process.env.TABLE_NAME || "Hospital";

function res(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function isAdmin(event) {
  const claims =
    event.requestContext?.authorizer?.jwt?.claims ||
    event.requestContext?.authorizer?.claims ||
    {};
  const groups = claims["cognito:groups"] || "";
  const arr = Array.isArray(groups) ? groups : String(groups).split(",");
  return arr.some((g) =>
    ["admin", "Admin", "developer", "Developer"].includes(g.trim()),
  );
}

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod;

  if (method === "OPTIONS") return res(200, {});

  // Audit log is admin-only
  if (!isAdmin(event)) return res(403, { error: "Access denied: admin only" });

  const params = event.queryStringParameters || {};

  // Query by date (default: today)
  const date = params.date || new Date().toISOString().slice(0, 10);
  const entityType = params.entityType;
  const entityId = params.entityId;
  const action = params.action;
  const limit = parseInt(params.limit || "100", 10);

  let filterExp = "";
  const filterVals = {};
  const filterNames = {};

  if (entityType) {
    filterExp += (filterExp ? " AND " : "") + "#entityType = :et";
    filterNames["#entityType"] = "entityType";
    filterVals[":et"] = entityType;
  }
  if (entityId) {
    filterExp += (filterExp ? " AND " : "") + "#entityId = :eid";
    filterNames["#entityId"] = "entityId";
    filterVals[":eid"] = entityId;
  }
  if (action) {
    filterExp += (filterExp ? " AND " : "") + "#action = :act";
    filterNames["#action"] = "action";
    filterVals[":act"] = action;
  }

  const query = {
    TableName: TABLE,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": `AUDIT#${date}`,
      ":prefix": "AUDIT#",
      ...filterVals,
    },
    Limit: limit,
    ScanIndexForward: false, // newest first
  };

  if (filterExp) {
    query.FilterExpression = filterExp;
    query.ExpressionAttributeNames = filterNames;
  }

  const result = await db.send(new QueryCommand(query));

  return res(200, {
    date,
    count: (result.Items || []).length,
    items: result.Items || [],
  });
};
