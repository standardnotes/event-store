import { TimerInterface } from '@standardnotes/time'
import { Connection, Repository } from 'typeorm'
import { EventHandler } from './EventHandler'
import { Event } from '../Event/Event'
import { DomainEventInterface } from '@standardnotes/domain-events'

describe('EventHandler', () => {
  let timer: TimerInterface
  let db: Connection
  let repository: Repository<Event>

  const createHandler = () => new EventHandler(
    timer,
    db
  )

  beforeEach(() => {
    timer = {} as jest.Mocked<TimerInterface>
    timer.convertStringDateToMicroseconds = jest.fn().mockReturnValue(1)

    repository = {} as jest.Mocked<Repository<Event>>
    repository.save = jest.fn()

    db = {} as jest.Mocked<Connection>
    db.getRepository = jest.fn().mockReturnValue(repository)
  })

  it('should persist as event in the store', async () => {
    const event = {
      type: 'test',
      createdAt: new Date(2),
      meta: {
        correlation: {
          userIdentifier: '1-2-3',
          userIdentifierType: 'uuid',
        },
      },
      payload: {
        foo: 'bar',
      },
    } as jest.Mocked<DomainEventInterface>
    await createHandler().handle(event)

    expect(repository.save).toHaveBeenCalledWith({
      eventType: 'test',
      timestamp: 1,
      userIdentifier: '1-2-3',
      userIdentifierType: 'uuid',
      eventPayload: '{"foo":"bar"}',
    })
  })
})
