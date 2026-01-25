import { describe, it, expect } from 'vitest'
import { toBaseAmount, getBaseToKgRate, UnitNameMap, ConversionMap } from './unitConversion'

describe('toBaseAmount', () => {
  // Setup mock data
  const productId = 'prod-123'

  const boxUnitId = 'unit-box'

  const unitNameMap: UnitNameMap = new Map([
    ['lon', 'unit-lon'],
    ['thung', boxUnitId],
    ['thùng', boxUnitId],
  ])

  // Map: ProductID -> UnitID -> Rate (Multiplier to get Base Unit)
  // If 1 Thung = 24 Lon (Base), then rate is 24.
  const conversionMap: ConversionMap = new Map([
    [productId, new Map([
      [boxUnitId, 24]
    ])]
  ])

  it('should return original quantity if inputs are missing', () => {
    expect(toBaseAmount(null, 'thung', 10, 'lon', unitNameMap, conversionMap)).toBe(10)
    expect(toBaseAmount(productId, null, 10, 'lon', unitNameMap, conversionMap)).toBe(10)
    expect(toBaseAmount(productId, 'thung', 10, null, unitNameMap, conversionMap)).toBe(10)
  })

  it('should return quantity as is if unit is base unit (case insensitive)', () => {
    expect(toBaseAmount(productId, 'Lon', 10, 'lon', unitNameMap, conversionMap)).toBe(10)
    expect(toBaseAmount(productId, 'LON', 10, 'lon', unitNameMap, conversionMap)).toBe(10)
  })

  it('should return quantity as is if unit is not found in map', () => {
    expect(toBaseAmount(productId, 'unknown', 10, 'lon', unitNameMap, conversionMap)).toBe(10)
  })

  it('should convert correctly using conversion map', () => {
    // 2 Thung * 24 = 48 Lon
    expect(toBaseAmount(productId, 'Thung', 2, 'lon', unitNameMap, conversionMap)).toBe(48)
  })

  it('should return quantity as is if product not in conversion map', () => {
    expect(toBaseAmount('other-prod', 'Thung', 2, 'lon', unitNameMap, conversionMap)).toBe(2)
  })
})

describe('getBaseToKgRate', () => {
  const productId = 'prod-123'
  const unitNameMap: UnitNameMap = new Map([
    ['kg', 'unit-kg'],
    ['kilogram', 'unit-kg'],
    ['thung', 'unit-thung']
  ])

  it('should return 1 if base unit is already KG', () => {
    const conversionMap: ConversionMap = new Map()
    expect(getBaseToKgRate(productId, 'kg', unitNameMap, conversionMap)).toBe(1)
    expect(getBaseToKgRate(productId, 'Kilogram', unitNameMap, conversionMap)).toBe(1)
  })

  it('should return correct rate if there is a direct conversion from Base to KG', () => {
    // Logic:
    // "Table stores: 1 Alt = rate * Base."
    // "So if Alt is KG: 1 KG = rate * Base. -> 1 Base = 1/rate KG."

    // Scenario: Base is 'Bag'. 1 KG = 2 Bags.
    // rate in map (for KG unit) = 2.
    // Result should be 1/2 = 0.5 (1 Bag = 0.5 KG).

    const conversionMap: ConversionMap = new Map([
      [productId, new Map([
        ['unit-kg', 2] // 1 KG = 2 Base
      ])]
    ])

    expect(getBaseToKgRate(productId, 'bag', unitNameMap, conversionMap)).toBe(0.5)
  })

  it('should return null if no conversion path to KG', () => {
     const conversionMap: ConversionMap = new Map([
      [productId, new Map([
        ['unit-thung', 24] // 1 Thung = 24 Base. No KG involved.
      ])]
    ])
    expect(getBaseToKgRate(productId, 'bag', unitNameMap, conversionMap)).toBe(null)
  })

  it('should return null if rate is 0 (avoid division by zero)', () => {
      const conversionMap: ConversionMap = new Map([
      [productId, new Map([
        ['unit-kg', 0]
      ])]
    ])
    expect(getBaseToKgRate(productId, 'bag', unitNameMap, conversionMap)).toBe(null)
  })
})
