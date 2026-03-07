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

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

exports.handler = async (event) => {
  const { routeKey, connectionId } = event.requestContext;

  if (routeKey === "$connect") {
    await client.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
          PK: "CONNECTIONS",
          SK: `CONN#${connectionId}`,
          connectionId,
          connectedAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + 7200, // expire after 2 hours
        },
      }),
    );
    return { statusCode: 200 };
  }

  if (routeKey === "$disconnect") {
    await client.send(
      new DeleteCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          PK: "CONNECTIONS",
          SK: `CONN#${connectionId}`,
        },
      }),
    );
    return { statusCode: 200 };
  }

  return { statusCode: 200 };
};
