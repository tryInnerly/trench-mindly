import {
  authenticatedPost,
  getRandomID,
  PUBLIC_API_KEY,
  waitForQueryResults,
} from './utils'

describe('events/ deduplication', () => {
  test('should reject a duplicate event with the same messageId', async () => {
    const messageId = getRandomID()

    // First request: event should be accepted
    const firstRes = await authenticatedPost('/events', PUBLIC_API_KEY).send({
      events: [
        {
          type: 'track',
          event: 'DedupTest',
          messageId,
          timestamp: new Date().toISOString(),
        },
      ],
    })
    expect(firstRes.statusCode).toEqual(201)
    expect(firstRes.body.results).toHaveLength(1)
    expect(firstRes.body.results[0].uuid).toEqual(messageId)

    // Second request with the same messageId: event should be filtered out
    const secondRes = await authenticatedPost('/events', PUBLIC_API_KEY).send({
      events: [
        {
          type: 'track',
          event: 'DedupTest',
          messageId,
          timestamp: new Date().toISOString(),
        },
      ],
    })
    expect(secondRes.statusCode).toEqual(201)
    expect(secondRes.body.results).toHaveLength(0)
    expect(secondRes.body.total).toEqual(0)

    // Verify only one event persisted in ClickHouse
    const queryResults = await waitForQueryResults(`uuid=${messageId}`)
    expect(queryResults.results).toHaveLength(1)
    expect(queryResults.results[0].uuid).toEqual(messageId)
  })

  test('should accept events with different messageIds', async () => {
    const messageIdA = getRandomID()
    const messageIdB = getRandomID()

    // Send first event
    const resA = await authenticatedPost('/events', PUBLIC_API_KEY).send({
      events: [
        {
          type: 'track',
          event: 'DedupDiffA',
          messageId: messageIdA,
          timestamp: new Date().toISOString(),
        },
      ],
    })
    expect(resA.statusCode).toEqual(201)
    expect(resA.body.results).toHaveLength(1)
    expect(resA.body.results[0].uuid).toEqual(messageIdA)

    // Send second event
    const resB = await authenticatedPost('/events', PUBLIC_API_KEY).send({
      events: [
        {
          type: 'track',
          event: 'DedupDiffB',
          messageId: messageIdB,
          timestamp: new Date().toISOString(),
        },
      ],
    })
    expect(resB.statusCode).toEqual(201)
    expect(resB.body.results).toHaveLength(1)
    expect(resB.body.results[0].uuid).toEqual(messageIdB)

    // Both events should be queryable
    const queryA = await waitForQueryResults(`uuid=${messageIdA}`)
    expect(queryA.results).toHaveLength(1)
    expect(queryA.results[0].uuid).toEqual(messageIdA)

    const queryB = await waitForQueryResults(`uuid=${messageIdB}`)
    expect(queryB.results).toHaveLength(1)
    expect(queryB.results[0].uuid).toEqual(messageIdB)
  })

  test('should auto-generate uuid when messageId is not provided', async () => {
    const res = await authenticatedPost('/events', PUBLIC_API_KEY).send({
      events: [
        {
          type: 'track',
          event: 'DedupNoMessageId',
          timestamp: new Date().toISOString(),
        },
      ],
    })
    expect(res.statusCode).toEqual(201)
    expect(res.body.results).toHaveLength(1)

    const uuid = res.body.results[0].uuid
    expect(uuid).toBeDefined()
    expect(typeof uuid).toBe('string')
    expect(uuid.length).toBeGreaterThan(0)

    // The auto-generated uuid should be queryable
    const queryResults = await waitForQueryResults(`uuid=${uuid}`)
    expect(queryResults.results).toHaveLength(1)
    expect(queryResults.results[0].uuid).toEqual(uuid)
  })
})
