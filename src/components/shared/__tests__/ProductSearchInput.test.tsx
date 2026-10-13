// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
import { ProductSearchInput } from '../ProductSearchInput'

afterEach(() => {
    cleanup()
})

const mockProducts = [
    {
        id: '1',
        name: 'Sầu riêng Dona Cơm C Vụn',
        sku: 'DN-C-VUN',
        internal_code: 'NB-001',
        aliases: 'dona c vụn, dncv, dona cv'
    },
    {
        id: '2',
        name: 'Sầu riêng Ri6 Loại A',
        sku: 'RI6-A',
        internal_code: 'NB-002',
        aliases: 'ri6 a, r6a'
    },
    {
        id: '3',
        name: 'Xoài Cát Chu Cấp Đông',
        sku: 'XCC-CD',
        internal_code: 'NB-003',
        aliases: 'xoai cat chu, xcc'
    }
]

describe('ProductSearchInput', () => {
    it('renders input with placeholder', () => {
        render(
            <ProductSearchInput
                value=""
                onChange={() => {}}
                products={mockProducts}
                placeholder="Tìm sản phẩm..."
            />
        )
        expect(screen.getByPlaceholderText('Tìm sản phẩm...')).toBeDefined()
    })

    it('shows suggestions with alias badge when typing shorthand', () => {
        const handleChange = vi.fn()
        render(
            <ProductSearchInput
                value=""
                onChange={handleChange}
                products={mockProducts}
            />
        )

        const input = screen.getByRole('textbox')
        fireEvent.change(input, { target: { value: 'dncv' } })

        // Should display suggestion with matched product
        expect(screen.getByText('Sầu riêng Dona Cơm C Vụn')).toBeDefined()
        // Should display badge for matched abbreviation
        expect(screen.getByText('⚡ dncv')).toBeDefined()
    })

    it('selects suggestion on click and triggers onChange', () => {
        const handleChange = vi.fn()
        const handleSearch = vi.fn()
        render(
            <ProductSearchInput
                value=""
                onChange={handleChange}
                onSearch={handleSearch}
                products={mockProducts}
            />
        )

        const input = screen.getByRole('textbox')
        fireEvent.change(input, { target: { value: 'xcc' } })

        const suggestionItem = screen.getByText('Xoài Cát Chu Cấp Đông')
        fireEvent.click(suggestionItem)

        expect(handleChange).toHaveBeenCalledWith('Xoài Cát Chu Cấp Đông')
        expect(handleSearch).toHaveBeenCalledWith('Xoài Cát Chu Cấp Đông')
    })

    it('handles keyboard navigation ArrowDown and Enter', () => {
        const handleChange = vi.fn()
        render(
            <ProductSearchInput
                value=""
                onChange={handleChange}
                products={mockProducts}
            />
        )

        const input = screen.getByRole('textbox')
        fireEvent.change(input, { target: { value: 'ri6' } })

        fireEvent.keyDown(input, { key: 'ArrowDown' })
        fireEvent.keyDown(input, { key: 'Enter' })

        expect(handleChange).toHaveBeenCalledWith('Sầu riêng Ri6 Loại A')
    })
})
