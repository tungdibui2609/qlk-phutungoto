import React from 'react'

// Editable text component - shows input on screen, shows text when printing
export function EditableText({
    value,
    onChange,
    placeholder = '',
    className = '',
    style = {},
    isSnapshot = false
}: {
    value: string
    onChange: (val: string) => void
    placeholder?: string
    className?: string
    style?: React.CSSProperties
    isSnapshot?: boolean
}) {
    return (
        <>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`print:hidden ${isSnapshot ? 'hidden' : ''} bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none transition-colors ${className}`}
                style={style}
            />
            <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''} ${className}`} style={style}>{value || ''}</span>
        </>
    )
}

export function AutoResizeInput({
    value,
    onChange,
    minWidth = 30,
    emptyWidth = 30,
    className = '',
    isSnapshot = false
}: {
    value: string
    onChange: (val: string) => void
    minWidth?: number
    emptyWidth?: number
    className?: string
    isSnapshot?: boolean
}) {
    return (
        <>
            <span className={`${isSnapshot ? 'hidden' : ''} print:hidden ${className}`}>
                <span className="inline-grid items-center w-full h-full">
                    {/* Hidden span to measure content width */}
                    <span className="invisible col-start-1 row-start-1 px-1 overflow-hidden whitespace-pre border-b border-transparent opacity-0 pointer-events-none">
                        {value || '00'}
                    </span>
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="col-start-1 row-start-1 w-full h-full text-center bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none"
                        style={{ minWidth: `${minWidth}px` }}
                    />
                </span>
            </span>
            <span
                className={`${isSnapshot ? 'inline-block' : 'hidden'} print:inline-block ${className}`}
                style={{ minWidth: !value ? `${emptyWidth}px` : undefined }}
            >
                {value || ''}
            </span>
        </>
    )
}

export function numberToVietnameseText(number: number): string {
    const defaultNumbers = ' hai ba bốn năm sáu bảy tám chín'
    const chuHangDonVi = ('1 mốt' + defaultNumbers).split(' ')
    const chuHangChuc = ('lẻ mười' + defaultNumbers).split(' ')
    const chuHangTram = ('không một' + defaultNumbers).split(' ')
    const dvBlock = '1 nghìn triệu tỷ'.split(' ')

    function convert_block_three(number: string, isLeading: boolean = false): string {
        var a = parseInt(number.substring(0, 1))
        var b = parseInt(number.substring(1, 2))
        var c = parseInt(number.substring(2, 3))
        var chu = ''

        // Hàng trăm
        if (!isLeading || a !== 0) {
            chu = chuHangTram[a] + ' trăm'
        }

        // Hàng chục
        if (b === 0) {
            if (c !== 0) {
                // If leading and hundreds was skipped (a=0), we don't say "lẻ"
                if (isLeading && a === 0) {
                    chu += ' ' + chuHangTram[c]
                } else {
                    chu += ' lẻ ' + chuHangTram[c]
                }
            }
        } else if (b === 1) {
            chu += ' mười'
            if (c === 1) chu += ' một'
            else if (c !== 0) chu += ' ' + chuHangDonVi[c]
        } else {
            chu += ' ' + chuHangChuc[b] + ' mươi'
            if (c === 1) chu += ' mốt'
            else if (c === 4) chu += ' tư'
            else if (c !== 0) chu += ' ' + chuHangDonVi[c]
        }
        return chu
    }

    function to_vietnamese(number: number): string {
        var str = number.toString()
        var i = str.length
        if (i === 0 || str === 'NaN' || str === '0') return 'Không đồng'

        var chu = ''
        var dau = ''
        // var index = 0 // Removing unused variable
        var result = ''

        if (number < 0) {
            dau = 'Âm '
            str = str.substring(1)
            i--
        }

        var arr = []
        var position = i

        while (position >= 0) {
            arr.push(str.substring(Math.max(0, position - 3), position))
            position -= 3
        }

        for (i = 0; i < arr.length; i++) {
            if (arr[i] !== '' && arr[i] !== '000') {
                const isLeading = i === arr.length - 1
                result = convert_block_three(arr[i].padStart(3, '0'), isLeading) + (dvBlock[i] === '1' ? '' : ' ' + dvBlock[i]) + ' ' + result
            }
            // index++
        }

        result = result.trim()
        // Capitalize first letter
        let suffix = ' đồng./.'
        if (number > 0 && number % 1000000 === 0) {
            suffix = ' đồng chẵn./.'
        }
        return dau + result.charAt(0).toUpperCase() + result.slice(1) + suffix
    }

    return to_vietnamese(number)
}

/**
 * Common styles for snapshot/print view to be injected safely
 * Contains fixes for page sizing and background
 */
export const SNAPSHOT_STYLES = `
    html, body {
        background: white !important;
        height: fit-content !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
    }
    .min-h-screen {
        min-height: 0 !important;
        height: auto !important;
    }
    body::before {
        display: none !important;
    }
    #print-ready {
        height: fit-content !important;
        padding: 20px !important;
        margin: 0 !important;
        max-width: none !important;
        box-shadow: none !important;
        border: none !important;
        box-sizing: border-box !important;
        background: white !important;
    }
    @media print {
        @page {
            size: A4;
            margin: 10mm;
        }
        body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
    }
`
