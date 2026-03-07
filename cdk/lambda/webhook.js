const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");
const https = require("https");
const http = require("http");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

exports.handler = async (event) => {
  for (const record of event.Records) {
    const message = JSON.parse(record.body);
    const { tenantId, eventType, data } = message;

    // Get all webhook subscriptions for this tenant
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

    if (!result.Items || result.Items.length === 0) continue;

    // Deliver to each registered webhook URL
    for (const webhook of result.Items) {
      try {
        await deliver(webhook.url, { eventType, data });
        console.log(`Delivered to ${webhook.url}`);
      } catch (err) {
        console.error(`Failed to deliver to ${webhook.url}:`, err.message);
        throw err; // SQS will retry
      }
    }
  }
};

function deliver(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const urlObj = new URL(url);
    const lib = urlObj.protocol === "https:" ? https : http;

    const req = lib.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        res.statusCode >= 200 && res.statusCode < 300
          ? resolve(res)
          : reject(new Error(`Status ${res.statusCode}`));
      },
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
