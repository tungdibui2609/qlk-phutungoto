'use client'

import { useState } from 'react'
import { Plus, Save, FileText, Hash, RefreshCw, Loader2 } from 'lucide-react'
import { OrderFormLayout } from '../shared/OrderFormLayout'
import { OrderGeneralInfo } from '../shared/OrderGeneralInfo'
import { PartnerSelect } from '../shared/PartnerSelect'
import { LogisticsSection } from '../shared/LogisticsSection'
import { OrderImagesSection } from '../shared/OrderImagesSection'
import { OrderDescription } from '../shared/OrderDescription'
import { InboundItemsTable } from './InboundItemsTable'
import { useInboundOrder } from './useInboundOrder'
import { OrderFormProps } from '@/components/inventory/types'

export default function InboundOrderModal(props: OrderFormProps<any>) {
    const {
        code, setCode,
        supplierId, handleSupplierChange,
        supplierAddress, setSupplierAddress,
        supplierPhone, setSupplierPhone,
        warehouseName, setWarehouseName,
        description, setDescription,
        items, addItem, updateItem, removeItem,
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
        <>
            <button
                onClick={props.onClose}
                className="px-6 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-gray-300 font-medium hover:bg-stone-50 dark:hover:bg-zinc-800 transition-colors"
            >
                Hủy bỏ
            </button>
            <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                <Save size={20} />
                {submitting ? 'Đang lưu...' : (props.editOrderId ? 'Cập Nhật Phiếu' : 'Lưu Phiếu Nhập')}
            </button>
        </>
    )

    return (
        <OrderFormLayout
            title={
                <>
                    <FileText className="text-orange-600" />
                    {props.editOrderId ? 'Chỉnh Sửa Phiếu Nhập' : 'Tạo Phiếu Nhập Mới'}
                </>
            }
            subtitle={props.editOrderId ? 'Cập nhật phiếu' : 'Tạo phiếu mới'}
            onClose={props.onClose}
            maxWidth={hasModule('inbound_ui_compact') ? 'max-w-5xl' : 'max-w-7xl'}
            headerActions={
                <div className="flex items-center gap-2">
                    {props.editOrderId && (
                        <button
                            onClick={handleSyncWithLot}
                            disabled={syncingWithLot}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-bold bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 transition-all disabled:opacity-50"
                            title="Tự động đồng bộ số lượng thực tế từ Lot sản xuất cùng ngày"
                        >
                            {syncingWithLot ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4" />
                            )}
                            Cân bằng theo Lot
                        </button>
                    )}
                    <button
                        onClick={() => setDisplayInternalCode(!displayInternalCode)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-bold transition-all ${displayInternalCode ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-gray-300'}`}
                        title="Hiển thị mã sản phẩm nội bộ"
                    >
                        <Hash size={16} /> Nhập Mã Nội Bộ
                    </button>
                </div>
            }
            footer={footerButtons}
        >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {(hasModule('inbound_basic') || true) && (
                    <OrderGeneralInfo
                        type="inbound"
                        code={code} setCode={setCode}
                        warehouseName={warehouseName} setWarehouseName={setWarehouseName}
                        branches={branches}
                        orderTypeId={orderTypeId} setOrderTypeId={setOrderTypeId}
                        orderTypes={orderTypes}
                        targetUnit={targetUnit} setTargetUnit={setTargetUnit}
                        units={units}
                        hasModule={hasModule}
                        createdAt={createdAt}
                        setCreatedAt={setCreatedAt}
                    />
                )}

                {hasModule('inbound_supplier') && (
                    <PartnerSelect
                        type="supplier"
                        label="Nhà cung cấp"
                        partners={suppliers}
                        selectedId={supplierId}
                        onSelect={handleSupplierChange}
                        address={supplierAddress}
                        setAddress={setSupplierAddress}
                        phone={supplierPhone}
                        setPhone={setSupplierPhone}
                    />
                )}
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

            <OrderDescription description={description} setDescription={setDescription} />

            <InboundItemsTable
                items={items}
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
                onClick={addItem}
                className="w-full py-2 border-2 border-dashed border-stone-300 dark:border-zinc-700 rounded-xl text-stone-500 hover:text-orange-500 hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors flex items-center justify-center gap-2 font-medium"
            >
                <Plus size={20} />
                Thêm sản phẩm
            </button>

        </OrderFormLayout>
    )
}
