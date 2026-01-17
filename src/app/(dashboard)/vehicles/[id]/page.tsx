'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import VehicleForm from '@/components/vehicles/VehicleForm'
import { Loader2 } from 'lucide-react'

type Vehicle = Database['public']['Tables']['vehicles']['Row']

export default function EditVehiclePage() {
    const params = useParams()
    const [vehicle, setVehicle] = useState<Vehicle | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchVehicle() {
            const { data } = await supabase
                .from('vehicles')
                .select('*')
                .eq('id', params.id as string)
                .single()

            if (data) setVehicle(data)
            setLoading(false)
        }

        if (params.id) fetchVehicle()
    }, [params.id])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-orange-500" size={32} />
            </div>
        )
    }

    if (!vehicle) {
        return (
            <div className="text-center py-12 text-stone-500">
                Không tìm thấy dòng xe
            </div>
        )
    }

    return (
        <div>
            <VehicleForm initialData={vehicle} isEditMode />
        </div>
    )
}
