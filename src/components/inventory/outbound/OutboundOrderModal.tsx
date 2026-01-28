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
        hasModule, confirmDialog, setConfirmDialog, handleCustomerSelect,
        workerName, setWorkerName, teamName, setTeamName, isUtilityEnabled
    } = useOutboundOrder({ ...props, editOrderId: props.editOrderId })

    const selectedCustomerId = customers.find(c => c.name === customerName)?.id || ""

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
                    {hasModule('outbound_basic') && (
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

                    {isUtilityEnabled('site_inventory_manager') && (
                        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-sm flex flex-col gap-4">
                            <h3 className="font-bold text-stone-800 dark:text-gray-100 flex items-center gap-2">
                                <span className="text-orange-600">👷</span>
                                Thông tin cấp phát
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-stone-500 dark:text-gray-400 uppercase">Người nhận / Chỉ huy</label>
                                    <input
                                        type="text"
                                        value={workerName}
                                        onChange={(e) => setWorkerName(e.target.value)}
                                        className="w-full p-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl font-medium focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                                        placeholder="Nhập tên người nhận..."
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-stone-500 dark:text-gray-400 uppercase">Tổ đội / Hạng mục</label>
                                    <input
                                        type="text"
                                        value={teamName}
                                        onChange={(e) => setTeamName(e.target.value)}
                                        className="w-full p-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl font-medium focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                                        placeholder="Tên tổ đội hoặc hạng mục..."
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {hasModule('outbound_customer') && (
                        <PartnerSelect
                            type="customer"
                            label="Khách hàng"
                            partners={customers}
                            selectedId={selectedCustomerId}
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
