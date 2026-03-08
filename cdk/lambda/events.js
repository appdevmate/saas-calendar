const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
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
  const calendarId = event.pathParameters?.calendarId;
  const tenantId = getTenantId(event);

  try {
    if (method === "POST") {
      const body = JSON.parse(event.body);
      const eventId = randomUUID();

      const newEvent = {
        PK: `TENANT#${tenantId}#CAL#${calendarId}`,
        SK: `EVENT#${eventId}`,
        eventId,
        calendarId,
        name: body.name,
        color: body.color || "#3B82F6",
        recurrence: body.recurrence || "none",
        description: body.description || "",
        startDate: body.startDate,
        endDate: body.endDate || "",
        createdAt: new Date().toISOString(),
      };

      await client.send(
        new PutCommand({
          TableName: process.env.TABLE_NAME,
          Item: newEvent,
        }),
      );

      return {
        statusCode: 201,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEvent),
      };
    }

    if (method === "GET") {
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
        body: JSON.stringify(result.Items || []),
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
