import { useState, useEffect, useRef, useMemo } from 'react'
import { Boxes, MapPin, Building2, Calendar, CalendarClock, Factory, ShieldCheck, Package, Hash, Layers, X, Plus, Trash2, ChevronDown, Loader2, Lock, Tag, Warehouse, Fingerprint, Images, FileText, type LucideIcon } from 'lucide-react'
import { Combobox } from '@/components/ui/Combobox'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { logActivity } from '@/lib/audit'
import { parseQuantity, encodeSTT, decodeSTT, setLastUpdatedSTT } from '@/lib/numberUtils'
import { QuantityInput } from '@/components/ui/QuantityInput'
import { Lot, Product, Supplier, QCInfo, Unit, ProductUnit } from '../_hooks/useLotManagement'
import { useUser } from '@/contexts/UserContext'
import Protected from '@/components/auth/Protected'
import { extractWeightFromName, MAIN_PACKAGE_UNITS, normalizeUnit, formatUnitWeight, convertUnit } from '@/lib/unitConversion'
import { matchSearch } from '@/lib/searchUtils'
import { useToast } from '@/components/ui/ToastProvider'
import { generateUniqueLotCode } from '@/lib/lotCodeGenerator'
import { layoutService } from '@/services/warehouse/layoutService'
import { formatMaterialZoneProvince } from '@/lib/provinces'
import { getBranchesOfCompany } from '@/lib/branches'

interface LotItemInput {
    id?: string
    productId: string
    quantity: number | string
    unit: string
    tag?: string
    productionLotId?: string
    categoryId?: string | null
}

interface LotFormProps {
    isVisible: boolean
    editingLot: Lot | null
    onClose: () => void
    onSuccess: (lot?: any) => Promise<void> | void
    onDelete?: (id: string) => void

    // Common Data Props
    products: Product[]
    suppliers: Supplier[]
    qcList: QCInfo[]
    units: Unit[]
    productUnits: ProductUnit[]
    branches: any[]
    existingTags?: string[]
    initialProductionCode?: string
    /** Mặc định true: tự tính STT tăng dần khi mở form tạo mới. Truyền false để ô STT bỏ trống. */
    autoFillStt?: boolean
    /** Mặc định false: mở form tạo mới ở chế độ "Thu gọn chi tiết". */
    collapseDetailsByDefault?: boolean
    productions?: any[]
    managePermission?: string
}

const PRODUCTION_FIELDS = '*, products:product_id(*), production_lots(*, products(*))'

const SECTION_TONES = {
    indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    teal: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
    sky: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
} as const

type SectionTone = keyof typeof SECTION_TONES

function LotSectionHeader({
    icon: Icon,
    title,
    tone,
    badge,
    trailing,
}: {
    icon: LucideIcon
    title: string
    tone: SectionTone
    badge?: React.ReactNode
    trailing?: React.ReactNode
}) {
    return (
        <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${SECTION_TONES[tone]}`}>
                    <Icon size={15} />
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-200">
                    {title}
                </span>
                {badge}
            </div>
            {trailing}
        </div>
    )
}

export function LotForm({
    isVisible,
    editingLot,
    onClose,
    onSuccess,
    products,
    suppliers,
    qcList,
    units,
    productUnits,
    branches,
    existingTags = [],
    onDelete,
    initialProductionCode = '',
    autoFillStt = true,
    collapseDetailsByDefault = false,
    productions = [],
    managePermission
}: LotFormProps) {
    const { currentSystem, hasModule } = useSystem()
    const { profile } = useUser()
    const { showToast } = useToast()

    const isUtilityEnabled = (utilityId: string) => {
        if (!currentSystem?.modules) return false
        const modules = currentSystem.modules as any
        return Array.isArray(modules.utility_modules) && modules.utility_modules.includes(utilityId)
    }

    // Form State
    const [newLotCode, setNewLotCode] = useState('')
    const [newLotNotes, setNewLotNotes] = useState('')
    const [selectedSupplierId, setSelectedSupplierId] = useState('')
    const [selectedQCId, setSelectedQCId] = useState('')
    const [inboundDate, setInboundDate] = useState('')
    const [rawMaterialDate, setRawMaterialDate] = useState('')
    const [rawMaterialDates, setRawMaterialDates] = useState<string[]>([])
    const [newRawMaterialDateInput, setNewRawMaterialDateInput] = useState('')
    const [peelingDate, setPeelingDate] = useState('')
    const [peelingDates, setPeelingDates] = useState<string[]>([])
    const [newPeelingDateInput, setNewPeelingDateInput] = useState('')
    const [packagingDate, setPackagingDate] = useState('')
    const [packagingDates, setPackagingDates] = useState<string[]>([])
    const [newPackagingDateInput, setNewPackagingDateInput] = useState('')
    const [warehouseName, setWarehouseName] = useState('') // Chi nhánh nhập hàng (lots.warehouse_name)
    const [stagingAreaCode, setStagingAreaCode] = useState('') // Khu vực chờ xếp (lots.staging_area_code)
    const [batchCode, setBatchCode] = useState('')
    const [customerName, setCustomerName] = useState('')
    const [productionPlace, setProductionPlace] = useState('')
    const [productionPlaces, setProductionPlaces] = useState<string[]>([])
    const [newProductionPlaceInput, setNewProductionPlaceInput] = useState('')
    const [productionPlacesList, setProductionPlacesList] = useState<any[]>([])
    const [materialZones, setMaterialZones] = useState<string[]>([])
    const [newMaterialZoneInput, setNewMaterialZoneInput] = useState('')
    const [materialZonesList, setMaterialZonesList] = useState<any[]>([])
    const [productionCode, setProductionCode] = useState(initialProductionCode || '')
    const [images, setImages] = useState<string[]>([])
    const [extraInfo, setExtraInfo] = useState('')
    const [lotItems, setLotItems] = useState<LotItemInput[]>([{ productId: '', quantity: 0, unit: '', tag: '' }])
    const [isInitialized, setIsInitialized] = useState(false)
    const [isPersistent, setIsPersistent] = useState(false)
    const [isInfoExpanded, setIsInfoExpanded] = useState(true)
    const [selectedProductionId, setSelectedProductionId] = useState('')
    const [productionData, setProductionData] = useState<any>(null)
    const [isFetchingProduction, setIsFetchingProduction] = useState(false)
    const [warehouseLayouts, setWarehouseLayouts] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])

    useEffect(() => {
        if (!currentSystem?.code) return
        layoutService.getLayouts(currentSystem.code).then(data => {
            if (data) setWarehouseLayouts(data)
        }).catch(err => console.error('Error fetching layouts for LotForm:', err))
    }, [currentSystem?.code])

    const companyId = currentSystem?.company_id || profile?.company_id

    const scopedBranches = useMemo(
        () => getBranchesOfCompany(branches, companyId),
        [branches, companyId]
    )

    // Giá trị gợi ý mặc định: chi nhánh is_default của công ty (CN Cư M'gar với Chánh Thu)
    const defaultBranchName = useMemo(() => {
        const defaultBranch = scopedBranches.find(b => b.is_default) || scopedBranches[0]
        return defaultBranch?.name || ''
    }, [scopedBranches])

    const hasWarehouse = hasModule('warehouse_name') || hasModule('warehouse_layout_2d') || warehouseLayouts.length > 0

    // "Hàng chờ xếp kho (Khu vực Chờ)" là module riêng, không liên quan chi nhánh
    const hasStaging = hasModule('warehouse_staging_area')

    // Công ty có khai báo chi nhánh ⇒ mọi LOT (kho nào cũng vậy) bắt buộc mang chi nhánh.
    // Tenant chưa khai báo chi nhánh → giữ nguyên hành vi cũ, không chặn lưu.
    const requireBranch = hasWarehouse && scopedBranches.length > 0

    useEffect(() => {
        if (!currentSystem?.code) return
        supabase.from('categories').select('id, name').eq('system_type', currentSystem.code).order('name')
            .then(({ data }) => setCategories(data || []))
    }, [currentSystem?.code])

    // Load extra production data if needed to ensure we have latest lots
    useEffect(() => {
        const fetchCurrentProduction = async () => {
            if (!selectedProductionId) {
                setProductionData(null)
                return
            }

            setIsFetchingProduction(true)
            try {
                const { data } = await supabase
                    .from('productions')
                    .select(PRODUCTION_FIELDS)
                    .eq('id', selectedProductionId)
                    .single()
                
                if (data) {
                    setProductionData(data)
                }
            } catch (err) {
                console.error('Error fetching production details:', err)
            } finally {
                setIsFetchingProduction(false)
            }
        }

        fetchCurrentProduction()
    }, [selectedProductionId])

    // Load material zones for quick selection & traceability
    useEffect(() => {
        if (isVisible) {
            const fetchZones = async () => {
                const { data } = await (supabase.from('material_zones' as any) as any)
                    .select('id, code, name, province, location, certification')
                    .eq('is_active', true)
                    .order('code')
                if (data) setMaterialZonesList(data)
            }
            fetchZones()

            const fetchPlaces = async () => {
                try {
                    const [pRes, sRes] = await Promise.all([
                        (supabase.from('production_places' as any) as any)
                            .select('id, code, name, province, address')
                            .eq('is_active', true)
                            .order('code'),
                        (supabase.from('stamp_dictionaries' as any) as any)
                            .select('id, code, name')
                            .eq('category', 'factory')
                            .eq('is_active', true)
                            .order('sort_order')
                    ])

                    const places: any[] = pRes.data || []
                    const stampFactories: any[] = sRes.data || []

                    // Merge factory stamp rules if not already present in production_places
                    stampFactories.forEach(sf => {
                        const exists = places.some(p => 
                            String(p.name || '').trim().toLowerCase() === String(sf.name || '').trim().toLowerCase() ||
                            String(p.code || '').trim() === String(sf.code || '').trim()
                        )
                        if (!exists) {
                            places.push({
                                id: `stamp-fact-${sf.id || sf.code}`,
                                code: sf.code,
                                name: sf.name,
                                province: sf.name.includes('Đắk Lắk') ? 'Đắk Lắk' : (sf.name.includes('Bến Tre') ? 'Bến Tre' : '')
                            })
                        }
                    })

                    if (places.length > 0) {
                        setProductionPlacesList(places)
                    } else {
                        setProductionPlacesList([
                            { id: '1', code: '01', name: 'Nhà máy Bến Tre', province: 'Bến Tre' },
                            { id: '2', code: '02', name: 'Nhà máy Đắk Lắk', province: 'Đắk Lắk' },
                            { id: '3', code: '03', name: 'Phước An, Đắk Lắk', province: 'Đắk Lắk' }
                        ])
                    }
                } catch (e) {
                    setProductionPlacesList([
                        { id: '1', code: '01', name: 'Nhà máy Bến Tre', province: 'Bến Tre' },
                        { id: '2', code: '02', name: 'Nhà máy Đắk Lắk', province: 'Đắk Lắk' },
                        { id: '3', code: '03', name: 'Phước An, Đắk Lắk', province: 'Đắk Lắk' }
                    ])
                }
            }
            fetchPlaces()
        }
    }, [isVisible])

    const handleAddMaterialZone = (zoneVal?: string) => {
        const rawVal = (zoneVal || newMaterialZoneInput).trim()
        if (!rawVal) return
        const prov = formatMaterialZoneProvince(rawVal, materialZonesList) || rawVal
        if (!materialZones.includes(prov)) {
            setMaterialZones(prev => [...prev, prov])
        }
        setNewMaterialZoneInput('')
    }

    const handleRemoveMaterialZone = (zoneToRemove: string) => {
        setMaterialZones(prev => prev.filter(z => z !== zoneToRemove))
    }

    const handleAddProductionPlace = (placeVal?: string) => {
        const val = (placeVal || newProductionPlaceInput).trim()
        if (!val) return
        if (!productionPlaces.includes(val)) {
            setProductionPlaces(prev => [...prev, val])
        }
        setNewProductionPlaceInput('')
    }

    const handleRemoveProductionPlace = (placeToRemove: string) => {
        setProductionPlaces(prev => prev.filter(p => p !== placeToRemove))
    }

    const [dailySeq, setDailySeq] = useState<number | string>('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Product filtering based on selected production - Multi-item support
    const selectedProduction = productionData || productions.find((p: any) => p.id === selectedProductionId)
    let availableProducts = products
    if (selectedProductionId) {
        // IDs from main field and multiple item fields
        const linkedProductIds = new Set<string>()
        const supplementalProducts: any[] = []

        if (selectedProduction?.product_id) linkedProductIds.add(selectedProduction.product_id)
        if (selectedProduction?.products) supplementalProducts.push(selectedProduction.products)

        // Add products from production_lots list
        if (Array.isArray(selectedProduction?.production_lots)) {
            selectedProduction.production_lots.forEach((pl: any) => {
                if (pl.products?.id) {
                    linkedProductIds.add(pl.products.id)
                    supplementalProducts.push(pl.products)
                }
            })
        }

        // Filter current products list
        availableProducts = products.filter(p => linkedProductIds.has(p.id))

        // Supplemental check: Ensure products from join data are included (handles system_type mismatch)
        supplementalProducts.forEach(sp => {
            if (!availableProducts.some(p => p.id === sp.id)) {
                availableProducts.push(sp)
            }
        })
    }
    
    const unitNameMap = useMemo(() => {
        const map = new Map<string, string>()
        units.forEach(u => {
            map.set(normalizeUnit(u.name), u.id)
        })
        return map
    }, [units])

    const conversionMap = useMemo(() => {
        const map = new Map<string, Map<string, number>>()
        productUnits.forEach(pu => {
            if (!map.has(pu.product_id)) {
                map.set(pu.product_id, new Map())
            }
            map.get(pu.product_id)?.set(pu.unit_id, pu.conversion_rate || 1)
        })
        return map
    }, [productUnits])

    const formRef = useRef<HTMLDivElement>(null)
    const initializedKeyRef = useRef<string | null>(null)
    const hasUserEditedSttRef = useRef(false)
    const sttRequestIdRef = useRef(0)

    // Separate Effect for initialProductionCode to ensure it's always applied in Create Mode
    useEffect(() => {
        if (isVisible && !editingLot && initialProductionCode) {
            setProductionCode(initialProductionCode)
        }
    }, [isVisible, editingLot, initialProductionCode])

    // Bổ sung kho mặc định nếu danh sách chi nhánh tải xong sau khi mở form
    // (áp dụng cả LOT cũ đang thiếu chi nhánh để sửa lại ngay khi mở form)
    useEffect(() => {
        if (isVisible && !warehouseName && defaultBranchName && (!editingLot || !editingLot.warehouse_name)) {
            setWarehouseName(defaultBranchName)
        }
    }, [isVisible, editingLot, warehouseName, defaultBranchName])

    // Reset or Initialize Form (chỉ khởi tạo 1 lần khi mở form hoặc khi đổi editingLot/system)
    useEffect(() => {
        if (!isVisible) {
            initializedKeyRef.current = null
            hasUserEditedSttRef.current = false
            setIsInitialized(false)
            return
        }

        const currentInitKey = `${editingLot ? editingLot.id : 'CREATE'}_${currentSystem?.code || ''}`
        if (initializedKeyRef.current === currentInitKey) {
            return
        }
        initializedKeyRef.current = currentInitKey
        hasUserEditedSttRef.current = false

        if (isVisible) {
            if (editingLot) {
                // Edit Mode
                setNewLotCode(editingLot.code)
                setDailySeq(decodeSTT(editingLot.daily_seq))
                setNewLotNotes(editingLot.notes || '')
                setProductionCode(editingLot.production_code || '')
                setSelectedProductionId(editingLot.production_id || '')

                // Populate items
                if (editingLot.lot_items && editingLot.lot_items.length > 0) {
                    setLotItems(editingLot.lot_items.map((item: any) => {
                        const rawUnit = (item as any).unit || ''
                        
                        // Chuẩn hóa và so khớp đơn vị để tránh bị tự động nhảy sang option đầu tiên khi chỉnh sửa
                        let matchedUnit = rawUnit
                        const product = products.find(p => p.id === item.product_id)
                        if (product) {
                            const baseUnit = product.unit || ''
                            let baseWeight = (product as any).weight_kg || 0
                            const normBase = normalizeUnit(baseUnit)
                            if (baseWeight <= 0 && (normBase === 'kg' || normBase === 'kilogram')) {
                                baseWeight = 1
                            }
                            
                            const availableUnits = new Set<string>()
                            const formattedBaseUnit = formatUnitWeight(baseUnit, baseWeight)
                            if (baseUnit) availableUnits.add(formattedBaseUnit)
                            
                            const pUnitsOfProduct = productUnits.filter((pu: any) => pu.product_id === item.product_id)
                            pUnitsOfProduct.forEach((pu: any) => {
                                const u = units.find((u: any) => u.id === pu.unit_id)
                                if (u) {
                                    const normU = normalizeUnit(u.name)
                                    if (normU === normalizeUnit(baseUnit)) return
                                    const weight = (pu.conversion_rate || 1) * baseWeight
                                    const labelStr = formatUnitWeight(u.name, weight)
                                    availableUnits.add(labelStr)
                                }
                            })
                            
                            const options = Array.from(availableUnits)
                            
                            // 1. Nếu không khớp hoàn hảo, tìm giải pháp thay thế phù hợp
                            if (!options.includes(rawUnit)) {
                                // 2. So khớp chuẩn hóa (không khoảng trắng, chữ thường)
                                const normRaw = rawUnit.normalize('NFC').toLowerCase().replace(/\s+/g, '')
                                const foundNorm = options.find(opt => opt.normalize('NFC').toLowerCase().replace(/\s+/g, '') === normRaw)
                                
                                if (foundNorm) {
                                    matchedUnit = foundNorm
                                } else {
                                    // 3. So khớp theo tên đơn vị gốc (ví dụ: "Thùng" -> "Thùng (20kg)")
                                    const rawBaseName = rawUnit.split('(')[0].trim().toLowerCase()
                                    const foundBase = options.find(opt => opt.split('(')[0].trim().toLowerCase() === rawBaseName)
                                    if (foundBase) {
                                        matchedUnit = foundBase
                                    }
                                }
                            }
                        }

                        return {
                            id: item.id,
                            productId: item.product_id,
                            quantity: item.quantity,
                            unit: matchedUnit,
                            tag: editingLot.lot_tags?.find((t: any) => t.lot_item_id === item.id && !t.tag.startsWith('MERGED_') && !t.tag.startsWith('SPLIT_'))?.tag ||
                                 editingLot.lot_tags?.find((t: any) => !t.lot_item_id && !t.tag.startsWith('MERGED_') && !t.tag.startsWith('SPLIT_'))?.tag ||
                                 (editingLot.metadata as any)?.pallet_tag ||
                                 (editingLot.metadata as any)?.tag ||
                                 editingLot.box_labels?.map((b: any) => b.metadata?.pallet_tag || b.metadata?.tag).find(Boolean) || '',
                            productionLotId: (editingLot as any).production_lot_id || '',
                            categoryId: item.category_id || product?.category_id || ''
                        }
                    }))
                } else {
                    setLotItems([{ productId: '', quantity: 0, unit: '', tag: '' }])
                }

                setSelectedSupplierId(editingLot.supplier_id || '')
                setSelectedQCId(editingLot.qc_id || '')
                setInboundDate(editingLot.inbound_date ? new Date(editingLot.inbound_date).toISOString().split('T')[0] : '')
                const editRDate = editingLot.raw_material_date ? new Date(editingLot.raw_material_date).toISOString().split('T')[0] : ''
                setRawMaterialDate(editRDate)
                let initialRawDates: string[] = []
                const metaRawDates = (editingLot.metadata as any)?.raw_material_dates || (editingLot.metadata as any)?.manual_raw_material_dates
                if (Array.isArray(metaRawDates) && metaRawDates.length > 0) {
                    initialRawDates = metaRawDates.map((d: any) => {
                        try {
                            return typeof d === 'string' && d.includes('T') ? d.split('T')[0] : String(d).split('T')[0]
                        } catch {
                            return String(d)
                        }
                    }).filter(Boolean)
                } else if (editRDate) {
                    initialRawDates = [editRDate]
                }
                setRawMaterialDates(initialRawDates)
                setNewRawMaterialDateInput('')

                const editPDate = editingLot.peeling_date ? new Date(editingLot.peeling_date).toISOString().split('T')[0] : ''
                setPeelingDate(editPDate)
                let initialPeelingDates: string[] = []
                const metaDates = (editingLot.metadata as any)?.peeling_dates || (editingLot.metadata as any)?.production_dates
                if (Array.isArray(metaDates) && metaDates.length > 0) {
                    initialPeelingDates = metaDates.map((d: any) => {
                        try {
                            return typeof d === 'string' && d.includes('T') ? d.split('T')[0] : String(d).split('T')[0]
                        } catch {
                            return String(d)
                        }
                    }).filter(Boolean)
                } else if (editPDate) {
                    initialPeelingDates = [editPDate]
                }
                setPeelingDates(initialPeelingDates)
                setNewPeelingDateInput('')

                const editPackDate = editingLot.packaging_date ? new Date(editingLot.packaging_date).toISOString().split('T')[0] : ''
                setPackagingDate(editPackDate)
                let initialPackDates: string[] = []
                const metaPackDates = (editingLot.metadata as any)?.packaging_dates || (editingLot.metadata as any)?.manual_packaging_dates
                if (Array.isArray(metaPackDates) && metaPackDates.length > 0) {
                    initialPackDates = metaPackDates.map((d: any) => {
                        try {
                            return typeof d === 'string' && d.includes('T') ? d.split('T')[0] : String(d).split('T')[0]
                        } catch {
                            return String(d)
                        }
                    }).filter(Boolean)
                } else if (editPackDate) {
                    initialPackDates = [editPackDate]
                }
                setPackagingDates(initialPackDates)
                setNewPackagingDateInput('')
                setWarehouseName(editingLot.warehouse_name || defaultBranchName)
                setStagingAreaCode(editingLot.staging_area_code || '')
                setBatchCode(editingLot.batch_code || '')
                setProductionCode(editingLot.production_code || '')

                // Handle images
                let imgs: string[] = []
                if (Array.isArray(editingLot.images)) imgs = editingLot.images
                else if (typeof editingLot.images === 'string') {
                    try { imgs = JSON.parse(editingLot.images) } catch (e) { imgs = [] }
                }
                setImages(imgs)

                // Handle metadata
                let meta: any = {}
                if (editingLot.metadata && typeof editingLot.metadata === 'object') meta = editingLot.metadata
                else if (typeof editingLot.metadata === 'string') {
                    try { meta = JSON.parse(editingLot.metadata) } catch (e) { meta = {} }
                }
                setExtraInfo(meta.extra_info || '')
                setCustomerName(meta.customer_name || meta.oem_brand || '')
                const rawPp = meta.production_places || (meta.production_place ? meta.production_place.split(',').map((s: string) => s.trim()).filter(Boolean) : [])
                const loadedPlaces = Array.isArray(rawPp) ? rawPp : []
                setProductionPlaces(loadedPlaces)
                setProductionPlace(loadedPlaces.join(', '))
                setNewProductionPlaceInput('')
                const rawMz = meta.material_zones || (meta.material_zone ? meta.material_zone.split(',').map((s: string) => s.trim()).filter(Boolean) : [])
                const cleanMzList = Array.from(new Set(rawMz.map((z: string) => formatMaterialZoneProvince(z, materialZonesList) || z).filter(Boolean)))
                setMaterialZones(cleanMzList as string[])
                setNewMaterialZoneInput('')

            } else {
                let initialDate = new Date().toISOString().split('T')[0]
                // Create Mode - Load sticky values from localStorage
                const stickyData = localStorage.getItem('LOT_FORM_STICKY_DATA')
                if (stickyData) {
                    try {
                        const parsed = JSON.parse(stickyData)
                        setIsPersistent(!!parsed.isPersistent)
                        if (parsed.isInfoExpanded !== undefined) setIsInfoExpanded(parsed.isInfoExpanded)

                        if (parsed.isPersistent) {
                            // Reset non-persistent fields first to ensure no leaks
                            setImages([])
                            setNewLotNotes('')

                            // Validate and restore Supplier
                            if (parsed.supplierId && suppliers.some(s => s.id === parsed.supplierId)) {
                                setSelectedSupplierId(parsed.supplierId)
                            }

                            // Validate and restore QC
                            if (parsed.qcId && qcList.some(q => q.id === parsed.qcId)) {
                                setSelectedQCId(parsed.qcId)
                            }

                            if (parsed.peelingDates && Array.isArray(parsed.peelingDates) && parsed.peelingDates.length > 0) {
                                setPeelingDates(parsed.peelingDates)
                                setPeelingDate(parsed.peelingDates[0] || parsed.peelingDate || '')
                            } else if (parsed.peelingDate) {
                                setPeelingDate(parsed.peelingDate)
                                setPeelingDates([parsed.peelingDate])
                            } else {
                                setPeelingDate('')
                                setPeelingDates([])
                            }
                            setNewPeelingDateInput('')
                            if (parsed.rawMaterialDates && Array.isArray(parsed.rawMaterialDates) && parsed.rawMaterialDates.length > 0) {
                                setRawMaterialDates(parsed.rawMaterialDates)
                                setRawMaterialDate(parsed.rawMaterialDates[0] || parsed.rawMaterialDate || '')
                            } else if (parsed.rawMaterialDate) {
                                setRawMaterialDate(parsed.rawMaterialDate)
                                setRawMaterialDates([parsed.rawMaterialDate])
                            } else {
                                setRawMaterialDate('')
                                setRawMaterialDates([])
                            }
                            setNewRawMaterialDateInput('')

                            if (parsed.packagingDates && Array.isArray(parsed.packagingDates) && parsed.packagingDates.length > 0) {
                                setPackagingDates(parsed.packagingDates)
                                setPackagingDate(parsed.packagingDates[0] || parsed.packagingDate || '')
                            } else if (parsed.packagingDate) {
                                setPackagingDate(parsed.packagingDate)
                                setPackagingDates([parsed.packagingDate])
                            } else {
                                setPackagingDate('')
                                setPackagingDates([])
                            }
                            setNewPackagingDateInput('')

                            // Validate and restore Warehouse
                            if (parsed.warehouseName && branches.some(b => b.name === parsed.warehouseName)) {
                                setWarehouseName(parsed.warehouseName)
                            } else if (defaultBranchName) {
                                setWarehouseName(defaultBranchName)
                            }

                            if (parsed.productionCode && currentSystem?.code === 'SANXUAT') {
                                setProductionCode(parsed.productionCode)
                            } else if (currentSystem?.code !== 'SANXUAT' && !parsed.productionCode) {
                                setProductionCode('') 
                            }

                            if (parsed.selectedProductionId) {
                                setSelectedProductionId(parsed.selectedProductionId)
                            }
                            if (parsed.batchCode) setBatchCode(parsed.batchCode)
                            if (parsed.customerName) setCustomerName(parsed.customerName)
                            if (parsed.productionPlaces && Array.isArray(parsed.productionPlaces)) {
                                setProductionPlaces(parsed.productionPlaces)
                                setProductionPlace(parsed.productionPlaces.join(', '))
                            } else if (parsed.productionPlace) {
                                const arr = parsed.productionPlace.split(',').map((s: string) => s.trim()).filter(Boolean)
                                setProductionPlaces(arr)
                                setProductionPlace(parsed.productionPlace)
                            }
                            if (parsed.materialZones && Array.isArray(parsed.materialZones)) {
                                setMaterialZones(parsed.materialZones)
                            } else if (parsed.materialZone) {
                                const arr = parsed.materialZone.split(',').map((s: string) => s.trim()).filter(Boolean)
                                setMaterialZones(arr)
                            }
                            if (parsed.extraInfo) setExtraInfo(parsed.extraInfo.toUpperCase())
                            if (parsed.inboundDate) {
                                setInboundDate(parsed.inboundDate)
                                initialDate = parsed.inboundDate
                            } else {
                                setInboundDate(initialDate)
                            }
                            if (parsed.lotItems) setLotItems(parsed.lotItems.map((it: any) => ({
                                ...it,
                                categoryId: it.categoryId || products.find(p => p.id === it.productId)?.category_id || ''
                            })))
                            setDailySeq('')
                        } else {
                            resetForm()
                            setInboundDate(initialDate)
                            setPeelingDate(initialDate)
                            setPeelingDates([initialDate])
                            setPackagingDate(initialDate)
                            setPackagingDates([initialDate])

                            if (defaultBranchName) {
                                setWarehouseName(defaultBranchName)
                            }
                        }
                    } catch (e) {
                        console.error('Failed to parse sticky data', e)
                        setInboundDate(initialDate)
                    }
                } else {
                    // Defaults if no sticky data
                    resetForm()
                    setInboundDate(initialDate)
                    setPeelingDate(initialDate)
                    setPeelingDates([initialDate])
                    setPackagingDate(initialDate)

                    if (defaultBranchName) {
                        setWarehouseName(defaultBranchName)
                    }
                    if (currentSystem?.code !== 'SANXUAT') {
                        setProductionCode('')
                    }
                }

                // CRITICAL: Always apply initialProductionCode LAST in Create Mode
                // This ensures it overrides both resetForm() and sticky data restoration
                if (initialProductionCode) {
                    setProductionCode(initialProductionCode)
                    // Auto-collapse if we have an initial code (often auto-generated flow)
                    setIsInfoExpanded(false)
                }

                generateLotCode(initialDate)
            }

            if (collapseDetailsByDefault) {
                setIsInfoExpanded(false)
            }

            setIsInitialized(true)

            // Scroll to form
            setTimeout(() => {
                if (formRef.current) {
                    const y = formRef.current.getBoundingClientRect().top + window.scrollY - 100
                    window.scrollTo({ top: y, behavior: 'smooth' })
                }
            }, 100)
        }
    }, [isVisible, editingLot, branches, initialProductionCode, suppliers, qcList, currentSystem])

    // Save sticky values to localStorage in Create Mode
    useEffect(() => {
        if (isVisible && !editingLot && isInitialized) {
            const stickyData = {
                isPersistent,
                supplierId: isPersistent ? selectedSupplierId : '',
                qcId: isPersistent ? selectedQCId : '',
                peelingDate: isPersistent ? (peelingDates[0] || peelingDate) : '',
                peelingDates: isPersistent ? peelingDates : [],
                packagingDate: isPersistent ? (packagingDates[0] || packagingDate) : '',
                packagingDates: isPersistent ? packagingDates : [],
                warehouseName: isPersistent ? warehouseName : '',
                batchCode: isPersistent ? batchCode : '',
                customerName: isPersistent ? customerName : '',
                productionPlace: isPersistent ? (productionPlaces.length > 0 ? productionPlaces.join(', ') : productionPlace) : '',
                productionPlaces: isPersistent ? productionPlaces : [],
                materialZones: isPersistent ? materialZones : [],
                materialZone: isPersistent ? materialZones.join(', ') : '',
                productionCode: isPersistent ? productionCode : '',
                selectedProductionId: isPersistent ? selectedProductionId : '',
                extraInfo: isPersistent ? extraInfo : '',
                inboundDate: isPersistent ? inboundDate : '',
                rawMaterialDate: isPersistent ? (rawMaterialDates[0] || rawMaterialDate) : '',
                rawMaterialDates: isPersistent ? rawMaterialDates : [],
                lotItems: isPersistent ? lotItems : [],
                dailySeq: isPersistent ? dailySeq : '',
                isInfoExpanded: isInfoExpanded
            }
            localStorage.setItem('LOT_FORM_STICKY_DATA', JSON.stringify(stickyData))
        }
    }, [
        isVisible,
        editingLot,
        isInitialized,
        isPersistent,
        selectedSupplierId,
        selectedQCId,
        peelingDate,
        peelingDates,
        packagingDate,
        packagingDates,
        warehouseName,
        batchCode,
        customerName,
        productionPlace,
        productionPlaces,
        productionCode,
        selectedProductionId,
        extraInfo,
        inboundDate,
        rawMaterialDate,
        rawMaterialDates,
        lotItems,
        qcList,
        branches,
        currentSystem
    ])

    // ĐÃ TÁCH BIỆT STT VÀ MÃ LOT: Không tự động chạy lại generateLotCode khi chỉnh sửa ngày nhập kho hoặc thông tin khác để tránh ghi đè STT người dùng đã nhập.

    function resetForm() {
        setNewLotCode('')
        setNewLotNotes('')
        setSelectedSupplierId('')
        setSelectedQCId('')
        setInboundDate('')
        setRawMaterialDate('')
        setRawMaterialDates([])
        setNewRawMaterialDateInput('')
        setPeelingDate('')
        setPeelingDates([])
        setNewPeelingDateInput('')
        setPackagingDate('')
        setPackagingDates([])
        setNewPackagingDateInput('')
        setWarehouseName('')
        setStagingAreaCode('')
        setBatchCode('')
        setCustomerName('')
        setProductionPlace('')
        setProductionPlaces([])
        setNewProductionPlaceInput('')
        setMaterialZones([])
        setNewMaterialZoneInput('')
        setProductionCode('')
        setImages([])
        setExtraInfo('')
        setLotItems([{ productId: '', quantity: 0, unit: '' }])
        setDailySeq('')
    }

    async function generateLotCode(targetInboundDate?: string) {
        if (!currentSystem?.name) return;

        const currentReqId = ++sttRequestIdRef.current

        const uniqueCode = await generateUniqueLotCode(supabase, currentSystem.name)
        if (currentReqId !== sttRequestIdRef.current) return
        setNewLotCode(uniqueCode)

        if (!autoFillStt) return

        // -- TÍNH TOÁN STT DÁN THÙNG (DỰA TRÊN STT GẦN NHẤT ĐỂ TĂNG LÊN, KHÔNG TRÙNG LẶP) --
        const { data: recentLots } = await supabase
            .from('lots')
            .select('daily_seq, code, created_at')
            .eq('system_code', currentSystem.code)
            .neq('status', 'hidden')
            .neq('status', 'exported')
            .not('daily_seq', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1000)

        if (currentReqId !== sttRequestIdRef.current || hasUserEditedSttRef.current) return

        let nextDailySeq = 1
        if (recentLots && recentLots.length > 0) {
            const usedSeqs = new Set<number>(
                recentLots
                    .map((l: any) => Number(l.daily_seq))
                    .filter((s: number) => !isNaN(s) && s > 0)
            )

            // Lọc các lô hợp lệ (hỗ trợ cả mã LOT ngẫu nhiên mới DL-LOT-XXXXXX và mã cũ,
            // chỉ loại bỏ các lô tự động sinh từ tem in sản xuất có đuôi mã >= 4 chữ số trùng với daily_seq như ...-101904)
            const validRecentLots = recentLots.filter((l: any) => {
                const seq = Number(l.daily_seq)
                if (!seq || isNaN(seq) || seq <= 0 || seq >= 2700000) return false
                if (l.code) {
                    const parts = String(l.code).split('-')
                    const lastPart = parts[parts.length - 1] || ''
                    if (/^\d{4,}$/.test(lastPart) && Number(lastPart) === seq) {
                        return false
                    }
                }
                return true
            })

            if (validRecentLots.length > 0) {
                // Lấy STT của lô được tạo gần nhất và tăng lên 1 (nếu trùng với lô đang tồn tại thì tiếp tục tăng)
                const latestSeq = Number((validRecentLots[0] as any).daily_seq)
                nextDailySeq = latestSeq + 1
                while (usedSeqs.has(nextDailySeq)) {
                    nextDailySeq++
                }
            }
        }

        if (!hasUserEditedSttRef.current) {
            setDailySeq(decodeSTT(nextDailySeq))
        }
    }

    const handleAddPeelingDate = (dateToAdd?: string) => {
        const target = (dateToAdd || newPeelingDateInput || '').trim()
        if (!target) return
        if (!peelingDates.includes(target)) {
            const next = [...peelingDates, target].sort()
            setPeelingDates(next)
            setPeelingDate(next[0] || '')
        }
        setNewPeelingDateInput('')
    }

    const handleRemovePeelingDate = (dateToRemove: string) => {
        const next = peelingDates.filter(d => d !== dateToRemove)
        setPeelingDates(next)
        setPeelingDate(next[0] || '')
    }

    const handleAddRawMaterialDate = (dateToAdd?: string) => {
        const target = (dateToAdd || newRawMaterialDateInput || '').trim()
        if (!target) return
        if (!rawMaterialDates.includes(target)) {
            const next = [...rawMaterialDates, target].sort()
            setRawMaterialDates(next)
            setRawMaterialDate(next[0] || '')
        }
        setNewRawMaterialDateInput('')
    }

    const handleRemoveRawMaterialDate = (dateToRemove: string) => {
        const next = rawMaterialDates.filter(d => d !== dateToRemove)
        setRawMaterialDates(next)
        setRawMaterialDate(next[0] || '')
    }

    const handleAddPackagingDate = (dateToAdd?: string) => {
        const target = (dateToAdd || newPackagingDateInput || '').trim()
        if (!target) return
        if (!packagingDates.includes(target)) {
            const next = [...packagingDates, target].sort()
            setPackagingDates(next)
            setPackagingDate(next[0] || '')
        }
        setNewPackagingDateInput('')
    }

    const handleRemovePackagingDate = (dateToRemove: string) => {
        const next = packagingDates.filter(d => d !== dateToRemove)
        setPackagingDates(next)
        setPackagingDate(next[0] || '')
    }

    async function handleSubmit() {
        if (!newLotCode.trim() || isSubmitting) return

        if (requireBranch && !warehouseName.trim()) {
            setIsInfoExpanded(true)
            showToast('Bắt buộc chọn Chi nhánh nhập hàng trước khi lưu LOT', 'error')
            return
        }

        setIsSubmitting(true)

        try {

        const processedItems = lotItems.map(item => ({
            ...item,
            quantity: parseQuantity(item.quantity)
        }))
        const validItems = processedItems.filter(item => item.productId && item.quantity > 0)
        const totalQuantity = Number(validItems.reduce((sum, item) => sum + item.quantity, 0).toFixed(6))

        // Prepare History Entry
        let systemHistory: any = (editingLot?.metadata as any)?.system_history || { exports: [], inbound: [] }
        const syncEnabled = isUtilityEnabled('lot_accounting_sync')

        if (!editingLot) {
            if (syncEnabled) {
                const inboundItems: Record<string, any> = {}
                validItems.forEach((item, idx) => {
                    const product = products.find(p => p.id === item.productId)
                    inboundItems[idx] = {
                        product_id: item.productId,
                        product_sku: product?.sku,
                        product_name: product?.name,
                        quantity: item.quantity,
                        unit: item.unit,
                        price: (product as any)?.cost_price || 0,
                        category_id: item.categoryId || null
                    }
                })

                if (!systemHistory.inbound) systemHistory.inbound = []
                systemHistory.inbound.push({
                    id: crypto.randomUUID(),
                    date: new Date().toISOString(),
                    supplier_id: selectedSupplierId || null,
                    supplier_name: suppliers.find(s => s.id === selectedSupplierId)?.name || 'N/A',
                    items: inboundItems,
                    draft: true // Marked as draft for the inbound buffer
                })
            }
        } else {
            // Calculate detailed changes for audit trail
            const changes: string[] = []
            if (editingLot) {
                if (editingLot.notes !== newLotNotes) changes.push(`Ghi chú: ${editingLot.notes || 'Trống'} → ${newLotNotes || 'Trống'}`)
                if (editingLot.supplier_id !== selectedSupplierId) {
                    const oldS = suppliers.find(s => s.id === editingLot.supplier_id)?.name || 'N/A'
                    const newS = suppliers.find(s => s.id === selectedSupplierId)?.name || 'N/A'
                    changes.push(`Nhà cung cấp: ${oldS} → ${newS}`)
                }
                if (editingLot.qc_id !== selectedQCId) {
                    const oldQ = qcList.find(q => q.id === editingLot.qc_id)?.name || 'N/A'
                    const newQ = qcList.find(q => q.id === selectedQCId)?.name || 'N/A'
                    changes.push(`QC: ${oldQ} → ${newQ}`)
                }
                if (editingLot.warehouse_name !== warehouseName) changes.push(`Chi nhánh: ${editingLot.warehouse_name || 'N/A'} → ${warehouseName || 'N/A'}`)
                if (hasStaging && ((editingLot.staging_area_code || '') !== stagingAreaCode.trim())) {
                    changes.push(`Khu vực Chờ: ${(editingLot.staging_area_code || 'Trống').toUpperCase()} → ${(stagingAreaCode.trim() || 'Trống').toUpperCase()}`)
                }
                if (editingLot.batch_code !== batchCode) changes.push(`Batch NCC: ${editingLot.batch_code || 'N/A'} → ${batchCode || 'N/A'}`)
                const oldCust = (editingLot.metadata as any)?.customer_name || ''
                if (oldCust !== customerName) changes.push(`Khách OEM: ${oldCust || 'N/A'} → ${customerName || 'N/A'}`)
                if (editingLot.quantity !== totalQuantity) changes.push(`Tổng SL: ${editingLot.quantity} → ${totalQuantity}`)
            }

            // ALWAYS log the manual edit metadata for audit trail
            if (!systemHistory.edits) systemHistory.edits = []
            systemHistory.edits.push({
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                actor: profile?.full_name || profile?.email || 'Unknown',
                description: 'Cập nhật thông tin lô hàng',
                changes: changes.length > 0 ? changes : undefined
            })

            if (syncEnabled) {
                // Edit Mode: Update existing draft or create adjustment
                const freshCreationDraftIdx = systemHistory.inbound ? systemHistory.inbound.findIndex((inb: any) => inb.draft === true && !inb.is_adjustment) : -1

                if (freshCreationDraftIdx >= 0) {
                    // Scenario A: Lot is still in "Pending Sync (Full Receive)" state.
                    // Update existing draft to reflect new state (Full List)
                    const inboundItems: Record<string, any> = {}
                    validItems.forEach((item, idx) => {
                        const product = products.find(p => p.id === item.productId)
                        inboundItems[idx] = {
                            product_id: item.productId,
                            product_sku: product?.sku,
                            product_name: product?.name,
                            quantity: item.quantity,
                            unit: item.unit,
                            price: (product as any)?.cost_price || 0,
                            category_id: item.categoryId || null
                        }
                    })

                    systemHistory.inbound[freshCreationDraftIdx] = {
                        ...systemHistory.inbound[freshCreationDraftIdx],
                        supplier_id: selectedSupplierId || null,
                        supplier_name: suppliers.find(s => s.id === selectedSupplierId)?.name || 'N/A',
                        items: inboundItems,
                        is_edit: true,
                        updated_at: new Date().toISOString()
                    }
                } else {
                    // Scenario B: Lot was finalized or already adjusted. Calculate DELTA.

                    // 1. Snapshot OLD items for diffing
                    const oldItemsMap: Record<string, number> = {}
                    if (editingLot.lot_items) {
                        editingLot.lot_items.forEach((li: any) => {
                            const effCat = li.category_id || products.find(p => p.id === li.product_id)?.category_id || ''
                            const key = `${li.product_id}|${(li as any).unit || ''}|${effCat}`
                            oldItemsMap[key] = (oldItemsMap[key] || 0) + li.quantity
                        })
                    }

                    // 2. Snapshot NEW items
                    const newItemsMap: Record<string, number> = {}
                    validItems.forEach(item => {
                        const key = `${item.productId}|${item.unit || ''}|${item.categoryId || ''}`
                        newItemsMap[key] = (newItemsMap[key] || 0) + item.quantity
                    })

                    // 3. Calculate Deltas
                    const allKeys = new Set([...Object.keys(oldItemsMap), ...Object.keys(newItemsMap)])
                    const inboundAdjustmentItems: Record<string, any> = {}
                    const outboundAdjustmentItems: Record<string, any> = {}

                    let inIdx = 0
                    let outIdx = 0

                    allKeys.forEach(key => {
                        const oldQty = oldItemsMap[key] || 0
                        const newQty = newItemsMap[key] || 0
                        const diff = newQty - oldQty

                        const parts = key.split('|')
                        const pId = parts[0]
                        const unitName = parts.slice(1, -1).join('|')
                        const catId = parts[parts.length - 1] || null
                        const product = products.find(p => p.id === pId)

                        if (diff > 0.000001) {
                            inboundAdjustmentItems[inIdx++] = {
                                product_id: pId,
                                product_sku: product?.sku,
                                product_name: product?.name,
                                quantity: Number(diff.toFixed(6)),
                                unit: unitName,
                                price: (product as any)?.cost_price || 0,
                                category_id: catId
                            }
                        } else if (diff < -0.000001) {
                            outboundAdjustmentItems[outIdx++] = {
                                product_id: pId,
                                product_sku: product?.sku,
                                product_name: product?.name,
                                exported_quantity: Number(Math.abs(diff).toFixed(6)),
                                unit: unitName,
                                cost_price: (product as any)?.cost_price || 0,
                                category_id: catId
                            }
                        }
                    })

                    if (Object.keys(inboundAdjustmentItems).length > 0) {
                        if (!systemHistory.accounting_sync) systemHistory.accounting_sync = {}
                        if (!systemHistory.accounting_sync.inbound) systemHistory.accounting_sync.inbound = []
                        systemHistory.accounting_sync.inbound.push({
                            id: crypto.randomUUID(),
                            date: new Date().toISOString(),
                            supplier_id: selectedSupplierId || null,
                            supplier_name: suppliers.find(s => s.id === selectedSupplierId)?.name || 'N/A',
                            items: inboundAdjustmentItems,
                            draft: true,
                            is_edit: true,
                            is_adjustment: true,
                            description: `Điều chỉnh tăng số lượng LOT ${editingLot.code}`
                        })
                    }

                    if (Object.keys(outboundAdjustmentItems).length > 0) {
                        if (!systemHistory.accounting_sync) systemHistory.accounting_sync = {}
                        if (!systemHistory.accounting_sync.exports) systemHistory.accounting_sync.exports = []
                        systemHistory.accounting_sync.exports.push({
                            id: crypto.randomUUID(),
                            date: new Date().toISOString(),
                            customer: 'Hệ thống (Điều chỉnh)',
                            description: `Điều chỉnh giảm số lượng LOT ${editingLot.code}`,
                            location_code: editingLot.warehouse_name || warehouseName || null,
                            items: outboundAdjustmentItems,
                            draft: true,
                            is_edit: true,
                            is_adjustment: true
                        })
                    }
                }
            }
        }

        const primaryRawMaterialDate = rawMaterialDates.length > 0 ? rawMaterialDates[0] : (rawMaterialDate || null)
        const primaryPeelingDate = peelingDates.length > 0 ? peelingDates[0] : (peelingDate || null)
        const primaryPackagingDate = packagingDates.length > 0 ? packagingDates[0] : (packagingDate || null)

        const lotData = {
            code: newLotCode,
            notes: newLotNotes,
            supplier_id: selectedSupplierId || null,
            qc_id: selectedQCId || null,
            inbound_date: inboundDate || null,
            raw_material_date: primaryRawMaterialDate,
            peeling_date: primaryPeelingDate,
            packaging_date: primaryPackagingDate,
            warehouse_name: warehouseName || null,
            // Chỉ ghi khi phân hệ bật module "Hàng chờ xếp kho" → không đụng tới dữ liệu phân hệ chưa bật
            ...(hasStaging ? { staging_area_code: stagingAreaCode.trim().toUpperCase() || null } : {}),
            batch_code: batchCode || null,
            production_code: productionCode || null,
            production_id: selectedProductionId || null,
            production_lot_id: lotItems[0]?.productionLotId || null,
            daily_seq: encodeSTT(dailySeq),
            quantity: totalQuantity,
            status: 'active',
            system_code: currentSystem?.code,
            company_id: profile?.company_id,
            images: images,
            metadata: {
                ...(editingLot?.metadata && typeof editingLot.metadata === 'object' ? editingLot.metadata : {}),
                extra_info: extraInfo,
                customer_name: customerName || null,
                oem_brand: customerName || null,
                production_place: productionPlaces.length > 0 ? productionPlaces.join(', ') : (productionPlace || null),
                production_places: productionPlaces.length > 0 ? productionPlaces : (productionPlace ? [productionPlace] : []),
                manual_production_places: productionPlaces.length > 0 ? productionPlaces : (productionPlace ? [productionPlace] : []),
                material_zone: materialZones.length > 0 ? Array.from(new Set(materialZones.map(z => formatMaterialZoneProvince(z, materialZonesList) || z).filter(Boolean))).join(', ') : null,
                material_zones: materialZones.length > 0 ? Array.from(new Set(materialZones.map(z => formatMaterialZoneProvince(z, materialZonesList) || z).filter(Boolean))) : [],
                manual_material_zones: materialZones.length > 0 ? Array.from(new Set(materialZones.map(z => formatMaterialZoneProvince(z, materialZonesList) || z).filter(Boolean))) : [],
                system_history: systemHistory,
                manual_peeling_dates: peelingDates.length > 0 ? peelingDates : (primaryPeelingDate ? [primaryPeelingDate] : []),
                peeling_dates: peelingDates.length > 0 ? peelingDates : (primaryPeelingDate ? [primaryPeelingDate] : []),
                manual_raw_material_dates: rawMaterialDates.length > 0 ? rawMaterialDates : (primaryRawMaterialDate ? [primaryRawMaterialDate] : []),
                raw_material_dates: rawMaterialDates.length > 0 ? rawMaterialDates : (primaryRawMaterialDate ? [primaryRawMaterialDate] : []),
                manual_packaging_dates: packagingDates.length > 0 ? packagingDates : (primaryPackagingDate ? [primaryPackagingDate] : []),
                packaging_dates: packagingDates.length > 0 ? packagingDates : (primaryPackagingDate ? [primaryPackagingDate] : [])
            }
        }

        // --- CƠ CHẾ CHỐNG TRÙNG SỐ THỨ TỰ (STT) TRÊN TOÀN PHÂN HỆ KHO ---
        const dailySeqVal = encodeSTT(dailySeq)
        // Chỉ kiểm tra trùng STT khi:
        // 1. Tạo mới (!editingLot)
        // 2. Chỉnh sửa (editingLot) nhưng người dùng đã thay đổi STT so với STT gốc (editingLot.daily_seq !== dailySeqVal)
        const shouldCheckStt = !editingLot || (editingLot && editingLot.daily_seq !== dailySeqVal)

        if (shouldCheckStt && dailySeqVal !== null && !isNaN(dailySeqVal)) {
            let checkSttQuery = (supabase.from('lots') as any)
                .select('id, code, inbound_date')
                .eq('system_code', currentSystem?.code || '')
                .eq('daily_seq', dailySeqVal)
                .neq('status', 'hidden')
                .neq('status', 'exported')
                
            if (editingLot?.id) {
                checkSttQuery = checkSttQuery.neq('id', editingLot.id)
            }

            const { data: matchedLots, error: checkSttError } = await checkSttQuery
            
            if (checkSttError) throw checkSttError
            
            if (matchedLots && matchedLots.length > 0) {
                const existingLot = matchedLots[0]
                const formattedDate = existingLot.inbound_date 
                    ? existingLot.inbound_date.split('-').reverse().join('/') 
                    : 'không rõ ngày'
                showToast(`Số Thứ Tự (STT) "${decodeSTT(dailySeqVal)}" đang được sử dụng bởi lô hàng "${existingLot.code}" (nhập ngày ${formattedDate}) trong hệ thống. Vui lòng chọn Số Thứ Tự khác để tránh trùng lặp.`, 'warning')
                setIsSubmitting(false)
                return
            }
        }
        // -------------------------------------------------------------------

        let lotId = editingLot?.id
        let error

        if (lotId) {
            // Update Lot metadata
            const { error: updateError } = await (supabase
                .from('lots') as any)
                .update(lotData)
                .eq('id', lotId)
            error = updateError
        } else {
            // Create
            // --- CƠ CHẾ CHỐNG TRÙNG MÃ ZERO-RISK ---
            const { count, error: checkError } = await supabase
                .from('lots')
                .select('*', { count: 'exact', head: true })
                .eq('code', newLotCode)
                .eq('system_code', currentSystem?.code || '')
                
            if (checkError) throw checkError
            
            if (count && count > 0) {
                const retryCode = await generateUniqueLotCode(supabase, currentSystem?.name)
                setNewLotCode(retryCode)
                lotData.code = retryCode
            }
            // ------------------------------------

            const { data: newLot, error: createError } = await (supabase
                .from('lots') as any)
                .insert(lotData)
                .select('id')
                .single()

            error = createError
            if (newLot) lotId = newLot.id
        }

        if (error) {
            showToast(`Lỗi ${editingLot ? 'cập nhật' : 'tạo'} LOT: ` + error.message, 'error')
            return
        }

        if (lotId && validItems.length > 0) {
            // SYNC items instead of deleting all
            const existingItems = editingLot?.lot_items || []
            const existingIds = existingItems.map((i: any) => i.id)
            const existingIdsSet = new Set(existingIds)

            const itemsToInsert = validItems.filter((i: any) => !i.id).map((item: any) => {
                const weight = extractWeightFromName(item.unit) || 0;
                return {
                    lot_id: lotId,
                    product_id: item.productId,
                    quantity: Number(Number(item.quantity).toFixed(6)),
                    unit: formatUnitWeight(item.unit, weight),
                    category_id: item.categoryId || null
                };
            })

            const itemsToUpdate = validItems.filter((i: any) => i.id).map((item: any) => {
                const weight = extractWeightFromName(item.unit) || 0;
                return {
                    id: item.id!,
                    lot_id: lotId,
                    product_id: item.productId,
                    quantity: Number(Number(item.quantity).toFixed(6)),
                    unit: formatUnitWeight(item.unit, weight),
                    category_id: item.categoryId || null
                };
            })

            const newIds = validItems.filter((i: any) => i.id).map((i: any) => i.id!)
            const idsToDelete = existingIds.filter((id: any) => !newIds.includes(id))

            // Process Updates
            const updatePromises = itemsToUpdate.map((item: any) =>
                (supabase.from('lot_items') as any).update({
                    quantity: item.quantity,
                    unit: item.unit,
                    product_id: item.product_id,
                    category_id: item.category_id
                }).eq('id', item.id)
            )

            // Execute Updates
            const updateResults = await Promise.all(updatePromises)
            if (updateResults.some(r => r.error)) {
                console.error('Items Update Error', updateResults.find(r => r.error))
                showToast('Có lỗi xảy ra khi cập nhật danh sách sản phẩm.', 'error')
            }

            // Insert new items and get IDs
            let newInsertedItems: any[] = []
            if (itemsToInsert.length > 0) {
                const insertRes = await supabase.from('lot_items').insert(itemsToInsert as any).select('id, product_id, quantity, unit')
                if (insertRes.error) {
                    console.error('Items Insert Error', insertRes.error)
                    showToast('Có lỗi xảy ra khi thêm mới sản phẩm.', 'error')
                } else if (insertRes.data) {
                    newInsertedItems = insertRes.data
                }
            }

            // Deletions
            if (idsToDelete.length > 0) {
                const delRes = await supabase.from('lot_items').delete().in('id', idsToDelete)
                if (delRes.error) console.error('Items Delete Error', delRes.error)
            }

            // Process Tags
            // To be safe, clear explicit tags for this lot except history meta tags
            const { error: deleteTagsError } = await supabase.from('lot_tags').delete()
                .eq('lot_id', lotId)
                .not('tag', 'ilike', 'MERGED_%')
                .not('tag', 'ilike', 'SPLIT_%')

            if (deleteTagsError) {
                console.error('Tags Delete Error:', JSON.stringify(deleteTagsError, null, 2))
            }

            const tagsToInsert: any[] = []

            // Tags for existing updated items
            for (const item of validItems) {
                if (item.id && item.tag?.trim()) {
                    tagsToInsert.push({
                        lot_id: lotId,
                        lot_item_id: item.id,
                        tag: item.tag.trim(),
                        added_at: new Date().toISOString()
                    })
                }
            }

            // Tags for newly inserted items
            // Match order of itemsToInsert and newInsertedItems
            const newValidItems = validItems.filter(i => !i.id)
            if (newValidItems.length === newInsertedItems.length) {
                for (let i = 0; i < newValidItems.length; i++) {
                    if (newValidItems[i].tag?.trim()) {
                        tagsToInsert.push({
                            lot_id: lotId,
                            lot_item_id: newInsertedItems[i].id,
                            tag: newValidItems[i].tag!.trim(),
                            added_at: new Date().toISOString()
                        })
                    }
                }
            }

            if (tagsToInsert.length > 0) {
                const { error: tagInsertError } = await (supabase.from('lot_tags') as any).insert(tagsToInsert)
                if (tagInsertError) {
                    console.error('Tags Insert Error Details:', JSON.stringify(tagInsertError, null, 2))
                    showToast('Lỗi khi lưu mã phụ: ' + (tagInsertError.message || 'Lỗi không xác định'), 'error')
                }
            }
        }



        // Audit Log
        try {
            await logActivity({
                supabase,
                tableName: 'lots',
                recordId: lotId || 'unknown',
                action: editingLot ? 'UPDATE' : 'CREATE',
                oldData: editingLot ? { ...editingLot, lot_items: editingLot.lot_items } : null,
                newData: { ...lotData, lot_items: validItems },
                systemCode: currentSystem?.code
            })
        } catch (err) {
            console.error('Failed to log activity', err)
        }

        const dailySeqStr = String(dailySeq ?? '').trim()
        if (dailySeqStr) {
            setLastUpdatedSTT(dailySeqStr)
        }
        await onSuccess(lotId ? { id: lotId, ...lotData } : undefined)
        } catch (error: any) {
            console.error('Submit Error:', error)
            showToast(`Lỗi ${editingLot ? 'cập nhật' : 'tạo'} LOT: ` + error.message, 'error')
        } finally {
            setIsSubmitting(false)
        }
    }

    // Lưới bố cục dòng sản phẩm: Mã phụ & Danh mục rộng cố định, Sản phẩm chiếm hết phần thừa
    // để hàng luôn sát mép phải. Cột Danh mục / cột nút xóa chỉ tồn tại khi thực sự có dùng.
    const hasCategories = categories.length > 0
    const showRowDelete = lotItems.length > 1 && !editingLot?.is_locked
    const rowGridClass =
        hasCategories && showRowDelete
            ? 'lg:grid-cols-[1.75rem_minmax(0,1fr)_5.5rem_7.5rem_11rem_12rem_2.25rem]'
            : hasCategories
                ? 'lg:grid-cols-[1.75rem_minmax(0,1fr)_5.5rem_7.5rem_11rem_12rem]'
                : showRowDelete
                    ? 'lg:grid-cols-[1.75rem_minmax(0,1fr)_5.5rem_7.5rem_11rem_2.25rem]'
                    : 'lg:grid-cols-[1.75rem_minmax(0,1fr)_5.5rem_7.5rem_11rem]'

    return (
        <div ref={formRef} className={`grid transition-all duration-500 ease-in-out ${isVisible ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden min-w-0">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-2xl shadow-sm border border-emerald-200 dark:border-emerald-800/30">
                            <Boxes size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white leading-none mb-1">
                                {editingLot ? 'Cập nhật thông tin LOT' : 'Thông tin LOT mới'}
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mã LOT: {newLotCode || '---'}</span>
                            </div>
                        </div>

                        {/* STT Badge/Input in Header */}
                        <div className="ml-4 flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/20 border border-emerald-700">
                            <Hash size={14} className="opacity-70" />
                            <span className="text-[10px] font-black uppercase tracking-wider">STT:</span>
                            <input
                                type="text"
                                autoCapitalize="characters"
                                value={dailySeq}
                                onChange={(e) => {
                                    hasUserEditedSttRef.current = true
                                    setDailySeq(e.target.value.toUpperCase())
                                }}
                                className="w-12 bg-transparent text-sm font-black outline-none border-b border-white/30 focus:border-white transition-all text-center uppercase"
                                placeholder="..."
                            />
                        </div>
                    </div>
                    
                    <button
                        onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
                    >
                        {isInfoExpanded ? 'Thu gọn chi tiết' : 'Hiện thêm thông tin'}
                        <ChevronDown className={`transition-transform duration-300 ${isInfoExpanded ? 'rotate-180' : ''}`} size={16} />
                    </button>
                </div>

                {editingLot?.is_locked && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 rounded-2xl flex items-start gap-3">
                        <div className="p-1 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg shrink-0 mt-0.5 animate-pulse">
                            <Boxes size={16} />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-red-800 dark:text-red-400">Lô hàng đang bị khóa</h4>
                            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">Không thể chỉnh sửa danh sách sản phẩm hoặc số lượng tồn kho của lô hàng này.</p>
                        </div>
                    </div>
                )}

                {/* Vùng thông tin chi tiết lô hàng - Bố cục phân nhóm thông minh & thích ứng với các module */}
                <div className={`grid transition-all duration-500 ease-in-out ${isInfoExpanded ? 'grid-rows-[1fr] opacity-100 mb-6' : 'grid-rows-[0fr] opacity-0 mb-0 pointer-events-none'}`}>
                    <div className="overflow-hidden min-w-0">
                    {(() => {
                        // Tính toán số lượng & trạng thái module cho các nhóm bố cục thích ứng
                        const hasQC = hasModule('qc_info')
                        const hasSupplier = hasModule('supplier_info')
                        const generalFieldsCount = 1 + (hasWarehouse ? 1 : 0) + (hasSupplier ? 1 : 0) + (hasQC ? 1 : 0)

                        const hasRawDate = hasModule('raw_material_date')
                        const hasInboundDate = hasModule('inbound_date')
                        const hasPeelingDate = hasModule('peeling_date')
                        const hasPackagingDate = hasModule('packaging_date')
                        const hasAnyDateModule = hasRawDate || hasInboundDate || hasPeelingDate || hasPackagingDate
                        const dateModulesCount = [hasRawDate, hasInboundDate, hasPeelingDate, hasPackagingDate].filter(Boolean).length

                        const hasMaterialZone = hasModule('material_zone')
                        const hasProductionPlace = hasModule('production_place')
                        const hasOemInfo = hasModule('oem_info')
                        const hasBatchCode = hasModule('batch_code')
                        const hasAnyTraceModule = hasMaterialZone || hasProductionPlace || hasOemInfo || hasBatchCode
                        const traceModulesCount = [hasMaterialZone, hasProductionPlace, hasOemInfo, hasBatchCode].filter(Boolean).length

                        const hasImages = hasModule('lot_images')
                        const hasExtraInfo = hasModule('extra_info')

                        return (
                            <div className="space-y-4 pt-1">
                                {/* 1. Thông tin định danh & Quản lý kho */}
                                <div className="p-4 bg-slate-50/70 dark:bg-zinc-800/30 rounded-2xl border border-slate-200/70 dark:border-zinc-700/60">
                                    <LotSectionHeader icon={Warehouse} tone="indigo" title="Định danh & Kho" />
                                    <div className={`grid gap-4 ${
                                    generalFieldsCount === 1 ? 'grid-cols-1 md:max-w-md' :
                                    generalFieldsCount === 2 ? 'grid-cols-1 md:grid-cols-2' :
                                    generalFieldsCount === 3 ? 'grid-cols-1 md:grid-cols-3' :
                                    'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                                }`}>
                                    {/* Mã LOT Nội bộ */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <Hash size={13} className="text-slate-400" />
                                                Mã LOT Nội bộ <span className="text-rose-500">*</span>
                                            </span>
                                            <span className="text-[10px] font-semibold text-slate-400">Tự động</span>
                                        </label>
                                        <div className="relative">
                                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                            <input
                                                type="text"
                                                value={newLotCode}
                                                readOnly
                                                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 cursor-not-allowed outline-none font-mono text-sm font-bold"
                                            />
                                        </div>
                                    </div>

                                    {/* Chi nhánh nhập hàng (lots.warehouse_name) */}
                                    {hasWarehouse && (
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                                    <MapPin size={13} className="text-blue-500" />
                                                    Chi nhánh nhập hàng
                                                    {requireBranch && (
                                                        <span className="text-rose-500" title="Bắt buộc — LOT không được để trống chi nhánh">*</span>
                                                    )}
                                                </label>
                                                {warehouseName && !requireBranch && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setWarehouseName('')}
                                                        className="text-[11px] text-rose-500 hover:text-rose-600 hover:underline cursor-pointer"
                                                    >
                                                        Xóa
                                                    </button>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={17} />
                                                <input
                                                    type="text"
                                                    list="lot-branch-datalist"
                                                    value={warehouseName}
                                                    onChange={(e) => setWarehouseName(e.target.value)}
                                                    placeholder={requireBranch ? "Bắt buộc: chọn chi nhánh nhập hàng..." : "Chọn chi nhánh nhập hàng (để trống nếu chưa có)..."}
                                                    className={`w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-800 border rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-zinc-900 dark:text-zinc-100 text-sm font-medium transition-all ${
                                                        requireBranch && !warehouseName.trim()
                                                            ? 'border-rose-400 dark:border-rose-600 focus:border-rose-500'
                                                            : 'border-zinc-200 dark:border-zinc-700 focus:border-blue-500'
                                                    }`}
                                                />
                                                <datalist id="lot-branch-datalist">
                                                    {scopedBranches.map(b => (
                                                        <option key={b.id} value={b.name}>{b.name}</option>
                                                    ))}
                                                </datalist>
                                            </div>
                                            {scopedBranches.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                    {scopedBranches.map(b => {
                                                        const val = b.name;
                                                        const isSelected = warehouseName.trim().toLowerCase() === val.toLowerCase();
                                                        return (
                                                            <button
                                                                key={b.id}
                                                                type="button"
                                                                onClick={() => setWarehouseName(val)}
                                                                className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                                                                    isSelected 
                                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                                                        : 'bg-stone-50 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-zinc-700 hover:border-blue-400'
                                                                }`}
                                                            >
                                                                {b.is_default ? <span className="mr-1">★</span> : null}
                                                                <span>{val}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Hàng chờ xếp kho (Khu vực Chờ) — lots.staging_area_code */}
                                    {hasStaging && warehouseLayouts.length > 0 && (
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                                    <Building2 size={13} className="text-amber-500" />
                                                    Hàng chờ xếp kho (Khu vực Chờ)
                                                </label>
                                                {stagingAreaCode && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setStagingAreaCode('')}
                                                        className="text-[11px] text-rose-500 hover:text-rose-600 hover:underline cursor-pointer"
                                                    >
                                                        Xóa
                                                    </button>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={17} />
                                                <input
                                                    type="text"
                                                    list="lot-staging-datalist"
                                                    value={stagingAreaCode}
                                                    onChange={(e) => setStagingAreaCode(e.target.value)}
                                                    placeholder="Nhập mã khu chờ (VD: KBB1) hoặc chọn khu..."
                                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-zinc-900 dark:text-zinc-100 text-sm font-medium uppercase transition-all"
                                                />
                                                <datalist id="lot-staging-datalist">
                                                    {warehouseLayouts.map(l => (
                                                        <option key={l.id} value={l.code || l.name}>
                                                            {l.code ? `[${l.code}] ${l.name}` : l.name}
                                                        </option>
                                                    ))}
                                                </datalist>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                {warehouseLayouts.map(l => {
                                                    const val = (l.code || l.name || '').toUpperCase();
                                                    const isSelected = stagingAreaCode.trim().toUpperCase() === val;
                                                    return (
                                                        <button
                                                            key={l.id}
                                                            type="button"
                                                            onClick={() => setStagingAreaCode(isSelected ? '' : val)}
                                                            className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                                                                isSelected 
                                                                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs' 
                                                                    : 'bg-stone-50 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-zinc-700 hover:border-amber-400'
                                                            }`}
                                                        >
                                                            <span className="font-mono mr-1">{val}</span>
                                                            <span>{l.name}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Nhà cung cấp */}
                                    {hasSupplier && (
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                                <Factory size={13} className="text-amber-500" />
                                                Nhà cung cấp
                                            </label>
                                            <div className="relative">
                                                <Factory className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={17} />
                                                <select
                                                    value={selectedSupplierId}
                                                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                                                    className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-zinc-900 dark:text-zinc-100 appearance-none transition-all text-sm font-medium"
                                                >
                                                    <option value="">-- Chọn nhà cung cấp --</option>
                                                    {suppliers.map(s => (
                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                                            </div>
                                        </div>
                                    )}

                                    {/* Nhân viên QC */}
                                    {hasQC && (
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                                <ShieldCheck size={13} className="text-purple-500" />
                                                Nhân viên QC
                                            </label>
                                            <div className="relative">
                                                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={17} />
                                                <select
                                                    value={selectedQCId}
                                                    onChange={(e) => setSelectedQCId(e.target.value)}
                                                    className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-zinc-900 dark:text-zinc-100 appearance-none transition-all text-sm font-medium"
                                                >
                                                    <option value="">-- Chọn QC --</option>
                                                    {qcList.map(qc => (
                                                        <option key={qc.id} value={qc.id}>{qc.name}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                </div>

                                {/* 2. Thông tin sản xuất */}
                                <div className="p-4 bg-orange-50/40 dark:bg-orange-950/10 rounded-2xl border border-orange-200/80 dark:border-orange-900/30">
                                    <LotSectionHeader icon={Factory} tone="orange" title="Thông tin sản xuất" />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* LSX Nội bộ */}
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-orange-600/80 dark:text-orange-400/80 uppercase flex items-center gap-1">
                                                <Plus size={10} />
                                                Lệnh sản xuất nội bộ
                                            </label>
                                            <div className="relative">
                                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400" size={16} />
                                                <select
                                                    value={selectedProductionId}
                                                    onChange={(e) => {
                                                        const val = e.target.value
                                                        setSelectedProductionId(val)
                                                    }}
                                                    className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-zinc-900 border border-orange-200 dark:border-orange-800 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-zinc-900 dark:text-zinc-100 appearance-none transition-all font-bold text-sm"
                                                >
                                                    <option value="">-- Chọn lệnh SX --</option>
                                                    {(productions as any[])
                                                        .filter(p => (p.status !== 'DONE' && p.status !== 'CANCELED') || p.id === selectedProductionId)
                                                        .map(p => (
                                                            <option key={p.id} value={p.id}>{p.name} - {p.code}</option>
                                                        ))}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-400 pointer-events-none" size={16} />
                                            </div>
                                        </div>

                                        {/* Mã sản xuất (MSX) */}
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                                                Mã sản xuất (Tùy chỉnh)
                                            </label>
                                            <div className="relative">
                                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                <input
                                                    type="text"
                                                    value={productionCode}
                                                    onChange={(e) => setProductionCode(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-slate-900 dark:text-zinc-100 transition-all text-sm font-bold placeholder:text-zinc-400"
                                                    placeholder="Nhập mã SX..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Tiến trình & Các mốc thời gian */}
                                {hasAnyDateModule && (
                                    <div className="p-4 bg-slate-50/70 dark:bg-zinc-800/30 rounded-2xl border border-slate-200/70 dark:border-zinc-700/60">
                                        <LotSectionHeader icon={CalendarClock} tone="amber" title="Tiến trình & Mốc thời gian" />

                                        <div className={`grid gap-4 ${
                                            dateModulesCount === 1 ? 'grid-cols-1 md:max-w-md' :
                                            dateModulesCount === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                                            dateModulesCount === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
                                            'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                                        }`}>
                                            {/* Ngày nhập nguyên liệu */}
                                            {hasRawDate && (
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                                                <Calendar size={13} className="text-emerald-500" />
                                                                Ngày nhập nguyên liệu
                                                            </label>
                                                            {rawMaterialDates.length > 0 && (
                                                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                                                    {rawMaterialDates.length} ngày
                                                                </span>
                                                            )}
                                                        </div>
                                                        {rawMaterialDates.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setRawMaterialDates([])
                                                                    setRawMaterialDate('')
                                                                }}
                                                                className="text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer"
                                                                title="Xóa tất cả ngày nhập nguyên liệu (để trống)"
                                                            >
                                                                Xóa ngày
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Danh sách các ngày nhập nguyên liệu đã thêm */}
                                                    {rawMaterialDates.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 max-h-24 overflow-y-auto">
                                                            {rawMaterialDates.map((dStr) => (
                                                                <div
                                                                    key={dStr}
                                                                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-xs font-bold text-zinc-800 dark:text-zinc-200 shadow-xs"
                                                                >
                                                                    <Calendar size={12} className="text-emerald-500 shrink-0" />
                                                                    <span>{new Date(dStr).toLocaleDateString('vi-VN')}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveRawMaterialDate(dStr)}
                                                                        className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                                                                        title={`Xóa ngày ${new Date(dStr).toLocaleDateString('vi-VN')}`}
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Ô chọn và nút thêm ngày nhập nguyên liệu */}
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="relative flex-1">
                                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                                            <input
                                                                type="date"
                                                                value={newRawMaterialDateInput}
                                                                onChange={(e) => setNewRawMaterialDateInput(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault()
                                                                        handleAddRawMaterialDate()
                                                                    }
                                                                }}
                                                                className="w-full pl-9 pr-2 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-zinc-900 dark:text-zinc-100 text-xs transition-all"
                                                                style={{ colorScheme: 'light dark' }}
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddRawMaterialDate()}
                                                            disabled={!newRawMaterialDateInput}
                                                            className="px-2.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all shrink-0 shadow-xs cursor-pointer"
                                                            title="Thêm ngày nhập nguyên liệu"
                                                        >
                                                            <Plus size={14} />
                                                            <span>Thêm</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Ngày sản xuất */}
                                            {hasPeelingDate && (
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                                                <Calendar size={13} className="text-orange-500" />
                                                                Ngày sản xuất
                                                            </label>
                                                            {peelingDates.length > 0 && (
                                                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">
                                                                    {peelingDates.length} ngày
                                                                </span>
                                                            )}
                                                        </div>
                                                        {peelingDates.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setPeelingDates([])
                                                                    setPeelingDate('')
                                                                }}
                                                                className="text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer"
                                                                title="Xóa tất cả ngày sản xuất"
                                                            >
                                                                Xóa ngày
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Danh sách các ngày sản xuất đã thêm */}
                                                    {peelingDates.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 max-h-24 overflow-y-auto">
                                                            {peelingDates.map((dStr) => (
                                                                <div
                                                                    key={dStr}
                                                                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-zinc-800 border border-orange-200 dark:border-orange-800/60 rounded-lg text-xs font-bold text-zinc-800 dark:text-zinc-200 shadow-xs"
                                                                >
                                                                    <Calendar size={12} className="text-orange-500 shrink-0" />
                                                                    <span>{new Date(dStr).toLocaleDateString('vi-VN')}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemovePeelingDate(dStr)}
                                                                        className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                                                                        title={`Xóa ngày ${new Date(dStr).toLocaleDateString('vi-VN')}`}
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Ô chọn và nút thêm ngày sản xuất */}
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="relative flex-1">
                                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                                            <input
                                                                type="date"
                                                                value={newPeelingDateInput}
                                                                onChange={(e) => setNewPeelingDateInput(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault()
                                                                        handleAddPeelingDate()
                                                                    }
                                                                }}
                                                                className="w-full pl-9 pr-2 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-zinc-900 dark:text-zinc-100 text-xs transition-all"
                                                                style={{ colorScheme: 'light dark' }}
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddPeelingDate()}
                                                            disabled={!newPeelingDateInput}
                                                            className="px-2.5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all shrink-0 shadow-xs cursor-pointer"
                                                            title="Thêm ngày sản xuất"
                                                        >
                                                            <Plus size={14} />
                                                            <span>Thêm</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Ngày đóng bao bì */}
                                            {hasPackagingDate && (
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                                                <Calendar size={13} className="text-blue-500" />
                                                                Ngày đóng bao bì
                                                            </label>
                                                            {packagingDates.length > 0 && (
                                                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                                                    {packagingDates.length} ngày
                                                                </span>
                                                            )}
                                                        </div>
                                                        {packagingDates.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setPackagingDates([])
                                                                    setPackagingDate('')
                                                                }}
                                                                className="text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer"
                                                                title="Xóa tất cả ngày đóng bao bì (để trống)"
                                                            >
                                                                Xóa ngày
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Danh sách các ngày đóng bao bì đã thêm */}
                                                    {packagingDates.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 max-h-24 overflow-y-auto">
                                                            {packagingDates.map((dStr) => (
                                                                <div
                                                                    key={dStr}
                                                                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-800/60 rounded-lg text-xs font-bold text-zinc-800 dark:text-zinc-200 shadow-xs"
                                                                >
                                                                    <Calendar size={12} className="text-blue-500 shrink-0" />
                                                                    <span>{new Date(dStr).toLocaleDateString('vi-VN')}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemovePackagingDate(dStr)}
                                                                        className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                                                                        title={`Xóa ngày ${new Date(dStr).toLocaleDateString('vi-VN')}`}
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Ô chọn và nút thêm ngày đóng bao bì */}
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="relative flex-1">
                                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                                            <input
                                                                type="date"
                                                                value={newPackagingDateInput}
                                                                onChange={(e) => setNewPackagingDateInput(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault()
                                                                        handleAddPackagingDate()
                                                                    }
                                                                }}
                                                                className="w-full pl-9 pr-2 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 dark:text-zinc-100 text-xs transition-all"
                                                                style={{ colorScheme: 'light dark' }}
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddPackagingDate()}
                                                            disabled={!newPackagingDateInput}
                                                            className="px-2.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all shrink-0 shadow-xs cursor-pointer"
                                                            title="Thêm ngày đóng bao bì"
                                                        >
                                                            <Plus size={14} />
                                                            <span>Thêm</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Ngày nhập kho */}
                                            {hasInboundDate && (
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                                            <Calendar size={13} className="text-amber-500" />
                                                            Ngày nhập kho
                                                        </label>
                                                        {inboundDate && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setInboundDate('')}
                                                                className="text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer"
                                                                title="Xóa ngày nhập kho (để trống)"
                                                            >
                                                                Xóa ngày
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="relative">
                                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={17} />
                                                        <input
                                                            type="date"
                                                            value={inboundDate}
                                                            onChange={(e) => setInboundDate(e.target.value)}
                                                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-zinc-900 dark:text-zinc-100 text-sm transition-all"
                                                            style={{ colorScheme: 'light dark' }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 4. Truy xuất nguồn gốc & Thuộc tính mở rộng */}
                                {hasAnyTraceModule && (
                                    <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/15 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 shadow-xs">
                                        <LotSectionHeader
                                            icon={Fingerprint}
                                            tone="teal"
                                            title="Truy xuất nguồn gốc & Thông tin mở rộng"
                                            trailing={
                                                <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400">
                                                    {traceModulesCount} trường kích hoạt
                                                </span>
                                            }
                                        />

                                        <div className={`grid gap-4 ${
                                            traceModulesCount === 1 ? 'grid-cols-1 md:grid-cols-2' :
                                            traceModulesCount === 2 ? 'grid-cols-1 md:grid-cols-2' :
                                            'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                                        }`}>
                                            {/* Vùng nguyên liệu */}
                                            {hasMaterialZone && (
                                                <div className={`space-y-2 ${traceModulesCount === 1 ? 'md:col-span-2' : ''}`}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                                                <MapPin size={13} className="text-emerald-600" />
                                                                <span>Vùng nguyên liệu / Vùng trồng</span>
                                                            </label>
                                                            {materialZones.length > 0 && (
                                                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                    {materialZones.length} vùng
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <a
                                                                href="/material-zones"
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                                                                title="Mở trang Quản lý & Khai báo Vùng trồng"
                                                            >
                                                                <Plus size={12} />
                                                                Khai báo vùng
                                                            </a>
                                                            {materialZones.length > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setMaterialZones([])}
                                                                    className="text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer"
                                                                    title="Xóa tất cả vùng nguyên liệu đã chọn"
                                                                >
                                                                    Xóa tất cả
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Danh sách các vùng nguyên liệu đã chọn (Hiển thị thẻ chip) */}
                                                    {materialZones.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 p-2 bg-emerald-50/40 dark:bg-zinc-800/40 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 max-h-28 overflow-y-auto">
                                                            {materialZones.map((mzStr) => {
                                                                const label = formatMaterialZoneProvince(mzStr, materialZonesList) || mzStr
                                                                return (
                                                                    <div
                                                                        key={mzStr}
                                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-900 border border-emerald-300/90 dark:border-emerald-700/80 rounded-lg text-xs font-bold text-zinc-900 dark:text-zinc-100 shadow-2xs group"
                                                                    >
                                                                        <MapPin size={12} className="text-emerald-600 shrink-0" />
                                                                        <span>{label}</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemoveMaterialZone(mzStr)}
                                                                            className="p-0.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                                                                            title={`Gỡ bỏ ${label}`}
                                                                        >
                                                                            <X size={12} />
                                                                        </button>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Ô nhập / chọn thêm vùng nguyên liệu */}
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="relative flex-1">
                                                             <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600/70" size={16} />
                                                            <input
                                                                type="text"
                                                                list="material-zones-datalist"
                                                                value={newMaterialZoneInput}
                                                                onChange={(e) => {
                                                                    const val = e.target.value
                                                                    const found = materialZonesList.find(m => {
                                                                        const prov = formatMaterialZoneProvince(m.province || m.name, materialZonesList)
                                                                        const lbl = m.code ? `${m.code} - ${m.name}` : m.name
                                                                        return val === prov || val === lbl || val === m.code || val === m.name || val === m.province
                                                                    })
                                                                    if (found) {
                                                                        const prov = formatMaterialZoneProvince(found.province || found.name, materialZonesList)
                                                                        handleAddMaterialZone(prov)
                                                                    } else {
                                                                        setNewMaterialZoneInput(val)
                                                                    }
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault()
                                                                        handleAddMaterialZone()
                                                                    }
                                                                }}
                                                                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-emerald-200/90 dark:border-emerald-800/70 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-zinc-900 dark:text-zinc-100 transition-all text-xs font-medium placeholder:text-zinc-400 shadow-xs"
                                                                placeholder="Chọn từ 25 tỉnh hoặc gõ thêm (nhấn Enter hoặc bấm Thêm)..."
                                                            />
                                                            <datalist id="material-zones-datalist">
                                                                {materialZonesList
                                                                    .map((mz) => {
                                                                        const prov = formatMaterialZoneProvince(mz.province || mz.name, materialZonesList)
                                                                        return (
                                                                            <option key={mz.id} value={prov}>
                                                                                {mz.code ? `[${mz.code}] ` : ''}{mz.name} ({prov})
                                                                            </option>
                                                                        )
                                                                    })}
                                                            </datalist>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddMaterialZone()}
                                                            disabled={!newMaterialZoneInput.trim()}
                                                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all shrink-0 shadow-xs cursor-pointer"
                                                            title="Thêm vùng nguyên liệu này vào LOT"
                                                        >
                                                            <Plus size={14} />
                                                            <span>Thêm</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Nơi sản xuất */}
                                            {hasProductionPlace && (
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                                                <Factory size={13} className="text-blue-600" />
                                                                <span>Nơi sản xuất / Nhà máy</span>
                                                            </label>
                                                            {productionPlaces.length > 1 && (
                                                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                                                                    {productionPlaces.length} cơ sở
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <a
                                                                href="/production-places"
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                                                                title="Mở trang Quản lý & Khai báo Nơi sản xuất / Nhà máy"
                                                            >
                                                                <Plus size={12} />
                                                                Khai báo nơi SX
                                                            </a>
                                                            {productionPlaces.length > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setProductionPlaces([])
                                                                        setProductionPlace('')
                                                                    }}
                                                                    className="text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer"
                                                                    title="Xóa tất cả nơi sản xuất đã chọn"
                                                                >
                                                                    Xóa tất cả
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Danh sách các nơi sản xuất đã chọn (Hiển thị thẻ chip) */}
                                                    {productionPlaces.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 p-2 bg-blue-50/40 dark:bg-zinc-800/40 rounded-xl border border-blue-200/80 dark:border-blue-800/60 max-h-28 overflow-y-auto">
                                                            {productionPlaces.map((pStr) => {
                                                                const matched = productionPlacesList.find(p => p.name === pStr || p.code === pStr || (p.code && `[${p.code}] ${p.name}` === pStr))
                                                                const label = matched ? (matched.code ? `[${matched.code}] ${matched.name}` : matched.name) : pStr
                                                                return (
                                                                    <div
                                                                        key={pStr}
                                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-900 border border-blue-300/90 dark:border-blue-700/80 rounded-lg text-xs font-bold text-zinc-900 dark:text-zinc-100 shadow-2xs group"
                                                                    >
                                                                        <Factory size={12} className="text-blue-600 shrink-0" />
                                                                        <span>{label}</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemoveProductionPlace(pStr)}
                                                                            className="p-0.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                                                                            title={`Gỡ bỏ ${label}`}
                                                                        >
                                                                            <X size={12} />
                                                                        </button>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Ô nhập / chọn thêm nơi sản xuất */}
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="relative flex-1">
                                                            <Factory className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600/70" size={16} />
                                                            <input
                                                                type="text"
                                                                list="production-places-datalist"
                                                                value={newProductionPlaceInput}
                                                                onChange={(e) => {
                                                                    const val = e.target.value
                                                                    const found = productionPlacesList.find(p => {
                                                                        const lbl = p.code ? `[${p.code}] ${p.name}` : p.name
                                                                        return val === lbl || val === p.code || val === p.name
                                                                    })
                                                                    if (found) {
                                                                        handleAddProductionPlace(found.name)
                                                                    } else {
                                                                        setNewProductionPlaceInput(val)
                                                                    }
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault()
                                                                        handleAddProductionPlace()
                                                                    }
                                                                }}
                                                                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-blue-200/90 dark:border-blue-800/70 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 dark:text-zinc-100 transition-all text-xs font-medium placeholder:text-zinc-400 shadow-xs"
                                                                placeholder="Chọn từ cơ sở đã khai báo hoặc gõ thêm (nhấn Enter hoặc bấm Thêm)..."
                                                            />
                                                            <datalist id="production-places-datalist">
                                                                {productionPlacesList
                                                                    .filter(p => !productionPlaces.includes(p.name) && !productionPlaces.includes(p.code))
                                                                    .map((p: any) => {
                                                                        const label = p.code ? `[${p.code}] ${p.name}` : p.name
                                                                        return (
                                                                            <option key={p.id} value={p.name}>
                                                                                {label}
                                                                            </option>
                                                                        )
                                                                    })}
                                                            </datalist>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddProductionPlace()}
                                                            disabled={!newProductionPlaceInput.trim()}
                                                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all shrink-0 shadow-xs cursor-pointer"
                                                            title="Thêm nơi sản xuất này vào LOT"
                                                        >
                                                            <Plus size={14} />
                                                            <span>Thêm</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Thương hiệu & Khách OEM */}
                                            {hasOemInfo && (
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                                                        <span className="flex items-center gap-1.5">
                                                            <Tag size={13} className="text-purple-600" />
                                                            Thương hiệu & Khách OEM
                                                        </span>
                                                        {customerName && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setCustomerName('')}
                                                                className="text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer"
                                                            >
                                                                Xóa
                                                            </button>
                                                        )}
                                                    </label>
                                                    <div className="relative">
                                                        <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-500" size={17} />
                                                        <input
                                                            type="text"
                                                            value={customerName}
                                                            onChange={(e) => setCustomerName(e.target.value)}
                                                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-purple-200/90 dark:border-purple-800/70 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none text-zinc-900 dark:text-zinc-100 transition-all text-sm font-medium placeholder:text-zinc-400 shadow-xs"
                                                            placeholder="VD: Nhãn OEM, Khách hàng, Nhãn riêng..."
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Số Batch / Lô NCC */}
                                            {hasBatchCode && (
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                                                        <span className="flex items-center gap-1.5">
                                                            <Layers size={13} className="text-amber-600" />
                                                            Số Batch / Lô NCC
                                                        </span>
                                                        {batchCode && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setBatchCode('')}
                                                                className="text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer"
                                                            >
                                                                Xóa
                                                            </button>
                                                        )}
                                                    </label>
                                                    <div className="relative">
                                                        <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500" size={17} />
                                                        <input
                                                            type="text"
                                                            value={batchCode}
                                                            onChange={(e) => setBatchCode(e.target.value)}
                                                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-amber-200/90 dark:border-amber-800/70 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-zinc-900 dark:text-zinc-100 transition-all text-sm font-medium placeholder:text-zinc-400 shadow-xs"
                                                            placeholder="VD: BATCH-01, LOT-NCC..."
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 5. Hình ảnh & Thông tin bổ sung */}
                                {(hasImages || hasExtraInfo) && (
                                    <div className="p-4 bg-slate-50/50 dark:bg-zinc-800/20 rounded-2xl border border-slate-200/60 dark:border-zinc-700/50">
                                        <LotSectionHeader icon={Images} tone="sky" title="Hình ảnh & Thông tin phụ" />

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {hasImages && (
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                                        Hình ảnh chứng từ / LOT
                                                    </label>
                                                    <ImageUpload
                                                        value={images}
                                                        onChange={setImages}
                                                        maxFiles={5}
                                                        folder="img-lot"
                                                    />
                                                </div>
                                            )}

                                            {hasExtraInfo && (
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                                        Thông tin bổ sung
                                                    </label>
                                                    <textarea
                                                        value={extraInfo}
                                                        onChange={(e) => setExtraInfo(e.target.value.toUpperCase())}
                                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all resize-none font-mono text-sm uppercase placeholder:text-zinc-400"
                                                        rows={hasImages ? 5 : 3}
                                                        placeholder="NHẬP CÁC THÔNG TIN PHỤ KHÁC..."
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 6. Ghi chú chung của lô hàng */}
                                <div className="p-4 bg-slate-50/50 dark:bg-zinc-800/20 rounded-2xl border border-slate-200/60 dark:border-zinc-700/50">
                                    <LotSectionHeader icon={FileText} tone="violet" title="Ghi chú lô hàng" />
                                    <textarea
                                        value={newLotNotes}
                                        onChange={(e) => setNewLotNotes(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all resize-none text-sm placeholder:text-zinc-400"
                                        rows={2}
                                        placeholder="Ghi chú thêm về lô hàng..."
                                    />
                                </div>
                            </div>
                        )
                    })()}
                    </div>
                </div>

            {/* Danh sách sản phẩm */}
            <div className="space-y-3">
                        <LotSectionHeader
                            icon={Package}
                            tone="emerald"
                            title="Danh sách sản phẩm"
                            badge={
                                <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 tabular-nums">
                                    {lotItems.length}
                                </span>
                            }
                            trailing={!editingLot?.is_locked ? (
                                <button
                                    onClick={() => setLotItems([...lotItems, { productId: '', quantity: '', unit: '', tag: '' }])}
                                    className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors active:scale-95"
                                >
                                    <Plus size={14} />
                                    Thêm dòng
                                </button>
                            ) : undefined}
                        />

                        {/* Tiêu đề cột — chỉ hiện trên màn hình rộng */}
                        <div className={`hidden lg:grid ${rowGridClass} gap-2 px-1 text-[10px] font-black uppercase tracking-wider text-slate-400`}>
                            <span className="text-center">#</span>
                            <span>Sản phẩm</span>
                            <span>Số lượng</span>
                            <span>Đơn vị</span>
                            <span>Mã phụ</span>
                            {hasCategories && <span>Danh mục</span>}
                            {showRowDelete && <span></span>}
                        </div>

                        <div className="space-y-2">
                            {lotItems.map((item, index) => (
                                <div key={index} className={`flex flex-col lg:grid ${rowGridClass} gap-2 items-stretch lg:items-center bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors`}>
                                    <span className="hidden lg:flex items-center justify-center h-6 w-6 rounded-md bg-slate-100 dark:bg-zinc-800 text-[11px] font-black text-slate-500 dark:text-zinc-400 tabular-nums">
                                        {index + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <div className="relative">
                                            <Combobox
                                                disabled={!!editingLot?.is_locked}
                                                isLoading={isFetchingProduction}
                                                options={selectedProductionId && selectedProduction?.production_lots?.length > 0 
                                                    ? selectedProduction.production_lots
                                                        .filter((pl: any) => !pl.is_locked)
                                                        .map((pl: any) => ({
                                                            value: `${pl.products?.id || pl.product_id}|${pl.id}`,
                                                            label: `${pl.lot_code} - ${pl.products?.name || 'Sản phẩm'}`,
                                                            sku: pl.lot_code,
                                                            name: pl.products?.name || 'Sản phẩm',
                                                            lotCode: pl.lot_code,
                                                            aliases: (pl.products as any)?.aliases || ''
                                                        }))
                                                    : availableProducts.map(p => ({
                                                        value: p.id,
                                                        label: hasModule('internal_products') && (p as any).internal_code
                                                            ? `${(p as any).internal_code} - ${(p as any).internal_name || p.name}`
                                                            : `${p.sku} - ${p.name}`,
                                                        sku: hasModule('internal_products') && (p as any).internal_code ? (p as any).internal_code : p.sku,
                                                        name: hasModule('internal_products') && (p as any).internal_name ? (p as any).internal_name : p.name,
                                                        aliases: (p as any).aliases || '',
                                                        internal_code: (p as any).internal_code || '',
                                                        internal_name: (p as any).internal_name || '',
                                                        originalSku: p.sku,
                                                        originalName: p.name
                                                    }))}
                                                value={item.productionLotId ? `${item.productId}|${item.productionLotId}` : item.productId}
                                                onChange={(val) => {
                                                    let productId = val || ''
                                                    let lotId = ''
                                                    
                                                    if (productId.includes('|')) {
                                                        const parts = productId.split('|')
                                                        productId = parts[0]
                                                        lotId = parts[1]
                                                        
                                                        // Tự động điền ngày sản xuất khi chọn mã lot
                                                        if (selectedProduction && selectedProduction.production_lots) {
                                                            const pLot = selectedProduction.production_lots.find((pl: any) => pl.id === lotId)
                                                            if (pLot && pLot.production_date) {
                                                                const formatted = pLot.production_date.includes('T')
                                                                    ? pLot.production_date.split('T')[0]
                                                                    : pLot.production_date
                                                                setPeelingDates(prev => prev.includes(formatted) ? prev : [...prev, formatted].sort())
                                                                setPeelingDate(prev => prev || formatted)
                                                            }
                                                        }
                                                    }

                                                    setLotItems(prev => {
                                                        const newItems = [...prev]
                                                        const product = products.find(p => p.id === productId)
                                                        const baseUnit = product?.unit || ''
                                                        let baseWeight = (product as any)?.weight_kg || 0
                                                        
                                                        // Fallback: If base unit is Kg and weight is not set, assume 1kg
                                                        const normBase = normalizeUnit(baseUnit)
                                                        if (baseWeight <= 0 && (normBase === 'kg' || normBase === 'kilogram')) {
                                                            baseWeight = 1
                                                        }
                                                        
                                                        // Strategy: Find a default unit to show. Prefer "Thùng" > Base Unit.
                                                        const pUnits = productUnits.filter(pu => pu.product_id === productId)
                                                        const thungUnit = pUnits.find(pu => {
                                                            const u = units.find(ux => ux.id === pu.unit_id)
                                                            if (!u) return false
                                                            const normName = normalizeUnit(u.name)
                                                            return normName === 'thùng' || normName === 'thung'
                                                        })
                                                        
                                                        let initialUnit = baseUnit
                                                        let unitWeight = baseWeight

                                                        if (thungUnit) {
                                                            const u = units.find(ux => ux.id === thungUnit.unit_id)
                                                            if (u) {
                                                                initialUnit = u.name
                                                                unitWeight = (thungUnit.conversion_rate || 1) * baseWeight
                                                            }
                                                        }

                                                        const normInitial = normalizeUnit(initialUnit)
                                                        const isKg = normInitial === 'kg' || normInitial === 'kilogram'
                                                        
                                                        const formattedUnit = formatUnitWeight(initialUnit, unitWeight)
                                                        
                                                        newItems[index] = { 
                                                            ...newItems[index], 
                                                            productId: productId || '',
                                                            unit: formattedUnit,
                                                            productionLotId: lotId,
                                                            categoryId: product?.category_id || ''
                                                        }
                                                        return newItems
                                                    })
                                                }}
                                                placeholder="-- Chọn sản phẩm --"
                                                className="w-full"
                                                renderValue={(option) => (
                                                    <div className="flex flex-col text-left w-full">
                                                        <div className="text-[10px] text-zinc-500 font-mono mb-0.5 leading-none">{option.sku}</div>
                                                        <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 line-clamp-1 leading-tight">
                                                            {option.name}
                                                        </div>
                                                    </div>
                                                )}
                                                suggestionLabel="Gợi ý sản phẩm"
                                                renderOption={(option: any, term: string) => {
                                                    // Badge cho biết vì sao kết quả này hiện ra: tên gõ tắt khớp > mã nội bộ khớp > SKU khớp
                                                    const aliasHit = option.aliases
                                                        ? String(option.aliases)
                                                            .split(/[,;\n]/)
                                                            .map((s: string) => s.trim())
                                                            .filter(Boolean)
                                                            .find((a: string) => matchSearch(a, term))
                                                        : undefined
                                                    const skuText = option.originalSku || option.sku
                                                    return (
                                                        <div className="flex flex-col text-left w-full py-0.5 min-w-0">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate max-w-full">
                                                                    {option.name || option.label}
                                                                </span>
                                                                {aliasHit && (
                                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black tracking-wide shrink-0 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                                                                        ⚡ {aliasHit}
                                                                    </span>
                                                                )}
                                                                {!aliasHit && option.internal_code && matchSearch(option.internal_code, term) && (
                                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black tracking-wide shrink-0 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                                                                        NB: {option.internal_code}
                                                                    </span>
                                                                )}
                                                                {option.lotCode && (
                                                                    <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-md font-bold shrink-0">
                                                                        LOT: {option.lotCode}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {skuText && (
                                                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5 font-mono">
                                                                    SKU: {skuText}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-row gap-2 w-full lg:contents">
                                        <div className="flex-1 lg:flex-none min-w-0">
                                            <QuantityInput
                                                disabled={!!editingLot?.is_locked}
                                                placeholder="SL"
                                                className="h-10 py-0 text-center font-bold"
                                                value={item.quantity}
                                                onChange={(val) => {
                                                    setLotItems(prev => {
                                                        const newItems = [...prev]
                                                        newItems[index] = { ...newItems[index], quantity: val }
                                                        return newItems
                                                    })
                                                }}
                                            />
                                        </div>

                                        {/* Unit Selection */}
                                        <div className="flex-1 lg:flex-none min-w-0">
                                            <select
                                                disabled={!!editingLot?.is_locked}
                                                value={item.unit}
                                                onChange={(e) => {
                                                    const newVal = e.target.value
                                                    const oldVal = item.unit
                                                    const product = products.find(p => p.id === item.productId)
                                                    const baseUnitName = product?.unit || ''
                                                    
                                                    if (!item.productId) {
                                                        setLotItems(prev => {
                                                            const newItems = [...prev]
                                                            newItems[index] = { ...newItems[index], unit: newVal }
                                                            return newItems
                                                        })
                                                        return
                                                    }

                                                    const currentQty = typeof item.quantity === 'string' 
                                                        ? parseFloat(item.quantity) || 0 
                                                        : item.quantity || 0

                                                    const newQty = convertUnit(
                                                        item.productId,
                                                        oldVal,
                                                        newVal,
                                                        currentQty,
                                                        baseUnitName,
                                                        unitNameMap,
                                                        conversionMap
                                                    )

                                                    setLotItems(prev => {
                                                        const newItems = [...prev]
                                                        newItems[index] = { 
                                                            ...newItems[index], 
                                                            unit: newVal,
                                                            quantity: Number(newQty.toFixed(3))
                                                        }
                                                        return newItems
                                                    })
                                                }}
                                                className="w-full h-10 px-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-zinc-900 dark:text-zinc-100 text-sm transition-all"
                                            >
                                                {(() => {
                                                    const product = products.find(p => p.id === item.productId)
                                                    if (!product) return <option value="">Đơn vị</option>

                                                    const availableUnits = new Set<string>()
                                                    // Base Unit with weight if available
                                                    const baseUnit = product.unit || ''
                                                    let baseWeight = (product as any).weight_kg || 0
                                                    // Fallback: If base unit is Kg and weight is not set, assume 1kg
                                                    const normBase = normalizeUnit(baseUnit)
                                                    if (baseWeight <= 0 && (normBase === 'kg' || normBase === 'kilogram')) {
                                                        baseWeight = 1
                                                    }
                                                    const formattedBaseUnit = formatUnitWeight(baseUnit, baseWeight)
                                                    
                                                    if (baseUnit) availableUnits.add(formattedBaseUnit)

                                                    const pUnitsOfProduct = productUnits.filter((pu: any) => pu.product_id === item.productId)
                                                    
                                                    pUnitsOfProduct
                                                        .forEach((pu: any) => {
                                                            const u = units.find((u: any) => u.id === pu.unit_id)
                                                            if (u) {
                                                                const normU = normalizeUnit(u.name)
                                                                if (normU === normalizeUnit(baseUnit)) return // Skip base unit

                                                                const weight = (pu.conversion_rate || 1) * baseWeight
                                                                const labelStr = formatUnitWeight(u.name, weight)
                                                                availableUnits.add(labelStr)
                                                            }
                                                        })

                                                    return Array.from(availableUnits).map(u => (
                                                        <option key={u} value={u}>{u}</option>
                                                    ))
                                                })()}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Secondary Code (Tag) */}
                                    <div className="w-full min-w-0">
                                        <div className="relative group">
                                            <input
                                                disabled={!!editingLot?.is_locked}
                                                type="text"
                                                list={`tags-list-${index}`}
                                                placeholder="Mã phụ..."
                                                value={item.tag || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value.toUpperCase()
                                                    setLotItems(prev => {
                                                        const newItems = [...prev]
                                                        newItems[index] = { ...newItems[index], tag: val }
                                                        return newItems
                                                    })
                                                }}
                                                className="w-full h-10 px-3 pr-8 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-zinc-900 dark:text-zinc-100 text-sm transition-all uppercase"
                                            />
                                            {!editingLot?.is_locked && (
                                                <button
                                                    onClick={() => {
                                                        const currentVal = item.tag || '';
                                                        const newVal = currentVal + (currentVal.endsWith('>') || currentVal === '' ? '@' : '>@');
                                                        setLotItems(prev => {
                                                            const newItems = [...prev]
                                                            newItems[index] = { ...newItems[index], tag: newVal }
                                                            return newItems
                                                        })
                                                    }}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-md text-[10px] font-bold hover:bg-orange-200"
                                                    title="Chèn placeholder @ (mã SKU)"
                                                >
                                                    @
                                                </button>
                                            )}
                                        </div>
                                        <datalist id={`tags-list-${index}`}>
                                            {existingTags.map(tag => (
                                                <option key={tag} value={tag} />
                                            ))}
                                        </datalist>
                                    </div>

                                    {/* Category Selection — mặc định theo khai báo sản phẩm, chỉnh được theo từng dòng */}
                                    {hasCategories && (
                                        <div className="w-full min-w-0">
                                            <select
                                                disabled={!!editingLot?.is_locked}
                                                value={item.categoryId || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value
                                                    setLotItems(prev => {
                                                        const newItems = [...prev]
                                                        newItems[index] = { ...newItems[index], categoryId: val }
                                                        return newItems
                                                    })
                                                }}
                                                title="Danh mục của dòng hàng này"
                                                className="w-full h-10 px-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-zinc-900 dark:text-zinc-100 text-sm transition-all"
                                            >
                                                <option value="">-- Danh mục --</option>
                                                {categories.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {lotItems.length > 1 && !editingLot?.is_locked && (
                                        <button
                                            onClick={() => {
                                                const newItems = lotItems.filter((_, i) => i !== index)
                                                setLotItems(newItems)
                                            }}
                                            className="h-10 w-9 shrink-0 self-end lg:self-center lg:justify-self-center flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Xóa dòng"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}

                            {lotItems.length === 0 && (
                                <div className="py-8 px-4 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-900/30 text-center">
                                    <Package size={22} className="mx-auto text-slate-300 dark:text-zinc-600 mb-2" />
                                    <p className="text-xs font-medium text-slate-400 dark:text-zinc-500">
                                        Chưa có sản phẩm nào — bấm <span className="font-bold text-emerald-600">Thêm dòng</span> để bắt đầu.
                                    </p>
                                </div>
                            )}

                            {!editingLot?.is_locked && lotItems.length > 0 && (
                                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic px-1">
                                    Mã phụ: dùng <span className="font-bold not-italic">@</span> để chèn mã SKU, <span className="font-bold not-italic">&gt;</span> để phân tách nhiều mã.
                                    {hasCategories && <> Danh mục mặc định lấy theo khai báo của sản phẩm và có thể đổi riêng cho từng dòng.</>}
                                </p>
                            )}
                            
                            {editingLot?.is_locked && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-medium">
                                    <Lock size={14} />
                                    <span>Lô hàng đã bị khóa, không thể chỉnh sửa chi tiết sản phẩm.</span>
                                </div>
                            )}
                        </div>
                    </div>



                <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-4">
                        {editingLot && onDelete && (
                            <Protected permission="lot.manage">
                                <button
                                    onClick={() => editingLot.id && onDelete(editingLot.id)}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95"
                                >
                                    <Trash2 size={18} />
                                    <span>Xóa Lô Hàng</span>
                                </button>
                            </Protected>
                        )}
                        {!editingLot && (
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={isPersistent}
                                        onChange={(e) => setIsPersistent(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                                </div>
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-emerald-600 transition-colors">
                                    Ghi nhớ thông tin cho lô tiếp theo
                                </span>
                            </label>
                        )}
                    </div>
                    <div className="flex items-center gap-3 ml-auto">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!newLotCode.trim() || isSubmitting}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[120px]"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    {editingLot ? 'Đang cập nhật...' : 'Đang lưu...'}
                                </>
                            ) : (
                                editingLot ? 'Cập nhật' : 'Lưu LOT'
                            )}
                        </button>
                    </div>
                </div>
            </div>
            </div>
        </div>
    )
}
