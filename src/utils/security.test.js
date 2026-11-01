import { describe, it, expect } from 'vitest'
import { sanitize, sanitizeObject, safeAdd, safeSubtract, safeMultiply, validateCartItem, sanitizePrintText } from './security'

describe('security', () => {
  it('should sanitize basic string', () => {
    expect(sanitize('<script>alert("XSS")</script>')).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;')
  })

  it('should fix IEEE 754 floating point errors', () => {
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(safeAdd(0.1, 0.2)).toBe(0.3)

    expect(0.3 - 0.2).not.toBe(0.1)
    expect(safeSubtract(0.3, 0.2)).toBe(0.1)

    expect(19.99 * 100).not.toBe(1999)
    expect(safeMultiply(19.99, 100)).toBe(1999)
  })

  it('should enforce boundaries on cart items', () => {
    expect(validateCartItem({ qty: -5, price: -100 })).toEqual({ qty: 1, price: 0 })
    expect(validateCartItem({ qty: 0, price: 10 })).toEqual({ qty: 1, price: 10 })
    expect(validateCartItem({ qty: 10000, price: 1000000 })).toEqual({ qty: 9999, price: 999999 })
    expect(validateCartItem({ qty: 2.5, price: 19.999 })).toEqual({ qty: 2, price: 20 })
  })

  it('should sanitize print text and prevent ESC/POS injection', () => {
    const malicious = "Text\x1B\x40\x1D\x56\x00Cut"
    // \x1B is removed, \x1D is removed, \x00 is removed
    // left with Text\x40\x56Cut => Text@VCut
    expect(sanitizePrintText(malicious)).toBe("Text@VCut")
    expect(sanitizePrintText("Test\nLine")).toBe("Test\nLine")
  })
})
