'use client'

import { useState } from 'react'
import { Plus, Save, ShoppingCart, Hash } from 'lucide-react'
import { OrderFormLayout } from '../shared/OrderFormLayout'
import { LogisticsSection } from '../shared/LogisticsSection'
import { OrderImagesSection } from '../shared/OrderImagesSection'
import { OutboundItemsTable } from './OutboundItemsTable'
import { Combobox } from '@/components/ui/Combobox'
import { useOutboundOrder } from './useOutboundOrder'
import { OrderFormProps } from '@/components/inventory/types'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

export default function OutboundOrderModal(props: OrderFormProps<any> & { editOrderId?: string | null }) {
    const isDuplicate = !!props.duplicateOrderId
    const {
        code, setCode,
        customerName, setCustomerName,
        customerAddress, setCustomerAddress,
        customerPhone, setCustomerPhone,
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
        products, customers, branches, units, orderTypes, categories,
        loadingData, submitting, handleSubmit,
        hasModule, confirmDialog, setConfirmDialog, handleCustomerSelect,
        convertUnit, checkUnbundle
    } = useOutboundOrder({ ...props, editOrderId: props.editOrderId, duplicateOrderId: props.duplicateOrderId })

    const [displayInternalCode, setDisplayInternalCode] = useState(false)

    const selectedCustomerId = customers.find(c => c.name === customerName)?.id || ""

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
                {submitting ? 'Đang lưu...' : (props.editOrderId ? 'Cập Nhật Phiếu' : 'Lưu Phiếu Xuất')}
            </button>
        </div>
    )

    return (
        <>
            <OrderFormLayout
                title={
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                            <ShoppingCart size={18} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-stone-900 dark:text-white">
                                {props.editOrderId ? 'Chỉnh Sửa Phiếu Xuất' : isDuplicate ? 'Nhân Bản Phiếu Xuất' : 'Tạo Phiếu Xuất Mới'}
                            </h2>
                            <p className="text-xs text-stone-500 font-normal mt-0.5">
                                Xuất hàng, bán hàng, chuyển kho
                            </p>
                        </div>
                    </div>
                }
                onClose={props.onClose}
                maxWidth="max-w-6xl"
                headerActions={
                    <button
                        onClick={() => setDisplayInternalCode(!displayInternalCode)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${displayInternalCode ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-gray-300'}`}
                        title="Hiển thị mã sản phẩm nội bộ"
                    >
                        <Hash size={14} /> Nhập Mã Nội Bộ
                    </button>
                }
                footer={footerButtons}
            >
                {/* 1. Compact Information Card */}
                <div className="bg-stone-50/70 dark:bg-zinc-800/40 p-3.5 rounded-xl border border-stone-200 dark:border-zinc-700 space-y-2.5">
                    {/* Row 1: Code, Date, Warehouse, Order Type, Customer, Conversion */}
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

                        {/* Kho xuất hàng */}
                        <div>
                            <label className="block text-[11px] font-semibold text-stone-600 dark:text-gray-300 mb-1">
                                Kho xuất hàng
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
                        {hasModule('outbound_type') && (
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

                        {/* Khách hàng */}
                        {hasModule('outbound_customer') && (
                            <div>
                                <label className="block text-[11px] font-semibold text-stone-600 dark:text-gray-300 mb-1">
                                    Khách hàng
                                </label>
                                <Combobox
                                    options={customers.map(c => ({
                                        value: c.id,
                                        label: c.name,
                                        sub: c.phone || c.address
                                    }))}
                                    value={selectedCustomerId}
                                    onChange={handleCustomerSelect}
                                    onSearchChange={setCustomerName}
                                    placeholder="-- Chọn khách hàng --"
                                    className="w-full text-xs"
                                    allowCustom={true}
                                />
                            </div>
                        )}

                        {/* Hiển thị quy đổi theo */}
                        {hasModule('outbound_conversion') && (
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
                        {hasModule('outbound_customer') && (
                            <>
                                <input
                                    type="text"
                                    value={customerAddress}
                                    onChange={(e) => setCustomerAddress(e.target.value)}
                                    placeholder="Địa chỉ khách hàng..."
                                    className="w-full h-8 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-stone-700 dark:text-gray-300 placeholder:text-stone-400"
                                />
                                <input
                                    type="text"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    placeholder="Số điện thoại khách hàng..."
                                    className="w-full h-8 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-stone-700 dark:text-gray-300 placeholder:text-stone-400"
                                />
                            </>
                        )}
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Diễn giải / Ghi chú trên phiếu..."
                            className={`w-full h-8 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-stone-700 dark:text-gray-300 placeholder:text-stone-400 ${!hasModule('outbound_customer') ? 'sm:col-span-3' : ''}`}
                        />
                    </div>
                </div>

                {hasModule('outbound_images') && (
                    <OrderImagesSection images={images} setImages={setImages} />
                )}

                {hasModule('outbound_logistics') && (
                    <LogisticsSection
                        title="Vận chuyển & Giao hàng"
                        vehicleNumber={vehicleNumber} setVehicleNumber={setVehicleNumber}
                        driverName={driverName} setDriverName={setDriverName}
                        containerNumber={containerNumber} setContainerNumber={setContainerNumber}
                        sealNumber={sealNumber} setSealNumber={setSealNumber}
                    />
                )}

                {/* 2. Items Table */}
                <div className="space-y-3">
                    <OutboundItemsTable
                        items={items}
                        setItems={setItems}
                        products={products}
                        units={units}
                        categories={categories}
                        updateItem={updateItem}
                        removeItem={removeItem}
                        targetUnit={targetUnit}
                        hasModule={hasModule}
                        compact={hasModule('outbound_ui_compact')}
                        displayInternalCode={displayInternalCode}
                        convertUnit={convertUnit}
                        checkUnbundle={checkUnbundle}
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

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmDialog.onConfirm}
                title={confirmDialog.title}
                message={confirmDialog.message}
            />
        </>
    )
}
