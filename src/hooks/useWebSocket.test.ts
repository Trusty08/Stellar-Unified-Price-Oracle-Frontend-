import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWebSocket } from './useWebSocket'

const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
const mockSubscribe = vi.fn()
const mockUnsubscribe = vi.fn()
const mockOnStatusChange = vi.fn(() => vi.fn())
const mockOnMessage = vi.fn(() => vi.fn())

vi.mock('../api/websocket', () => ({
  WebSocketClient: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    disconnect: mockDisconnect,
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    onStatusChange: mockOnStatusChange,
    onMessage: mockOnMessage,
  })),
}))

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with disconnected status and empty prices', () => {
    const { result } = renderHook(() => useWebSocket())
    expect(result.current.status).toBe('disconnected')
    expect(result.current.livePrices.size).toBe(0)
  })

  it('connects to WebSocket on mount', () => {
    renderHook(() => useWebSocket())
    expect(mockConnect).toHaveBeenCalledTimes(1)
  })

  it('subscribes to status changes', () => {
    renderHook(() => useWebSocket())
    expect(mockOnStatusChange).toHaveBeenCalledTimes(1)
    expect(mockOnStatusChange).toHaveBeenCalledWith(expect.any(Function))
  })

  it('subscribes to messages', () => {
    renderHook(() => useWebSocket())
    expect(mockOnMessage).toHaveBeenCalledTimes(1)
    expect(mockOnMessage).toHaveBeenCalledWith(expect.any(Function))
  })

  it('updates status when WebSocket status changes', async () => {
    let statusCallback: ((status: string) => void) | undefined
    mockOnStatusChange.mockImplementation((cb) => {
      statusCallback = cb
      return vi.fn()
    })

    const { result } = renderHook(() => useWebSocket())

    act(() => {
      statusCallback?.('connecting')
    })

    await waitFor(() => {
      expect(result.current.status).toBe('connecting')
    })

    act(() => {
      statusCallback?.('connected')
    })

    await waitFor(() => {
      expect(result.current.status).toBe('connected')
    })
  })

  it('updates livePrices on price_update messages', async () => {
    let messageCallback: ((msg: any) => void) | undefined
    mockOnMessage.mockImplementation((cb) => {
      messageCallback = cb
      return vi.fn()
    })

    const { result } = renderHook(() => useWebSocket())

    const priceUpdate = {
      type: 'price_update',
      assetPair: 'BTC/USD',
      price: 50000,
      timestamp: Date.now(),
      confidence: 0.99,
      sources: ['chainlink'],
    }

    act(() => {
      messageCallback?.(priceUpdate)
    })

    await waitFor(() => {
      expect(result.current.livePrices.size).toBe(1)
      expect(result.current.livePrices.get('BTC/USD')).toEqual({
        assetPair: 'BTC/USD',
        price: 50000,
        timestamp: priceUpdate.timestamp,
        confidence: 0.99,
        sources: ['chainlink'],
      })
    })
  })

  it('updates existing prices on subsequent updates', async () => {
    let messageCallback: ((msg: any) => void) | undefined
    mockOnMessage.mockImplementation((cb) => {
      messageCallback = cb
      return vi.fn()
    })

    const { result } = renderHook(() => useWebSocket())

    const firstUpdate = {
      type: 'price_update',
      assetPair: 'BTC/USD',
      price: 50000,
      timestamp: Date.now(),
      confidence: 0.99,
      sources: ['chainlink'],
    }

    act(() => {
      messageCallback?.(firstUpdate)
    })

    await waitFor(() => {
      expect(result.current.livePrices.get('BTC/USD')?.price).toBe(50000)
    })

    const secondUpdate = {
      type: 'price_update',
      assetPair: 'BTC/USD',
      price: 51000,
      timestamp: Date.now(),
      confidence: 0.98,
      sources: ['chainlink', 'redstone'],
    }

    act(() => {
      messageCallback?.(secondUpdate)
    })

    await waitFor(() => {
      expect(result.current.livePrices.get('BTC/USD')?.price).toBe(51000)
      expect(result.current.livePrices.get('BTC/USD')?.confidence).toBe(0.98)
    })
  })

  it('ignores non-price_update messages', async () => {
    let messageCallback: ((msg: any) => void) | undefined
    mockOnMessage.mockImplementation((cb) => {
      messageCallback = cb
      return vi.fn()
    })

    const { result } = renderHook(() => useWebSocket())

    act(() => {
      messageCallback?.({ type: 'other_message', data: 'test' })
    })

    await waitFor(() => {
      expect(result.current.livePrices.size).toBe(0)
    })
  })

  it('subscribes to pairs when provided', () => {
    renderHook(() => useWebSocket(['BTC/USD', 'ETH/USD']))
    expect(mockSubscribe).toHaveBeenCalledWith(['BTC/USD', 'ETH/USD'])
  })

  it('subscribes when pairs change', () => {
    const { rerender } = renderHook(({ pairs }) => useWebSocket(pairs), {
      initialProps: { pairs: undefined as string[] | undefined },
    })

    expect(mockSubscribe).not.toHaveBeenCalled()

    rerender({ pairs: ['BTC/USD'] })
    expect(mockSubscribe).toHaveBeenCalledWith(['BTC/USD'])

    rerender({ pairs: ['BTC/USD', 'ETH/USD'] })
    expect(mockSubscribe).toHaveBeenCalledWith(['BTC/USD', 'ETH/USD'])
  })

  it('provides subscribe function', () => {
    const { result } = renderHook(() => useWebSocket())
    act(() => {
      result.current.subscribe(['XLM/USD'])
    })
    expect(mockSubscribe).toHaveBeenCalledWith(['XLM/USD'])
  })

  it('provides unsubscribe function', () => {
    const { result } = renderHook(() => useWebSocket())
    act(() => {
      result.current.unsubscribe(['XLM/USD'])
    })
    expect(mockUnsubscribe).toHaveBeenCalledWith(['XLM/USD'])
  })

  it('disconnects and cleans up on unmount', () => {
    const unsubStatusMock = vi.fn()
    const unsubMsgMock = vi.fn()
    mockOnStatusChange.mockReturnValue(unsubStatusMock)
    mockOnMessage.mockReturnValue(unsubMsgMock)

    const { unmount } = renderHook(() => useWebSocket())

    unmount()

    expect(unsubStatusMock).toHaveBeenCalledTimes(1)
    expect(unsubMsgMock).toHaveBeenCalledTimes(1)
    expect(mockDisconnect).toHaveBeenCalledTimes(1)
  })

  it('handles multiple price pairs concurrently', async () => {
    let messageCallback: ((msg: any) => void) | undefined
    mockOnMessage.mockImplementation((cb) => {
      messageCallback = cb
      return vi.fn()
    })

    const { result } = renderHook(() => useWebSocket())

    const btcUpdate = {
      type: 'price_update',
      assetPair: 'BTC/USD',
      price: 50000,
      timestamp: Date.now(),
      confidence: 0.99,
      sources: ['chainlink'],
    }

    const ethUpdate = {
      type: 'price_update',
      assetPair: 'ETH/USD',
      price: 3000,
      timestamp: Date.now(),
      confidence: 0.95,
      sources: ['redstone'],
    }

    act(() => {
      messageCallback?.(btcUpdate)
      messageCallback?.(ethUpdate)
    })

    await waitFor(() => {
      expect(result.current.livePrices.size).toBe(2)
      expect(result.current.livePrices.get('BTC/USD')?.price).toBe(50000)
      expect(result.current.livePrices.get('ETH/USD')?.price).toBe(3000)
    })
  })
})
