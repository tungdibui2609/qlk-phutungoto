import { describe, it, expect } from 'vitest'
import {
    extractTagAtoms,
    getMatchedAffixTags,
    resolveDisplayProductName,
    buildAffixedGroupKey
} from '../productNameResolver'

describe('productNameResolver', () => {
    const affixSet = new Set(['TRUNG HÙNG', 'XẤU'])

    it('extractTagAtoms correctly splits atoms and ignores @', () => {
        expect(extractTagAtoms('TRUNG HÙNG')).toEqual(['TRUNG HÙNG'])
        expect(extractTagAtoms('TRUNG HÙNG>@>XẤU')).toEqual(['TRUNG HÙNG', 'XẤU'])
        expect(extractTagAtoms('')).toEqual([])
    })

    it('getMatchedAffixTags returns only matching configured tags', () => {
        expect(getMatchedAffixTags(['TRUNG HÙNG'], affixSet)).toEqual(['TRUNG HÙNG'])
        expect(getMatchedAffixTags(['CONT1', 'KHU_A'], affixSet)).toEqual([])
        expect(getMatchedAffixTags(['TRUNG HÙNG>@>XẤU'], affixSet)).toEqual(['TRUNG HÙNG', 'XẤU'])
        expect(getMatchedAffixTags(['MERGED_FROM:LOT123', 'TRUNG HÙNG'], affixSet)).toEqual(['TRUNG HÙNG'])
    })

    it('resolveDisplayProductName appends tag to product name when matched', () => {
        expect(resolveDisplayProductName('Đô Na A', ['TRUNG HÙNG'], affixSet))
            .toBe('Đô Na A (TRUNG HÙNG)')

        expect(resolveDisplayProductName('Đô Na A', ['CONT1'], affixSet))
            .toBe('Đô Na A')

        expect(resolveDisplayProductName('Đô Na A', ['TRUNG HÙNG', 'XẤU'], affixSet))
            .toBe('Đô Na A (TRUNG HÙNG, XẤU)')

        // Avoid double affix if already present
        expect(resolveDisplayProductName('Đô Na A (TRUNG HÙNG)', ['TRUNG HÙNG'], affixSet))
            .toBe('Đô Na A (TRUNG HÙNG)')
    })

    it('buildAffixedGroupKey generates distinct keys for lots with and without affixed tag', () => {
        const baseKey = 'SKU01__KG__CAT1'
        const keyWithoutTag = buildAffixedGroupKey(baseKey, ['CONT1'], affixSet)
        const keyWithTag = buildAffixedGroupKey(baseKey, ['TRUNG HÙNG'], affixSet)

        expect(keyWithoutTag).toBe(baseKey)
        expect(keyWithTag).toBe('SKU01__KG__CAT1__AFFIX[TRUNG HÙNG]')
        expect(keyWithTag).not.toBe(keyWithoutTag)
    })
})

