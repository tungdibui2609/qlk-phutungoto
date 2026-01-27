'use client'

import { Plus, Save, ShoppingCart } from 'lucide-react'
import { OrderFormLayout } from '../shared/OrderFormLayout'
import { OrderGeneralInfo } from '../shared/OrderGeneralInfo'
import { PartnerSelect } from '../shared/PartnerSelect'
import { LogisticsSection } from '../shared/LogisticsSection'
import { OrderImagesSection } from '../shared/OrderImagesSection'
import { OrderDescription } from '../shared/OrderDescription'
import { OutboundItemsTable } from './OutboundItemsTable'
import { useOutboundOrder } from './useOutboundOrder'
import { OrderFormProps } from '@/components/inventory/types'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

export default function OutboundOrderModal(props: OrderFormProps<any> & { editOrderId?: string | null }) {
    const {
        code, setCode,
        customerName, setCustomerName,
        customerAddress, setCustomerAddress,
        customerPhone, setCustomerPhone,
        warehouseName, setWarehouseName,
        description, setDescription,
        items, addItem, updateItem, removeItem,
        vehicleNumber, setVehicleNumber,
        driverName, setDriverName,
        containerNumber, setContainerNumber,
        orderTypeId, setOrderTypeId,
        images, setImages,
        targetUnit, setTargetUnit,
        products, customers, branches, units, orderTypes,
        loadingData, submitting, handleSubmit,
        hasModule, confirmDialog, setConfirmDialog, handleCustomerSelect
    } = useOutboundOrder({ ...props, editOrderId: props.editOrderId })

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
                {submitting ? 'Đang lưu...' : (props.editOrderId ? 'Cập Nhật Phiếu' : 'Lưu Phiếu Xuất')}
            </button>
        </>
    )

    return (
        <>
            <OrderFormLayout
                title={
                    <>
                        <ShoppingCart className="text-orange-600" />
                        {props.editOrderId ? 'Chỉnh Sửa Phiếu Xuất' : 'Tạo Phiếu Xuất Mới'}
                    </>
                }
                subtitle="Xuất hàng, bán hàng, chuyển kho"
                onClose={props.onClose}
                maxWidth={hasModule('outbound_ui_compact') ? 'max-w-5xl' : 'max-w-7xl'}
                footer={footerButtons}
            >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {(hasModule('outbound_basic') || true) && (
                        <OrderGeneralInfo
                            type="outbound"
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

                    {hasModule('outbound_customer') && (
                        <PartnerSelect
                            type="customer"
                            label="Khách hàng"
                            partners={customers}
                            selectedId="" // Customer select is tricky because it allows custom names
                            onSelect={handleCustomerSelect}
                            address={customerAddress}
                            setAddress={setCustomerAddress}
                            phone={customerPhone}
                            setPhone={setCustomerPhone}
                            partnerName={customerName}
                            setPartnerName={setCustomerName}
                        />
                    )}
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
                    />
                )}

                <OrderDescription
                    description={description}
                    setDescription={setDescription}
                    placeholder="Diễn giải về lô hàng xuất, lý do xuất, thông tin vận chuyển..."
                />

                <OutboundItemsTable
                    items={items}
                    products={products}
                    units={units}
                    updateItem={updateItem}
                    removeItem={removeItem}
                    targetUnit={targetUnit}
                    hasModule={hasModule}
                    compact={hasModule('outbound_ui_compact')}
                />

                <button
                    onClick={addItem}
                    className="w-full py-2 border-2 border-dashed border-stone-300 dark:border-zinc-700 rounded-xl text-stone-500 hover:text-orange-500 hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors flex items-center justify-center gap-2 font-medium"
                >
                    <Plus size={20} />
                    Thêm sản phẩm
                </button>

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
