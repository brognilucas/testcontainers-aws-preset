import {
  EventBridgeClient,
  PutEventsCommand,
  PutRuleCommand,
  PutTargetsCommand,
} from '@aws-sdk/client-eventbridge';
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  PurgeQueueCommand,
  SetQueueAttributesCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { LocalstackContainer } from '@testcontainers/localstack';
import type { AwsPresetCredentials, AwsPresetOptions, LocalStackAwsPreset, SharedConnection } from '../index.js';
import { validateAwsPresetOptions } from '../lib/validate-options.js';

const DEFAULT_LOCALSTACK_IMAGE = 'localstack/localstack:3.0';
const DEFAULT_RULE_NAME = 'test-rule';
const DEFAULT_QUEUE_NAME = 'test-queue';
const DEFAULT_EVENT_BUS_NAME = 'default';
const DEFAULT_CREDENTIALS: AwsPresetCredentials = {
  accessKeyId: 'test',
  secretAccessKey: 'test',
};

export interface EventBridgeSeedEvent {
  source?: string;
  detailType?: string;
  detail?: string | Record<string, unknown>;
}

export interface EventBridgeSqsPresetOptions extends AwsPresetOptions {
  /**
   * Name of the EventBridge rule to create. Defaults to 'test-rule'.
   */
  ruleName?: string;
  /**
   * Name of the SQS queue to create and use as target. Defaults to 'test-queue'.
   */
  queueName?: string;
  /**
   * Optional seed events to put on the default event bus (source defaults to 'test' to match rule).
   */
  seedEvents?: EventBridgeSeedEvent[];
}

export interface EventBridgeSqsPreset extends LocalStackAwsPreset {
  getRuleName(): string;
}

function validateEventBridgeSqsPresetOptions(
  options: unknown
): asserts options is EventBridgeSqsPresetOptions {
  validateAwsPresetOptions(options);
  const opts = options as EventBridgeSqsPresetOptions;
  if (opts !== undefined && 'ruleName' in opts && opts.ruleName !== undefined) {
    if (typeof opts.ruleName !== 'string' || opts.ruleName.trim() === '') {
      throw new Error(`ruleName must be a non-empty string when provided, got: ${typeof opts.ruleName}`);
    }
  }
  if (opts !== undefined && 'queueName' in opts && opts.queueName !== undefined) {
    if (typeof opts.queueName !== 'string' || opts.queueName.trim() === '') {
      throw new Error(`queueName must be a non-empty string when provided, got: ${typeof opts.queueName}`);
    }
  }
  if (opts !== undefined && 'seedEvents' in opts && opts.seedEvents !== undefined) {
    if (!Array.isArray(opts.seedEvents)) {
      throw new Error('seedEvents must be an array when provided');
    }
  }
}

function createSqsClient(
  connectionUri: string,
  region: string,
  credentials: AwsPresetCredentials
): SQSClient {
  return new SQSClient({ endpoint: connectionUri, region, credentials });
}

function createEventBridgeClient(
  connectionUri: string,
  region: string,
  credentials: AwsPresetCredentials
): EventBridgeClient {
  return new EventBridgeClient({ endpoint: connectionUri, region, credentials });
}

function buildSqsPolicyAllowEventBridge(ruleArn: string, queueArn: string): string {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { Service: 'events.amazonaws.com' },
        Action: 'sqs:SendMessage',
        Resource: queueArn,
        Condition: { ArnEquals: { 'aws:SourceArn': ruleArn } },
      },
    ],
  });
}

export function createEventBridgeSqsPreset(
  options?: EventBridgeSqsPresetOptions
): EventBridgeSqsPreset {
  validateEventBridgeSqsPresetOptions(options);
  const resolvedOptions: EventBridgeSqsPresetOptions = Object.freeze({
    region: 'us-east-1',
    ...(options ?? {}),
    ruleName: options?.ruleName?.trim() || DEFAULT_RULE_NAME,
    queueName: options?.queueName?.trim() || DEFAULT_QUEUE_NAME,
    seedEvents: options?.seedEvents ?? [],
  });

  let startedContainer: Awaited<ReturnType<LocalstackContainer['start']>> | null = null;
  let sharedConnection: SharedConnection | null = null;
  let ruleNameAfterStart: string | null = null;
  let queueUrlAfterStart: string | null = null;

  return {
    get options(): EventBridgeSqsPresetOptions {
      return resolvedOptions;
    },
    async start(shared?: SharedConnection): Promise<void> {
      const region = resolvedOptions.region ?? 'us-east-1';
      let connectionUri: string;
      let credentials: AwsPresetCredentials;
      if (shared) {
        sharedConnection = shared;
        connectionUri = shared.getConnectionUri();
        credentials = shared.getCredentials();
      } else {
        const container = new LocalstackContainer(DEFAULT_LOCALSTACK_IMAGE);
        startedContainer = await container.start();
        connectionUri = startedContainer.getConnectionUri();
        credentials = DEFAULT_CREDENTIALS;
      }
      const sqsClient = createSqsClient(connectionUri, shared?.getRegion() ?? region, credentials);
      const eventBridgeClient = createEventBridgeClient(
        connectionUri,
        shared?.getRegion() ?? region,
        credentials
      );

      const createQueueResponse = await sqsClient.send(
        new CreateQueueCommand({ QueueName: resolvedOptions.queueName })
      );
      const queueUrl = createQueueResponse.QueueUrl;
      if (!queueUrl) throw new Error('CreateQueue did not return QueueUrl');
      queueUrlAfterStart = queueUrl;

      const putRuleResponse = await eventBridgeClient.send(
        new PutRuleCommand({
          Name: resolvedOptions.ruleName,
          EventBusName: DEFAULT_EVENT_BUS_NAME,
          EventPattern: JSON.stringify({ source: ['test'] }),
        })
      );
      const ruleArn = putRuleResponse.RuleArn;
      if (!ruleArn) throw new Error('PutRule did not return RuleArn');
      ruleNameAfterStart = resolvedOptions.ruleName ?? DEFAULT_RULE_NAME;

      const queueAttrs = await sqsClient.send(
        new GetQueueAttributesCommand({
          QueueUrl: queueUrl,
          AttributeNames: ['QueueArn'],
        })
      );
      const queueArn = queueAttrs.Attributes?.QueueArn;
      if (!queueArn) throw new Error('GetQueueAttributes did not return QueueArn');

      const policy = buildSqsPolicyAllowEventBridge(ruleArn, queueArn);
      await sqsClient.send(
        new SetQueueAttributesCommand({
          QueueUrl: queueUrl,
          Attributes: { Policy: policy },
        })
      );

      await eventBridgeClient.send(
        new PutTargetsCommand({
          Rule: resolvedOptions.ruleName,
          EventBusName: DEFAULT_EVENT_BUS_NAME,
          Targets: [{ Id: 'sqs', Arn: queueArn }],
        })
      );
      const seedEvents = resolvedOptions.seedEvents ?? [];
      if (seedEvents.length > 0) {
        await eventBridgeClient.send(
          new PutEventsCommand({
            Entries: seedEvents.map((event) => ({
              Source: event.source ?? 'test',
              DetailType: event.detailType,
              Detail: typeof event.detail === 'string' ? event.detail : JSON.stringify(event.detail ?? {}),
              EventBusName: DEFAULT_EVENT_BUS_NAME,
            })),
          })
        );
      }
    },
    async reset(): Promise<void> {
      if (!queueUrlAfterStart) {
        throw new Error('Preset not started; call start() first');
      }
      const region = sharedConnection?.getRegion() ?? resolvedOptions.region ?? 'us-east-1';
      const credentials = sharedConnection
        ? sharedConnection.getCredentials()
        : { ...DEFAULT_CREDENTIALS };
      const connectionUri = startedContainer
        ? startedContainer.getConnectionUri()
        : sharedConnection!.getConnectionUri();
      const sqsClient = createSqsClient(connectionUri, region, credentials);
      const eventBridgeClient = createEventBridgeClient(connectionUri, region, credentials);
      await sqsClient.send(new PurgeQueueCommand({ QueueUrl: queueUrlAfterStart }));
      const seedEvents = resolvedOptions.seedEvents ?? [];
      if (seedEvents.length > 0) {
        await eventBridgeClient.send(
          new PutEventsCommand({
            Entries: seedEvents.map((event) => ({
              Source: event.source ?? 'test',
              DetailType: event.detailType,
              Detail: typeof event.detail === 'string' ? event.detail : JSON.stringify(event.detail ?? {}),
              EventBusName: DEFAULT_EVENT_BUS_NAME,
            })),
          })
        );
      }
    },
    async stop(): Promise<void> {
      if (startedContainer) {
        await startedContainer.stop();
        startedContainer = null;
      }
      sharedConnection = null;
      ruleNameAfterStart = null;
      queueUrlAfterStart = null;
    },
    getRuleName(): string {
      if (!ruleNameAfterStart) {
        throw new Error('Preset not started; call start() first');
      }
      return ruleNameAfterStart;
    },
    getConnectionUri(): string {
      if (startedContainer) return startedContainer.getConnectionUri();
      if (sharedConnection) return sharedConnection.getConnectionUri();
      throw new Error('Preset not started; call start() first');
    },
    getContainerId(): string {
      if (!startedContainer) {
        throw new Error('Preset does not own a container; call start() without shared connection first');
      }
      return startedContainer.getId();
    },
    getCredentials(): AwsPresetCredentials {
      if (sharedConnection) return sharedConnection.getCredentials();
      return { ...DEFAULT_CREDENTIALS };
    },
    getConnectionConfig() {
      return {
        endpoint: this.getConnectionUri(),
        credentials: this.getCredentials(),
        region: resolvedOptions.region ?? 'us-east-1',
      };
    },
  };
}
