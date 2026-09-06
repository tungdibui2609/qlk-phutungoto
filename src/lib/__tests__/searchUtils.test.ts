import { describe, it, expect } from 'vitest'
import { calculateSearchScore, matchSearch } from '../searchUtils'

describe('searchUtils - Product Aliases & Shortcuts', () => {
    const testProduct = {
        id: '5305e6ef-c9dc-4573-bbe7-a59251ba1931',
        name: 'Sầu riêng cấp đông múi Dona/Monthong A (Hàng hạt + vụn)',
        sku: 'HH101020102.07',
        aliases: 'dona c vụn, dona c, dncv'
    }

    const otherProduct = {
        id: 'fa28fd25-8c91-462b-bb44-df938e61b50d',
        name: 'Sầu riêng cấp đông múi Dona/Monthong A (4 túi) - Hầm đông',
        sku: 'HH101020102.04.001',
        aliases: null
    }

    it('matches exact alias "dona c vụn"', () => {
        expect(matchSearch(testProduct, 'dona c vụn')).toBe(true)
        const scoreTest = calculateSearchScore(testProduct, 'dona c vụn')
        const scoreOther = calculateSearchScore(otherProduct, 'dona c vụn')
        expect(scoreTest).toBeGreaterThan(scoreOther)
        expect(scoreTest).toBeGreaterThan(3000)
    })

    it('matches unaccented alias "dona c vun"', () => {
        expect(matchSearch(testProduct, 'dona c vun')).toBe(true)
        const scoreTest = calculateSearchScore(testProduct, 'dona c vun')
        const scoreOther = calculateSearchScore(otherProduct, 'dona c vun')
        expect(scoreTest).toBeGreaterThan(scoreOther)
    })

    it('matches shortcut abbreviation "dncv"', () => {
        expect(matchSearch(testProduct, 'dncv')).toBe(true)
        const scoreTest = calculateSearchScore(testProduct, 'dncv')
        const scoreOther = calculateSearchScore(otherProduct, 'dncv')
        expect(scoreTest).toBeGreaterThan(scoreOther)
    })

    it('matches short alias "dona c"', () => {
        expect(matchSearch(testProduct, 'dona c')).toBe(true)
        const scoreTest = calculateSearchScore(testProduct, 'dona c')
        const scoreOther = calculateSearchScore(otherProduct, 'dona c')
        expect(scoreTest).toBeGreaterThan(scoreOther)
    })

    it('matches user real case "đô c có hạt"', () => {
        const userProduct = {
            id: '88a40227-a5d4-4a7c-ac9e-b2d69219be3d',
            name: 'TP cấp đông sầu riêng múi monthong C - Hàng có hạt',
            sku: 'TP101020104.002',
            label: 'TP101020104.002 - TP cấp đông sầu riêng múi monthong C - Hàng có hạt',
            aliases: 'đô c có hạt'
        }
        expect(matchSearch(userProduct, 'đô c có hạt')).toBe(true)
        const score = calculateSearchScore(userProduct, 'đô c có hạt')
        expect(score).toBeGreaterThan(3000)
    })
})
