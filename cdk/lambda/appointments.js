const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);
const TABLE = process.env.TABLE_NAME;

function getTenantId(event) {
  return event.headers?.["x-api-key"] || "tenant-default";
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  const tenantId = getTenantId(event);
  const method = event.requestContext.http.method;
  const appointmentId = event.pathParameters?.appointmentId;
  const PK = `TENANT#${tenantId}`;

  // GET /appointments
  if (method === "GET" && !appointmentId) {
    const result = await db.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: { ":pk": PK, ":prefix": "APPT#" },
      }),
    );
    return response(200, result.Items || []);
  }

  // GET /appointments/{appointmentId}
  if (method === "GET" && appointmentId) {
    const result = await db.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK, SK: `APPT#${appointmentId}` },
      }),
    );
    if (!result.Item) return response(404, { message: "Not found" });
    return response(200, result.Item);
  }

  // POST /appointments
  if (method === "POST") {
    const body = JSON.parse(event.body || "{}");
    const id = randomUUID();
    const item = {
      PK,
      SK: `APPT#${id}`,
      appointmentId: id,
      tenantId,
      doctorId: body.doctorId,
      doctorName: body.doctorName,
      patientId: body.patientId,
      patientName: body.patientName,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      duration: body.duration,
      type: body.type || "consultation",
      status: body.status || "scheduled",
      notes: body.notes || "",
      calendarEventId: body.calendarEventId || null,
      calendarId: body.calendarId || null,
      createdAt: new Date().toISOString(),
    };
    await db.send(new PutCommand({ TableName: TABLE, Item: item }));
    return response(201, item);
  }

  // PATCH /appointments/{appointmentId}
  if (method === "PATCH" && appointmentId) {
    const body = JSON.parse(event.body || "{}");
    const fields = [
      "doctorId",
      "doctorName",
      "patientId",
      "patientName",
      "date",
      "startTime",
      "endTime",
      "duration",
      "type",
      "status",
      "notes",
      "calendarEventId",
      "calendarId",
    ];
    const expParts = [];
    const names = {};
    const values = {};
    fields.forEach((f) => {
      if (body[f] !== undefined) {
        expParts.push(`#${f} = :${f}`);
        names[`#${f}`] = f;
        values[`:${f}`] = body[f];
      }
    });
    if (expParts.length === 0)
      return response(400, { message: "Nothing to update" });
    values[":updatedAt"] = new Date().toISOString();
    expParts.push("#updatedAt = :updatedAt");
    names["#updatedAt"] = "updatedAt";

    const result = await db.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK, SK: `APPT#${appointmentId}` },
        UpdateExpression: `SET ${expParts.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      }),
    );
    return response(200, result.Attributes);
  }

  // DELETE /appointments/{appointmentId}
  if (method === "DELETE" && appointmentId) {
    await db.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { PK, SK: `APPT#${appointmentId}` },
      }),
    );
    return response(200, { message: "Deleted" });
  }

  return response(400, { message: "Unknown route" });
};
