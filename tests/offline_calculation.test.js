/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStore } from '../src/store/useStore'
import { orderToJournalEntries } from '../src/utils/accounting'

// Mock dependencies
vi.mock('../src/utils/dataAccess', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    isElectron: false,
    loadProducts: vi.fn().mockResolvedValue([]),
    loadMembers: vi.fn().mockResolvedValue([]),
    loadOrders: vi.fn().mockResolvedValue([]),
    loadManualJournal: vi.fn().mockResolvedValue([]),
    loadHeldOrders: vi.fn().mockResolvedValue([]),
    loadWasteLog: vi.fn().mockResolvedValue([]),
    loadTopups: vi.fn().mockResolvedValue([]),
    getSetting: vi.fn().mockResolvedValue(null),
    loadCashLogs: vi.fn().mockResolvedValue([]),
    apiGetOpenShift: vi.fn().mockResolvedValue(null),
    apiOpenShift: vi.fn().mockResolvedValue(true),
    apiCloseShift: vi.fn().mockResolvedValue(true),
    addHeldOrder: vi.fn().mockResolvedValue(true),
    deleteHeldOrder: vi.fn().mockResolvedValue(true),
    dbCheckout: vi.fn().mockResolvedValue(true),
    dbRefund: vi.fn().mockResolvedValue(true),
  }
})
vi.mock('../src/utils/webhook', () => ({
  fireWebhook: vi.fn().mockResolvedValue(true),
  getWebhookConfig: vi.fn().mockReturnValue({ url: '', events: [] }),
  payloadFromOrder: vi.fn().mockReturnValue({}),
  payloadFromShift: vi.fn().mockReturnValue({}),
}))

describe('Offline Transaction Calculation', () => {
  let storeHook;

  beforeEach(() => {
    storeHook = renderHook(() => useStore())
  })

  describe('Offline Cart Total Calculation', () => {
    it('calculates correct cart subtotal and count', () => {
      act(() => {
        storeHook.result.current.addToCart({ id: 'p1', price: 100 }, 1)
        storeHook.result.current.addToCart({ id: 'p2', price: 200 }, 2)
      })
      expect(storeHook.result.current.cartSubtotal).toBe(500)
      expect(storeHook.result.current.cartCount).toBe(3)
    })

    it('handles quantity updates correctly', () => {
      act(() => {
        storeHook.result.current.addToCart({ id: 'p1', price: 100 }, 1)
      })

      act(() => {
        storeHook.result.current.updateCartQty('p1', 5)
      })

      expect(storeHook.result.current.cartSubtotal).toBe(500)
      expect(storeHook.result.current.cartCount).toBe(5)
    })

    it('works without internet/backend logic (all synced to local state)', async () => {
      act(() => {
        storeHook.result.current.addToCart({ id: 'p1', price: 50 }, 2)
        storeHook.result.current.addToCart({ id: 'p2', price: 150 }, 1)
      })

      let order;
      await act(async () => {
        order = await storeHook.result.current.checkout('cash', 250)
      })

      expect(order.subtotal).toBe(250)
      expect(order.total).toBe(250)
      expect(order.status).toBe('completed')
    })
  })

  describe('Tax Rules', () => {
    it('records taxId during checkout', async () => {
      act(() => {
        storeHook.result.current.addToCart({ id: 'p1', price: 100 }, 1)
      })

      let order;
      await act(async () => {
        order = await storeHook.result.current.checkout('cash', 100, 0, { taxId: '12345678' })
      })

      expect(order.taxId).toBe('12345678')
      expect(order.total).toBe(100)
    })
  })

  describe('Double-entry Ledger Entries', () => {
    it('maintains debit/credit balance for sales', () => {
      const mockOrder = {
        id: 'O1',
        total: 105,
        subtotal: 100,
        discount: 0,
        payMethod: 'cash',
        items: [{ id: 'p1', qty: 1 }],
        time: new Date().toISOString(),
        taxId: '87654321'
      }
      const mockProducts = [{ id: 'p1', price: 100, cost: 50 }]

      const entries = orderToJournalEntries(mockOrder, mockProducts)

      const saleEntry = entries.find(e => e.type === 'auto_sale')
      expect(saleEntry).toBeDefined()

      const totalDebit = saleEntry.lines.reduce((s, l) => s + l.debit, 0)
      const totalCredit = saleEntry.lines.reduce((s, l) => s + l.credit, 0)
      expect(totalDebit).toBe(totalCredit)
      expect(totalDebit).toBe(105)
    })

    it('maintains debit/credit balance for Cost of Goods Sold (COGS)', () => {
      const mockOrder = {
        id: 'O2',
        total: 100,
        discount: 0,
        payMethod: 'cash',
        items: [{ id: 'p1', qty: 2 }],
        time: new Date().toISOString()
      }
      const mockProducts = [{ id: 'p1', price: 50, cost: 30 }]

      const entries = orderToJournalEntries(mockOrder, mockProducts)

      const cogsEntry = entries.find(e => e.type === 'auto_cogs')
      expect(cogsEntry).toBeDefined()

      const cogsTotalDebit = cogsEntry.lines.reduce((s, l) => s + l.debit, 0)
      const cogsTotalCredit = cogsEntry.lines.reduce((s, l) => s + l.credit, 0)

      expect(cogsTotalDebit).toBe(cogsTotalCredit)
      expect(cogsTotalDebit).toBe(60) // 2 * 30

      expect(cogsEntry.lines.find(l => l.account === '5101').debit).toBe(60) // COGS
      expect(cogsEntry.lines.find(l => l.account === '1211').credit).toBe(60) // Inventory
    })
  })
})
