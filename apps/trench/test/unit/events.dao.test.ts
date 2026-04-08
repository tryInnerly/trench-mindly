import { EventsDao } from '../../src/events/events.dao'
import { EventDTO } from '../../src/events/events.interface'

jest.mock('src/services/data/kafka/kafka.util', () => ({
  getKafkaTopicFromWorkspace: jest.fn().mockReturnValue('test-topic'),
}))

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function makeEventDTO(overrides: Partial<EventDTO> = {}): EventDTO {
  return {
    type: 'track',
    event: 'Test Event',
    ...overrides,
  }
}

describe('EventsDao', () => {
  let dao: EventsDao
  let mockClickhouse: any
  let mockKafkaService: any
  const mockWorkspace = { isDefault: true, databaseName: 'test_db' } as any

  beforeEach(() => {
    mockClickhouse = {
      queryResults: jest.fn().mockResolvedValue([]),
    }
    mockKafkaService = {
      produceEvents: jest.fn().mockResolvedValue(undefined),
    }
    dao = new EventsDao(mockClickhouse, mockKafkaService)
  })

  describe('createEvents - messageId as uuid', () => {
    test('messageId provided is used as uuid in the record', async () => {
      const messageId = 'deterministic-id-123'
      const result = await dao.createEvents(mockWorkspace, [
        makeEventDTO({ messageId }),
      ])

      expect(result).toHaveLength(1)
      expect(result[0].uuid).toBe(messageId)

      const producedRecords = mockKafkaService.produceEvents.mock.calls[0][1]
      expect(producedRecords[0].uuid).toBe(messageId)
      expect(producedRecords[0].value.uuid).toBe(messageId)
    })

    test('messageId not provided generates a valid uuidv4', async () => {
      const result = await dao.createEvents(mockWorkspace, [
        makeEventDTO(),
      ])

      expect(result).toHaveLength(1)
      expect(result[0].uuid).toMatch(UUID_V4_REGEX)
    })
  })

  describe('createEvents - dedup cache', () => {
    test('duplicate messageId is filtered out', async () => {
      const messageId = 'dup-msg-001'

      await dao.createEvents(mockWorkspace, [makeEventDTO({ messageId })])
      expect(mockKafkaService.produceEvents).toHaveBeenCalledTimes(1)

      const result = await dao.createEvents(mockWorkspace, [
        makeEventDTO({ messageId }),
      ])

      expect(result).toEqual([])
      // produceEvents should NOT have been called again
      expect(mockKafkaService.produceEvents).toHaveBeenCalledTimes(1)
    })

    test('different messageId values both pass through', async () => {
      const result = await dao.createEvents(mockWorkspace, [
        makeEventDTO({ messageId: 'msg-aaa' }),
        makeEventDTO({ messageId: 'msg-bbb' }),
      ])

      expect(result).toHaveLength(2)
      expect(result[0].uuid).toBe('msg-aaa')
      expect(result[1].uuid).toBe('msg-bbb')
    })

    test('empty array after dedup returns [] and does not call produceEvents', async () => {
      const messageId = 'dup-msg-002'

      await dao.createEvents(mockWorkspace, [makeEventDTO({ messageId })])
      mockKafkaService.produceEvents.mockClear()

      const result = await dao.createEvents(mockWorkspace, [
        makeEventDTO({ messageId }),
      ])

      expect(result).toEqual([])
      expect(mockKafkaService.produceEvents).not.toHaveBeenCalled()
    })

    test('cleanup removes entries older than TTL', async () => {
      const messageId = 'old-msg-001'

      // First call to register the messageId
      await dao.createEvents(mockWorkspace, [makeEventDTO({ messageId })])
      expect(mockKafkaService.produceEvents).toHaveBeenCalledTimes(1)

      // Manually set the seenMessages entry to be older than TTL
      const seenMessages = (dao as any).seenMessages as Map<string, number>
      seenMessages.set(messageId, Date.now() - 120_000) // 2 minutes ago

      // Force lastCleanup to be old enough to trigger cleanup
      ;(dao as any).lastCleanup = Date.now() - 60_000

      // The same messageId should now pass through because cleanup removes it
      const result = await dao.createEvents(mockWorkspace, [
        makeEventDTO({ messageId }),
      ])

      expect(result).toHaveLength(1)
      expect(result[0].uuid).toBe(messageId)
      expect(mockKafkaService.produceEvents).toHaveBeenCalledTimes(2)
    })
  })
})
