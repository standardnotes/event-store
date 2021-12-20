import { DomainEventHandlerInterface, DomainEventInterface } from '@standardnotes/domain-events'
import { TimerInterface } from '@standardnotes/time'
import { inject, injectable } from 'inversify'
import { Connection } from 'typeorm'
import { Logger } from 'winston'
import TYPES from '../../Bootstrap/Types'
import { Event } from '../Event/Event'

@injectable()
export class EventHandler implements DomainEventHandlerInterface {
  constructor(
    @inject(TYPES.Timer) private timer: TimerInterface,
    @inject(TYPES.DBConnection) private db: Connection,
    @inject(TYPES.Logger) private logger: Logger
  ) {
  }

  async handle(event: DomainEventInterface): Promise<void> {
    this.logger.debug('Handling event: %O', event)

    const storedEvent = new Event()
    storedEvent.eventType = event.type
    storedEvent.userIdentifier = event.meta.correlation.userIdentifier
    storedEvent.userIdentifierType = event.meta.correlation.userIdentifierType
    storedEvent.eventPayload = JSON.stringify(event.payload)
    storedEvent.timestamp = this.timer.convertStringDateToMicroseconds(event.createdAt.toString())

    await this.db.getRepository(Event).save(storedEvent)
  }
}
