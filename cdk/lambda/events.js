const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function getTenantId(event) {
  return event.headers?.['x-api-key'] || 'tenant-default';
}

exports.handler = async (event) => {
  const method = event.requestContext.http.method;
  const calendarId = event.pathParameters?.calendarId;
  const eventId = event.pathParameters?.eventId;
  const tenantId = getTenantId(event);

  try {
    // GET all events for a calendar
    if (method === "GET") {
      const result = await client.send(
        new QueryCommand({
          TableName: process.env.TABLE_NAME,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
          ExpressionAttributeValues: {
            ":pk": `TENANT#${tenantId}#CAL#${calendarId}`,
            ":sk": "EVENT#",
          },
        })
      );
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.Items || []),
      };
    }

    // POST — create event
    if (method === "POST") {
      const body = JSON.parse(event.body);
      const newEventId = randomUUID();
      const newEvent = {
        PK: `TENANT#${tenantId}#CAL#${calendarId}`,
        SK: `EVENT#${newEventId}`,
        eventId: newEventId,
        calendarId,
        name: body.name,
        color: body.color || "#3B82F6",
        recurrence: body.recurrence || "none",
        description: body.description || "",
        startDate: body.startDate,
        endDate: body.endDate || "",
        createdAt: new Date().toISOString(),
      };
      await client.send(new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: newEvent,
      }));
      return {
        statusCode: 201,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEvent),
      };
    }

    // PATCH — update event
    if (method === "PATCH") {
      const body = JSON.parse(event.body);
      await client.send(new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          PK: `TENANT#${tenantId}#CAL#${calendarId}`,
          SK: `EVENT#${eventId}`,
        },
        UpdateExpression: "SET #name = :name, description = :description, startDate = :startDate, endDate = :endDate, color = :color, recurrence = :recurrence",
        ExpressionAttributeNames: { "#name": "name" },
        ExpressionAttributeValues: {
          ":name": body.name,
          ":description": body.description || "",
          ":startDate": body.startDate,
          ":endDate": body.endDate || "",
          ":color": body.color || "#3B82F6",
          ":recurrence": body.recurrence || "none",
        },
      }));
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Updated" }),
      };
    }

    // DELETE — delete event
    if (method === "DELETE") {
      await client.send(new DeleteCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          PK: `TENANT#${tenantId}#CAL#${calendarId}`,
          SK: `EVENT#${eventId}`,
        },
      }));
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Deleted" }),
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