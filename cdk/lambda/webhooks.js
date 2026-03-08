const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function getTenantId(event) {
  return event.headers?.['x-api-key'] || 'tenant-default';
}

exports.handler = async (event) => {
  const method = event.requestContext.http.method;
  const tenantId = getTenantId(event);

  try {
    if (method === "POST") {
      const body = JSON.parse(event.body);
      const webhookId = randomUUID();

      await client.send(
        new PutCommand({
          TableName: process.env.TABLE_NAME,
          Item: {
            PK: `TENANT#${tenantId}`,
            SK: `WEBHOOK#${webhookId}`,
            webhookId,
            url: body.url,
            eventType: body.eventType || "CALENDAR_CREATED",
            createdAt: new Date().toISOString(),
          },
        }),
      );

      return {
        statusCode: 201,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookId, url: body.url }),
      };
    }

    if (method === "GET") {
      const result = await client.send(
        new QueryCommand({
          TableName: process.env.TABLE_NAME,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
          ExpressionAttributeValues: {
            ":pk": `TENANT#${tenantId}`,
            ":sk": "WEBHOOK#",
          },
        }),
      );

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.Items),
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
