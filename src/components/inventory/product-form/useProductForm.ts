import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'

type Product = Database['public']['Tables']['products']['Row']
type Category = Database['public']['Tables']['categories']['Row']
type Vehicle = Database['public']['Tables']['vehicles']['Row']
type Unit = Database['public']['Tables']['units']['Row']

interface UseProductFormProps {
    initialData?: Product
    isEditMode: boolean
    readOnly: boolean
}

export function useProductForm({ initialData, isEditMode, readOnly }: UseProductFormProps) {
    const router = useRouter()
    const { systemType, currentSystem, hasModule } = useSystem()
    const { profile } = useUser()
    const [loading, setLoading] = useState(false)
    const [categories, setCategories] = useState<Category[]>([])

    // Module specific states
    const [units, setUnits] = useState<Unit[]>([])
    const [isAutoSku, setIsAutoSku] = useState(false)
    const [isGeneratingSku, setIsGeneratingSku] = useState(false)

    // Form Data
    const [formData, setFormData] = useState({
        // Basic
        sku: initialData?.sku || '',
        name: initialData?.name || '',
        category_id: initialData?.category_id || '',
        description: initialData?.description || '',
        // Images (Legacy/Thumbnail)
        image_url: initialData?.image_url || '',
        // Units
        unit: initialData?.unit || '',
        // Pricing
        cost_price: initialData?.cost_price || 0,
        retail_price: initialData?.retail_price || 0,
        wholesale_price: initialData?.wholesale_price || 0,
        // Packaging
        packaging_specification: initialData?.packaging_specification || '',
    })

    const [mediaItems, setMediaItems] = useState<{ id?: string, url: string, type: 'image' | 'video' }[]>([])
    const [alternativeUnits, setAlternativeUnits] = useState<{ unit_id: string, factor: number, ref_unit_id: string }[]>([])

    const systemModules = currentSystem?.modules
        ? (typeof currentSystem.modules === 'string' ? JSON.parse(currentSystem.modules) : currentSystem.modules)
        : []

    useEffect(() => {
        if (systemType) {
            fetchCategories()
        }
        fetchUnits()
        if (isEditMode && initialData) fetchProductUnits()
        if (hasModule('images') && isEditMode && initialData) {
            fetchMedia()
        }
    }, [systemType])

    // Data Fetching Logic...
    async function fetchMedia() {
        if (!initialData) return
        const { data } = await (supabase.from('product_media') as any).select('*').eq('product_id', initialData.id).order('sort_order')
        if (data && data.length > 0) {
            setMediaItems(data.map((d: any) => ({ id: d.id, url: d.url, type: d.type })))
        } else if (initialData.image_url) {
            setMediaItems([{ url: initialData.image_url, type: 'image' }])
        }
    }

    async function fetchUnits() {
        if (!systemType) return
        const { data } = await supabase
            .from('units')
            .select('*')
            .eq('is_active', true)
            .or(`system_code.eq.${systemType},system_code.is.null`)
            .order('name')
        if (data) setUnits(data as Unit[])
    }

    async function fetchProductUnits() {
        if (!initialData) return
        const { data } = await (supabase.from('product_units') as any).select('*').eq('product_id', initialData.id)

        if (data) {
            const mapped = data.map((d: any) => {
                let factor = d.conversion_rate
                if (d.ref_unit_id) {
                    const refUnit = data.find((r: any) => r.unit_id === d.ref_unit_id)
                    if (refUnit) {
                        factor = d.conversion_rate / refUnit.conversion_rate
                    }
                }
                return {
                    unit_id: d.unit_id,
                    factor: factor,
                    ref_unit_id: d.ref_unit_id || ''
                }
            })
            setAlternativeUnits(mapped)
        }
    }

    async function fetchCategories() {
        if (!systemType) return
        const { data } = await supabase
            .from('categories')
            .select('*')
            .eq('system_type', systemType)
            .order('name')
        if (data) setCategories(data)
    }

    // SKU Generation Logic...
    const generateSku = async () => {
        if (!systemType) return ''
        setIsGeneratingSku(true)
        try {
            let prefix = ''
            if (currentSystem?.name) {
                const cleanName = currentSystem.name.replace(/^Kho\s+/i, '').trim()
                prefix = cleanName.split(/\s+/).map(word => word[0]).join('').toUpperCase()
                prefix = prefix.replace(/[^A-Z0-9]/g, '')
            }
            if (!prefix || prefix.length === 0) {
                const SYSTEM_PREFIXES: Record<string, string> = {
                    'SPARE_PARTS': 'PT',
                    'PACKAGING': 'BB',
                    'FROZEN': 'KL',
                    'OFFICE_SUPPLIES': 'VP',
                }
                prefix = SYSTEM_PREFIXES[systemType] || systemType.substring(0, 3).toUpperCase()
            }

            const searchPattern = `${prefix}-SP%`
            const { data } = await supabase
                .from('products')
                .select('sku')
                .ilike('sku', searchPattern)
                .order('created_at', { ascending: false })
                .limit(1)

            let nextNum = 1
            if (data && data.length > 0 && (data[0] as any).sku) {
                const lastSku = (data[0] as any).sku
                const parts = lastSku.split('-SP')
                if (parts.length === 2 && !isNaN(Number(parts[1]))) {
                    nextNum = Number(parts[1]) + 1
                }
            }
            return `${prefix}-SP${String(nextNum).padStart(3, '0')}`
        } catch (error) {
            console.error('Error generating SKU:', error)
            return `${systemType.substring(0, 3).toUpperCase()}-SP${Math.floor(Math.random() * 900)}`
        } finally {
            setIsGeneratingSku(false)
        }
    }

    // Handlers
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        if (readOnly) return
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    // Unit Handlers
    const addAlternativeUnit = () => {
        let defaultRef = ''
        if (alternativeUnits.length > 0) {
            const lastRow = alternativeUnits[alternativeUnits.length - 1]
            if (lastRow.unit_id) defaultRef = lastRow.unit_id
        }
        setAlternativeUnits(prev => [...prev, { unit_id: '', factor: 1, ref_unit_id: defaultRef }])
    }
    const removeAlternativeUnit = (index: number) => setAlternativeUnits(prev => prev.filter((_, i) => i !== index))
    const updateAlternativeUnit = (index: number, field: string, value: any) => {
        setAlternativeUnits(prev => {
            const newUnits = [...prev]
            newUnits[index] = { ...newUnits[index], [field]: value }
            return newUnits
        })
    }

    // Submit Logic
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const payload = {
            ...formData,
            system_type: systemType,
            company_id: profile?.company_id || null
        }

        try {
            let productId = initialData?.id
            if (isEditMode && initialData) {
                const { error } = await (supabase.from('products') as any).update(payload).eq('id', initialData.id)
                if (error) throw error
            } else {
                const { data, error } = await (supabase.from('products') as any).insert([payload]).select().single()
                if (error) throw error
                productId = data.id
            }

            // Save Units
            if (productId) {
                await (supabase.from('product_units') as any).delete().eq('product_id', productId)
                if (alternativeUnits.length > 0) {
                    const ratesMap = new Map<string, number>()
                    const validUnits = []
                    for (const u of alternativeUnits.filter(u => u.unit_id && u.factor > 0)) {
                        let absoluteRate = u.factor
                        if (u.ref_unit_id) {
                            const parentRate = ratesMap.get(u.ref_unit_id)
                            if (parentRate) absoluteRate = u.factor * parentRate
                        }
                        ratesMap.set(u.unit_id, absoluteRate)
                        validUnits.push({
                            product_id: productId,
                            unit_id: u.unit_id,
                            conversion_rate: absoluteRate,
                            ref_unit_id: u.ref_unit_id || null,
                            company_id: profile?.company_id || null
                        })
                    }
                    if (validUnits.length > 0) await (supabase.from('product_units') as any).insert(validUnits)
                }
            }

            // Save Media
            if (productId && hasModule('images')) {
                await (supabase.from('product_media') as any).delete().eq('product_id', productId)
                if (mediaItems.length > 0) {
                    const validMedia = mediaItems.filter(m => m.url && m.url.trim() !== '').map((m, i) => ({
                        product_id: productId,
                        url: m.url.trim(),
                        type: m.type,
                        sort_order: i,
                        company_id: profile?.company_id || null
                    }))
                    if (validMedia.length > 0) await (supabase.from('product_media') as any).insert(validMedia)
                }
            }

            router.push('/products')
            router.refresh()
        } catch (error: any) {
            alert('Error: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    return {
        loading,
        formData,
        setFormData,
        handleChange,
        categories,
        units,
        mediaItems,
        setMediaItems,
        alternativeUnits,
        addAlternativeUnit,
        removeAlternativeUnit,
        updateAlternativeUnit,
        isAutoSku,
        setIsAutoSku,
        isGeneratingSku,
        generateSku,
        hasModule,
        handleSubmit
    }
}
