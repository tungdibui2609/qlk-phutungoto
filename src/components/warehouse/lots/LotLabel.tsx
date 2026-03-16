import QRCode from 'react-qr-code'

interface LotLabelProps {
    data: {
        lot_code: string
        production_code?: string
        scan_url: string
        company_prefix?: string
        company_full_name?: string
        products?: {
            name: string
            sku?: string
            quantity: number
            unit: string
            tags?: string[]
        }[]
        product_name?: string
        quantity?: number
        unit?: string
        positions?: string[]
    }
    scale?: number
    showBorder?: boolean
    qrOnly?: boolean
}

export function LotLabel({ data, scale = 1, showBorder = true, qrOnly = false }: LotLabelProps) {
    const companyName = (data.company_prefix || 'TOAN THANG').toUpperCase()
    const fullCompanyName = data.company_full_name || companyName
    const displayLotCode = data.production_code || data.lot_code

    if (qrOnly) {
        return (
            <div
                style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    width: scale === 1 ? '3.54in' : 'auto',
                    height: scale === 1 ? '2.36in' : 'auto',
                    boxSizing: 'border-box'
                }}
                className="bg-white text-black font-sans overflow-hidden flex flex-col items-center justify-center p-3"
            >
                <div className="bg-white p-1">
                    <QRCode value={data.scan_url} size={120} />
                </div>
                <div className="mt-2 text-center w-full">
                    <p className="text-[10px] font-black uppercase leading-tight text-balance">
                        {data.products?.[0]?.name || data.product_name}
                    </p>
                    <p className="text-[9px] font-bold text-black uppercase">
                        {data.products?.[0]?.quantity || data.quantity} {data.products?.[0]?.unit || data.unit}
                    </p>
                    {data.positions && data.positions.length > 0 && (
                        <p className="text-[9px] font-black text-black uppercase mt-0.5">
                            Vị trí: {data.positions.join(', ')}
                        </p>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div
            style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: scale === 1 ? '3.54in' : 'auto',
                height: scale === 1 ? '2.36in' : 'auto',
                boxSizing: 'border-box'
            }}
            className={`bg-white text-black font-sans overflow-hidden transition-all duration-300 ${showBorder ? 'border-[1px] border-black rounded-sm' : ''
                }`}
        >
            <div className="p-3 flex flex-col h-full">
                {/* Header: Company & Lot Info */}
                <div className="flex justify-between items-start border-b-2 border-black pb-1 mb-2">
                    <div className="flex flex-col min-w-0">
                        <h2 className="text-[13px] font-black tracking-tight leading-none mb-0.5 truncate">
                            {companyName}
                        </h2>
                        <p className="text-[8px] font-bold lowercase tracking-wider text-black/60 leading-none">website: chanhthu.com</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2 max-w-[55%]">
                        <p className="text-[7px] font-bold uppercase opacity-50 leading-none">Lot Number</p>
                        <p className="text-[10px] font-black tracking-tight leading-tight break-all">{displayLotCode}</p>
                    </div>
                </div>

                {/* Main Section: QR and Product Information */}
                <div className="flex gap-3 items-stretch flex-1 min-h-0">
                    {/* QR Code Segment (45%) */}
                    <div className="w-[45%] flex flex-col items-center justify-center border-r border-dashed border-black/30 pr-2">
                        <div className="bg-white p-1">
                            <QRCode value={data.scan_url} size={scale < 0.5 ? 85 : 120} />
                        </div>
                        <p className="text-[7px] mt-1.5 font-black tracking-[0.2em] opacity-80 whitespace-nowrap">SCAN TO ASSIGN</p>
                    </div>

                    {/* Product Details Segment (55%) */}
                    <div className="w-[55%] flex flex-col justify-between py-0.5 min-w-0">
                        <div className="min-w-0">
                            <div className="flex justify-between items-end mb-1">
                                <p className="text-[7px] font-bold uppercase opacity-50 leading-none">Sản phẩm</p>
                                {data.products?.[0]?.sku && (
                                    <p className="text-[7px] font-black text-black/40 leading-none">CODE: {data.products?.[0]?.sku}</p>
                                )}
                            </div>
                            <h3 className="text-[11px] font-black leading-[1.2] uppercase break-words text-balance min-h-[1.2rem]">
                                {data.products?.[0]?.name || data.product_name}
                            </h3>

                            {/* Secondary Codes / Tags */}
                            {(data.products?.[0]?.tags && data.products?.[0]?.tags.length > 0) && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {data.products?.[0]?.tags.map((tag: string, i: number) => (
                                        <span key={i} className="text-[7px] px-1 font-bold border border-black/40 rounded-[2px] bg-black/[0.03] text-black shrink-0">
                                            #{tag.replace('@', data.products?.[0]?.sku || '')}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-black/20 pt-1.5 flex flex-col items-center">
                            <p className="text-[7px] font-bold uppercase opacity-50 mb-1 leading-none">Qty / Số lượng</p>
                            <div className="flex items-center justify-center leading-none">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black tabular-nums tracking-tighter">
                                        {data.products?.[0]?.quantity || data.quantity}
                                    </span>
                                    <span className="text-[9px] font-bold uppercase opacity-60">
                                        {data.products?.[0]?.unit || data.unit}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer: System Tag */}
                <div className="border-t-2 border-black mt-2 pt-1.5 flex justify-center items-center shrink-0">
                    <span className="text-[7px] font-black tracking-[0.15em] uppercase leading-tight text-center">{fullCompanyName} SYSTEM CONTROL</span>
                </div>
            </div>
        </div>
    )
}
