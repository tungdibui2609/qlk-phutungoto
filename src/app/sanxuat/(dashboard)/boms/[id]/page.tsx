'use client'
import React, { useEffect, useState, use } from 'react'
import BomForm from '@/components/sanxuat/boms/BomForm'
import { FileEdit, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

export default function EditBomPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [bom, setBom] = useState<any>(null)
    const [bomLines, setBomLines] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchBom() {
            setLoading(true)
            const { data: bomData, error: bomError } = await supabase
                .from('boms' as any)
                .select('*, products!boms_product_id_fkey(name, unit)')
                .eq('id', id)
                .single()

            if (bomError) {
                console.error('Error fetching BOM:', bomError)
                setLoading(false)
                return
            }

            const { data: linesData, error: linesError } = await supabase
                .from('bom_lines' as any)
                .select('*, products!bom_lines_material_id_fkey(name, unit, sku)')
                .eq('bom_id', id)

            if (!linesError && linesData) {
                setBomLines(linesData)
            }

            setBom(bomData)
            setLoading(false)
        }

        if (id) fetchBom()
    }, [id])

    if (loading) {
        return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-emerald-600" size={40} /></div>
    }

    if (!bom) {
        return <div className="text-center p-12 text-zinc-500">Không tìm thấy định mức</div>
    }

    return (
        <div className="max-w-4xl mx-auto py-6">
            <div className="mb-6 flex items-center gap-3">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl">
                    <FileEdit size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Cập nhật Định mức (BOM)</h1>
                    <p className="text-zinc-500">Mã: {bom.code || '---'} • {bom.name}</p>
                </div>
            </div>

            <BomForm initialData={bom} initialLines={bomLines} isEditMode={true} />
        </div>
    )
}
