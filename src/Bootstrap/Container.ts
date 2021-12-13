import * as AWS from 'aws-sdk'
import * as winston from 'winston'
import { Container } from 'inversify'
import { Env } from './Env'
import TYPES from './Types'
import { Connection, createConnection, LoggerOptions } from 'typeorm'
import { Event } from '../Domain/Event/Event'
import { DomainEventHandlerInterface, DomainEventMessageHandlerInterface, DomainEventSubscriberFactoryInterface } from '@standardnotes/domain-events'
import { SQSDomainEventSubscriberFactory, SQSEventMessageHandler, SQSNewRelicEventMessageHandler } from '@standardnotes/domain-events-infra'
import { Timer, TimerInterface } from '@standardnotes/time'
import { EventHandler } from '../Domain/Handler/EventHandler'

export class ContainerConfigLoader {
  async load(): Promise<Container> {
    const env: Env = new Env()
    env.load()

    const container = new Container()

    const maxQueryExecutionTime = env.get('DB_MAX_QUERY_EXECUTION_TIME', true) ?
      +env.get('DB_MAX_QUERY_EXECUTION_TIME', true) : 45_000

    container.bind<AWS.SQS>(TYPES.SQS).toConstantValue(new AWS.SQS({
      apiVersion: 'latest',
      region: env.get('SQS_AWS_REGION', true),
    }))

    const connection: Connection = await createConnection({
      type: 'mysql',
      supportBigNumbers: true,
      bigNumberStrings: false,
      maxQueryExecutionTime,
      replication: {
        master: {
          host: env.get('DB_HOST'),
          port: parseInt(env.get('DB_PORT')),
          username: env.get('DB_USERNAME'),
          password: env.get('DB_PASSWORD'),
          database: env.get('DB_DATABASE'),
        },
        slaves: [
          {
            host: env.get('DB_REPLICA_HOST'),
            port: parseInt(env.get('DB_PORT')),
            username: env.get('DB_USERNAME'),
            password: env.get('DB_PASSWORD'),
            database: env.get('DB_DATABASE'),
          },
        ],
        removeNodeErrorCount: 10,
      },
      entities: [
        Event,
      ],
      migrations: [
        env.get('DB_MIGRATIONS_PATH'),
      ],
      migrationsRun: true,
      logging: <LoggerOptions> env.get('DB_DEBUG_LEVEL'),
    })
    container.bind<Connection>(TYPES.DBConnection).toConstantValue(connection)

    const logger = winston.createLogger({
      level: env.get('LOG_LEVEL') || 'info',
      format: winston.format.combine(
        winston.format.splat(),
        winston.format.json(),
      ),
      transports: [
        new winston.transports.Console({ level: env.get('LOG_LEVEL') || 'info' }),
      ],
    })
    container.bind<winston.Logger>(TYPES.Logger).toConstantValue(logger)

    container.bind<AWS.SQS>(TYPES.SQS).toConstantValue(new AWS.SQS({
      apiVersion: 'latest',
      region: env.get('AWS_REGION', true),
    }))

    container.bind<TimerInterface>(TYPES.Timer).toConstantValue(new Timer())

    // env vars
    container.bind(TYPES.SQS_AWS_REGION).toConstantValue(env.get('SQS_AWS_REGION'))
    container.bind(TYPES.SQS_QUEUE_URL).toConstantValue(env.get('SQS_QUEUE_URL'))

    // Handlers
    container.bind<EventHandler>(TYPES.EventHandler).to(EventHandler)

    const eventHandlers: Map<string, DomainEventHandlerInterface> = new Map([
      ['USER_REGISTERED', container.get(TYPES.EventHandler)],
      ['ACCOUNT_DELETION_REQUESTED', container.get(TYPES.EventHandler)],
      ['SUBSCRIPTION_PURCHASED', container.get(TYPES.EventHandler)],
      ['SUBSCRIPTION_CANCELLED', container.get(TYPES.EventHandler)],
      ['SUBSCRIPTION_RENEWED', container.get(TYPES.EventHandler)],
      ['SUBSCRIPTION_REFUNDED', container.get(TYPES.EventHandler)],
      ['SUBSCRIPTION_EXPIRED', container.get(TYPES.EventHandler)],
      ['EXTENSION_KEY_GRANTED', container.get(TYPES.EventHandler)],
      ['SUBSCRIPTION_REASSIGNED', container.get(TYPES.EventHandler)],
      ['USER_EMAIL_CHANGED', container.get(TYPES.EventHandler)],
    ])

    container.bind<DomainEventMessageHandlerInterface>(TYPES.DomainEventMessageHandler).toConstantValue(
      env.get('NEW_RELIC_ENABLED', true) === 'true' ?
        new SQSNewRelicEventMessageHandler(eventHandlers, container.get(TYPES.Logger)) :
        new SQSEventMessageHandler(eventHandlers, container.get(TYPES.Logger))
    )
    container.bind<DomainEventSubscriberFactoryInterface>(TYPES.DomainEventSubscriberFactory).toConstantValue(
      new SQSDomainEventSubscriberFactory(
        container.get(TYPES.SQS),
        container.get(TYPES.SQS_QUEUE_URL),
        container.get(TYPES.DomainEventMessageHandler)
      )
    )

    return container
  }
}
