/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStore } from '../src/store/useStore'

// Mock dependencies
vi.mock('../src/utils/dataAccess', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    isElectron: false,
    loadProducts: vi.fn().mockResolvedValue(Array.from({ length: 1000 }, (_, i) => ({
      id: `p${i}`,
      cost: 50,
      price: 100
    }))),
    loadMembers: vi.fn().mockResolvedValue([]),
    loadOrders: vi.fn().mockResolvedValue(Array.from({ length: 10000 }, (_, i) => ({
      id: `o${i}`,
      time: new Date().toISOString(),
      total: 300,
      status: 'completed',
      items: [
        { id: `p${i % 1000}`, qty: 1, price: 100 },
        { id: `p${(i + 1) % 1000}`, qty: 1, price: 100 },
        { id: `p${(i + 2) % 1000}`, qty: 1, price: 100 }
      ]
    }))),
    loadManualJournal: vi.fn().mockResolvedValue([]),
    loadHeldOrders: vi.fn().mockResolvedValue([]),
    loadWasteLog: vi.fn().mockResolvedValue([]),
    loadTopups: vi.fn().mockResolvedValue([]),
    getSetting: vi.fn().mockResolvedValue(null),
    loadCashLogs: vi.fn().mockResolvedValue([]),
    apiGetOpenShift: vi.fn().mockResolvedValue(null),
  }
})

describe('Performance Benchmarks', () => {
  it('useStore todayProfit initialization efficiently computes on large dataset', async () => {
    let hookResult
    const start = performance.now()
    await act(async () => {
      hookResult = renderHook(() => useStore())
      // Wait for data to load
      await new Promise(resolve => setTimeout(resolve, 50))
    })
    const end = performance.now()
    const duration = end - start

    // The data mock returns 10000 orders all with today's date
    expect(hookResult.result.current.todayRevenue).toBe(10000 * 300)

    console.log(`useStore init executed in ${duration.toFixed(2)} ms`)
    expect(duration).toBeLessThan(1500)
  })
})
