'use client'

import { Plus, Save, FileText } from 'lucide-react'
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
        orderTypeId, setOrderTypeId,
        images, setImages,
        targetUnit, setTargetUnit,
        products, suppliers, branches, units, orderTypes,
        loadingData, submitting, handleSubmit,
        hasModule
    } = useInboundOrder(props)

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
                />
            )}

            <OrderDescription description={description} setDescription={setDescription} />

            <InboundItemsTable
                items={items}
                products={products}
                units={units}
                updateItem={updateItem}
                removeItem={removeItem}
                targetUnit={targetUnit}
                hasModule={hasModule}
                compact={hasModule('inbound_ui_compact')}
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
