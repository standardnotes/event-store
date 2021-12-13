import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'events' })
export class Event {
  @PrimaryGeneratedColumn('uuid')
  uuid: string

  @Column({
    name: 'user_identifier',
    length: 255,
  })
  @Index('index_events_on_user_identifier')
  userIdentifier: string

  @Column({
    name: 'user_identifier_type',
    length: 255,
  })
  userIdentifierType: string

  @Column({
    name: 'event_type',
    length: 255,
  })
  eventType: string

  @Column({
    name: 'event_payload',
    type: 'text',
  })
  eventPayload: string

  @Column({
    name: 'timestamp',
    type: 'bigint',
  })
  timestamp: number
}
