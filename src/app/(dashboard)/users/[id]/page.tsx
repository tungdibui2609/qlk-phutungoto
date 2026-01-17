'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import UserForm from '@/components/users/UserForm'
import { Loader2 } from 'lucide-react'

export default function EditUserPage() {
    const params = useParams()
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchUser() {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', params.id as string)
                .single()

            if (data) setUser(data)
            setLoading(false)
        }
        fetchUser()
    }, [params.id])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-orange-500" size={32} />
            </div>
        )
    }

    if (!user) {
        return (
            <div className="text-center py-12 text-stone-500">
                Không tìm thấy người dùng
            </div>
        )
    }

    return <UserForm initialData={user} isEditMode />
}
