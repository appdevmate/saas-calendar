import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import { Construct } from "constructs";

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─── Database ─────────────────────────────────────────────
    const table = new dynamodb.Table(this, "CalendarTable", {
      tableName: "CalendarPlatform",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ─── SQS ──────────────────────────────────────────────────
    const webhookQueue = new sqs.Queue(this, "WebhookQueue", {
      queueName: "saas-calendar-webhooks",
      visibilityTimeout: cdk.Duration.seconds(60),
      deadLetterQueue: {
        queue: new sqs.Queue(this, "WebhookDLQ", {
          queueName: "saas-calendar-webhooks-dlq",
        }),
        maxReceiveCount: 3,
      },
    });

    new cdk.CfnOutput(this, "WebhookQueueUrl", {
      value: webhookQueue.queueUrl,
    });

    // ─── Lambda Functions ─────────────────────────────────────
    const healthFn = new lambda.Function(this, "HealthFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "health.handler",
      code: lambda.Code.fromAsset("lambda"),
    });

    const calendarsFn = new lambda.Function(this, "CalendarsFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "calendars.handler",
      code: lambda.Code.fromAsset("lambda"),
      environment: {
        TABLE_NAME: table.tableName,
        WEBHOOK_QUEUE_URL: webhookQueue.queueUrl,
      },
    });

    const webhooksFn = new lambda.Function(this, "WebhooksFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "webhooks.handler",
      code: lambda.Code.fromAsset("lambda"),
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    const webhookFn = new lambda.Function(this, "WebhookFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "webhook.handler",
      code: lambda.Code.fromAsset("lambda"),
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    const wsFn = new lambda.Function(this, "WebSocketFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "websocket.handler",
      code: lambda.Code.fromAsset("lambda"),
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    const publicFn = new lambda.Function(this, "PublicFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "public.handler",
      code: lambda.Code.fromAsset("lambda"),
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    const eventsFn = new lambda.Function(this, "EventsFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "events.handler",
      code: lambda.Code.fromAsset("lambda"),
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    // ─── Permissions ──────────────────────────────────────────
    table.grantReadWriteData(calendarsFn);
    table.grantReadWriteData(webhooksFn);
    table.grantReadWriteData(webhookFn);
    table.grantReadWriteData(wsFn);
    table.grantReadWriteData(publicFn);
    table.grantReadWriteData(eventsFn);

    webhookQueue.grantSendMessages(calendarsFn);
    webhookQueue.grantConsumeMessages(webhookFn);
    webhookFn.addEventSource(
      new lambdaEventSources.SqsEventSource(webhookQueue, { batchSize: 1 }),
    );

    // ─── WebSocket API ────────────────────────────────────────
    const wsApi = new apigw.WebSocketApi(this, "WebSocketApi", {
      connectRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration(
          "WsConnect",
          wsFn,
        ),
      },
      disconnectRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration(
          "WsDisconnect",
          wsFn,
        ),
      },
      defaultRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration(
          "WsDefault",
          wsFn,
        ),
      },
    });

    const wsStage = new apigw.WebSocketStage(this, "WebSocketStage", {
      webSocketApi: wsApi,
      stageName: "prod",
      autoDeploy: true,
    });

    calendarsFn.addEnvironment(
      "WS_ENDPOINT",
      `https://${wsApi.apiId}.execute-api.${this.region}.amazonaws.com/prod`,
    );

    calendarsFn.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["execute-api:ManageConnections"],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${wsApi.apiId}/*`,
        ],
      }),
    );

    wsFn.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["execute-api:ManageConnections"],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${wsApi.apiId}/*`,
        ],
      }),
    );

    new cdk.CfnOutput(this, "WebSocketUrl", { value: wsStage.url });

    // ─── HTTP API ─────────────────────────────────────────────
    const api = new apigw.HttpApi(this, "HttpApi", {
      apiName: "saas-calendar-api",
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [apigw.CorsHttpMethod.ANY],
        allowHeaders: ["*"],
      },
    });

    api.addRoutes({
      path: "/health",
      methods: [apigw.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        "HealthIntegration",
        healthFn,
      ),
    });

    api.addRoutes({
      path: "/calendars",
      methods: [apigw.HttpMethod.GET, apigw.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        "CalendarsIntegration",
        calendarsFn,
      ),
    });

    api.addRoutes({
  path: '/calendars/{calendarId}',
  methods: [apigw.HttpMethod.DELETE],
  integration: new integrations.HttpLambdaIntegration('CalendarDeleteIntegration', calendarsFn),
});

    api.addRoutes({
      path: "/webhooks",
      methods: [apigw.HttpMethod.GET, apigw.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        "WebhooksIntegration",
        webhooksFn,
      ),
    });

    api.addRoutes({
      path: "/public/calendars/{calendarId}/publish",
      methods: [apigw.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        "PublishIntegration",
        publicFn,
      ),
    });

    api.addRoutes({
      path: "/public/view/{token}",
      methods: [apigw.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        "PublicViewIntegration",
        publicFn,
      ),
    });

    api.addRoutes({
      path: "/calendars/{calendarId}/events",
      methods: [apigw.HttpMethod.GET, apigw.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        "EventsIntegration",
        eventsFn,
      ),
    });

    new cdk.CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
  }
}
// UserPoolId       = us-east-1_DUU2CHb3y
// UserPoolClientId = om01quonh9bgk7fvg3jbmq96n
// ApiUrl           = https://od8gx8kld8.execute-api.us-east-1.amazonaws.com
// WebSocketUrl = wss://99zfgz6v71.execute-api.us-east-1.amazonaws.com/prod
