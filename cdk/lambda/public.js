const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function getTenantId(event) {
  try {
    const token = event.headers?.authorization?.replace("Bearer ", "");
    if (!token) return "tenant-default";
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString(),
    );
    return payload.sub;
  } catch {
    return "tenant-default";
  }
}

exports.handler = async (event) => {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  try {
    // POST /public/calendars/:calendarId/publish — generate public token
    if (method === "POST" && path.includes("/publish")) {
      const calendarId = event.pathParameters?.calendarId;
      const tenantId = getTenantId(event);
      const token = randomUUID();

      await client.send(
        new PutCommand({
          TableName: process.env.TABLE_NAME,
          Item: {
            PK: `PUBLIC#${token}`,
            SK: "METADATA",
            token,
            calendarId,
            tenantId,
            createdAt: new Date().toISOString(),
          },
        }),
      );

      return {
        statusCode: 201,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, publicUrl: `/public/view/${token}` }),
      };
    }

    // GET /public/view/:token — get public calendar events
    if (method === "GET" && path.includes("/view")) {
      const token = event.pathParameters?.token;

      // Resolve token to calendarId
      const tokenRecord = await client.send(
        new GetCommand({
          TableName: process.env.TABLE_NAME,
          Key: { PK: `PUBLIC#${token}`, SK: "METADATA" },
        }),
      );

      if (!tokenRecord.Item) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Not found" }),
        };
      }

      const { tenantId, calendarId } = tokenRecord.Item;

      // Get events for this calendar
      const result = await client.send(
        new QueryCommand({
          TableName: process.env.TABLE_NAME,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
          ExpressionAttributeValues: {
            ":pk": `TENANT#${tenantId}#CAL#${calendarId}`,
            ":sk": "EVENT#",
          },
        }),
      );

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarId,
          events: result.Items || [],
        }),
      };
    }
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
