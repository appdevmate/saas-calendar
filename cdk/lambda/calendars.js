const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");
const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");
const { randomUUID } = require("crypto");
const sqsClient = new SQSClient({});
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function getTenantId(event) {
  return event.headers?.['x-api-key'] || 'tenant-default';
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,x-api-key,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,PATCH,OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  const method = event.requestContext.http.method;
  const tenantId = getTenantId(event);

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  try {
    if (method === "POST") {
      const body = JSON.parse(event.body);
      const calendarId = randomUUID();
      const newCalendar = {
        PK: `TENANT#${tenantId}`,
        SK: `CAL#${calendarId}`,
        calendarId,
        name: body.name,
        description: body.description || "",
        createdAt: new Date().toISOString(),
      };
      await client.send(new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: newCalendar,
      }));
      await broadcast(newCalendar);
      if (process.env.WEBHOOK_QUEUE_URL) {
        await sqsClient.send(new SendMessageCommand({
          QueueUrl: process.env.WEBHOOK_QUEUE_URL,
          MessageBody: JSON.stringify({
            tenantId,
            eventType: "CALENDAR_CREATED",
            data: newCalendar,
          }),
        }));
      }
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ calendarId, name: body.name }),
      };
    }

    if (method === "DELETE") {
      const calendarId = event.pathParameters?.calendarId;
      if (!calendarId) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: "Missing calendarId" }) };
      }

      // Also delete all events belonging to this calendar
      const eventsResult = await client.send(new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `TENANT#${tenantId}#CAL#${calendarId}`,
          ":sk": "EVENT#",
        },
      }));

      // Delete all events first
      if (eventsResult.Items?.length) {
        await Promise.all(eventsResult.Items.map((item) =>
          client.send(new DeleteCommand({
            TableName: process.env.TABLE_NAME,
            Key: { PK: item.PK, SK: item.SK },
          }))
        ));
      }

      // Delete the calendar itself
      await client.send(new DeleteCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          PK: `TENANT#${tenantId}`,
          SK: `CAL#${calendarId}`,
        },
      }));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Deleted" }),
      };
    }

    if (method === "GET") {
      const result = await client.send(new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `TENANT#${tenantId}`,
          ":sk": "CAL#",
        },
      }));
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.Items),
      };
    }
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

async function broadcast(data) {
  const result = await client.send(new QueryCommand({
    TableName: process.env.TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: {
      ":pk": "CONNECTIONS",
      ":sk": "CONN#",
    },
  }));
  if (!result.Items || result.Items.length === 0) return;
  const wsClient = new ApiGatewayManagementApiClient({
    endpoint: process.env.WS_ENDPOINT,
  });
  const message = JSON.stringify({ type: "CALENDAR_CREATED", data });
  await Promise.allSettled(
    result.Items.map((conn) =>
      wsClient.send(new PostToConnectionCommand({
        ConnectionId: conn.connectionId,
        Data: Buffer.from(message),
      }))
    )
  );
}