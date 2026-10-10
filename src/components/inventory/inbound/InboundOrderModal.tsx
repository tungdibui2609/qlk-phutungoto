'use client'

import { useState } from 'react'
import { Plus, Save, FileText, Hash, RefreshCw, Loader2 } from 'lucide-react'
import { OrderFormLayout } from '../shared/OrderFormLayout'
import { LogisticsSection } from '../shared/LogisticsSection'
import { OrderImagesSection } from '../shared/OrderImagesSection'
import { InboundItemsTable } from './InboundItemsTable'
import { Combobox } from '@/components/ui/Combobox'
import { useInboundOrder } from './useInboundOrder'
import { OrderFormProps } from '@/components/inventory/types'

export default function InboundOrderModal(props: OrderFormProps<any>) {
    const isDuplicate = !!props.duplicateOrderId
    const {
        code, setCode,
        supplierId, handleSupplierChange,
        supplierAddress, setSupplierAddress,
        supplierPhone, setSupplierPhone,
        warehouseName, setWarehouseName,
        description, setDescription,
        items, setItems, addItem, updateItem, removeItem,
        vehicleNumber, setVehicleNumber,
        driverName, setDriverName,
        containerNumber, setContainerNumber,
        sealNumber, setSealNumber,
        orderTypeId, setOrderTypeId,
        images, setImages,
        targetUnit, setTargetUnit,
        createdAt, setCreatedAt,
        products, suppliers, branches, units, orderTypes, categories,
        loadingData, submitting, handleSubmit,
        hasModule,
        convertUnit,
        syncingWithLot,
        handleSyncWithLot
    } = useInboundOrder(props)

    const [displayInternalCode, setDisplayInternalCode] = useState(false)

    if (!props.isOpen) return null

    const footerButtons = (
        <div className="flex items-center gap-2.5 justify-end w-full">
            <button
                onClick={props.onClose}
                className="px-4 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-gray-300 font-medium hover:bg-stone-50 dark:hover:bg-zinc-800 transition-colors text-xs cursor-pointer"
            >
                Hủy bỏ
            </button>
            <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-md shadow-orange-500/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed text-xs cursor-pointer"
            >
                <Save size={16} />
                {submitting ? 'Đang lưu...' : (props.editOrderId ? 'Cập Nhật Phiếu' : 'Lưu Phiếu Nhập')}
            </button>
        </div>
    )

    return (
        <OrderFormLayout
            title={
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                        <FileText size={18} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-stone-900 dark:text-white">
                            {props.editOrderId ? 'Chỉnh Sửa Phiếu Nhập' : isDuplicate ? 'Nhân Bản Phiếu Nhập' : 'Tạo Phiếu Nhập Mới'}
                        </h2>
                        <p className="text-xs text-stone-500 font-normal mt-0.5">
                            {props.editOrderId ? 'Cập nhật thông tin phiếu' : isDuplicate ? 'Tạo phiếu mới từ phiếu gốc' : 'Tạo phiếu nhập kho'}
                        </p>
                    </div>
                </div>
            }
            onClose={props.onClose}
            maxWidth="max-w-6xl"
            headerActions={
                <div className="flex items-center gap-2">
                    {props.editOrderId && (
                        <button
                            onClick={handleSyncWithLot}
                            disabled={syncingWithLot}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 transition-all disabled:opacity-50 cursor-pointer"
                            title="Tự động đồng bộ số lượng thực tế từ Lot sản xuất cùng ngày"
                        >
                            {syncingWithLot ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            Cân bằng theo Lot
                        </button>
                    )}
                    <button
                        onClick={() => setDisplayInternalCode(!displayInternalCode)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${displayInternalCode ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-gray-300'}`}
                        title="Hiển thị mã sản phẩm nội bộ"
                    >
                        <Hash size={14} /> Nhập Mã Nội Bộ
                    </button>
                </div>
            }
            footer={footerButtons}
        >
            {/* 1. Compact Information Card */}
            <div className="bg-stone-50/70 dark:bg-zinc-800/40 p-3.5 rounded-xl border border-stone-200 dark:border-zinc-700 space-y-2.5">
                {/* Row 1: Code, Date, Warehouse, Order Type, Supplier, Conversion */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {/* Mã phiếu */}
                    <div>
                        <label className="block text-[11px] font-semibold text-stone-600 dark:text-gray-300 mb-1">
                            Mã phiếu
                        </label>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            className="w-full h-9 px-3 text-xs font-mono font-bold bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-stone-900 dark:text-white"
                        />
                    </div>

                    {/* Ngày phiếu */}
                    <div>
                        <label className="block text-[11px] font-semibold text-stone-600 dark:text-gray-300 mb-1">
                            Ngày phiếu
                        </label>
                        <input
                            type="datetime-local"
                            value={createdAt ? new Date(new Date(createdAt).getTime() - new Date(createdAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                            onChange={(e) => setCreatedAt?.(new Date(e.target.value).toISOString())}
                            className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-stone-900 dark:text-white"
                        />
                    </div>

                    {/* Kho nhập hàng */}
                    <div>
                        <label className="block text-[11px] font-semibold text-stone-600 dark:text-gray-300 mb-1">
                            Kho nhập hàng
                        </label>
                        <select
                            value={warehouseName}
                            onChange={(e) => setWarehouseName(e.target.value)}
                            className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-stone-900 dark:text-white"
                        >
                            {branches.map(b => (
                                <option key={b.id} value={b.name}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Loại phiếu */}
                    {hasModule('inbound_type') && (
                        <div>
                            <label className="block text-[11px] font-semibold text-stone-600 dark:text-gray-300 mb-1">
                                Loại phiếu
                            </label>
                            <select
                                value={orderTypeId}
                                onChange={(e) => setOrderTypeId(e.target.value)}
                                className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-stone-900 dark:text-white"
                            >
                                <option value="">-- Chọn loại phiếu --</option>
                                {orderTypes.map(t => (
                                    <option key={t.id} value={t.id}>{t.code ? `${t.code} - ` : ''}{t.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Nhà cung cấp */}
                    {hasModule('inbound_supplier') && (
                        <div>
                            <label className="block text-[11px] font-semibold text-stone-600 dark:text-gray-300 mb-1">
                                Nhà cung cấp
                            </label>
                            <Combobox
                                options={suppliers.map(s => ({
                                    value: s.id,
                                    label: s.name,
                                    sub: s.phone || s.address
                                }))}
                                value={supplierId}
                                onChange={handleSupplierChange}
                                placeholder="-- Chọn NCC --"
                                className="w-full text-xs"
                            />
                        </div>
                    )}

                    {/* Hiển thị quy đổi theo */}
                    {hasModule('inbound_conversion') && (
                        <div>
                            <label className="block text-[11px] font-semibold text-stone-600 dark:text-gray-300 mb-1">
                                Quy đổi theo
                            </label>
                            <select
                                value={targetUnit}
                                onChange={(e) => setTargetUnit(e.target.value)}
                                className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-stone-900 dark:text-white"
                            >
                                <option value="">-- Không quy đổi --</option>
                                {units.map(u => (
                                    <option key={u.id} value={u.name}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Row 2: Address, Phone, Description */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5">
                    {hasModule('inbound_supplier') && (
                        <>
                            <input
                                type="text"
                                value={supplierAddress}
                                onChange={(e) => setSupplierAddress(e.target.value)}
                                placeholder="Địa chỉ NCC..."
                                className="w-full h-8 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-stone-700 dark:text-gray-300 placeholder:text-stone-400"
                            />
                            <input
                                type="text"
                                value={supplierPhone}
                                onChange={(e) => setSupplierPhone(e.target.value)}
                                placeholder="Số điện thoại NCC..."
                                className="w-full h-8 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-stone-700 dark:text-gray-300 placeholder:text-stone-400"
                            />
                        </>
                    )}
                    <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Diễn giải / Ghi chú trên phiếu..."
                        className={`w-full h-8 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-stone-700 dark:text-gray-300 placeholder:text-stone-400 ${!hasModule('inbound_supplier') ? 'sm:col-span-3' : ''}`}
                    />
                </div>
            </div>

            {hasModule('inbound_images') && (
                <OrderImagesSection images={images} setImages={setImages} />
            )}

            {hasModule('inbound_logistics') && (
                <LogisticsSection
                    vehicleNumber={vehicleNumber} setVehicleNumber={setVehicleNumber}
                    driverName={driverName} setDriverName={setDriverName}
                    containerNumber={containerNumber} setContainerNumber={setContainerNumber}
                    sealNumber={sealNumber} setSealNumber={setSealNumber}
                />
            )}

            {/* 2. Items Table */}
            <div className="space-y-3">
                <InboundItemsTable
                    items={items}
                    setItems={setItems}
                    products={products}
                    units={units}
                    categories={categories}
                    updateItem={updateItem}
                    removeItem={removeItem}
                    targetUnit={targetUnit}
                    hasModule={hasModule}
                    compact={hasModule('inbound_ui_compact')}
                    displayInternalCode={displayInternalCode}
                    convertUnit={convertUnit}
                />

                <button
                    type="button"
                    onClick={addItem}
                    className="w-full py-2 border border-dashed border-stone-300 dark:border-zinc-700 rounded-xl text-stone-600 hover:text-orange-600 hover:border-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 transition-colors flex items-center justify-center gap-2 text-xs font-bold cursor-pointer"
                >
                    <Plus size={16} />
                    Thêm sản phẩm
                </button>
            </div>
        </OrderFormLayout>
    )
}
