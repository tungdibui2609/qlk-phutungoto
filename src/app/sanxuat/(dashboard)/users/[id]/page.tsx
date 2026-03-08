'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import SanxuatUserForm from '@/components/users/SanxuatUserForm'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function SanxuatEditUserPage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string
    const [userData, setUserData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        async function fetchUser() {
            try {
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('id', id)
                    .single()

                if (error) throw error
                setUserData(data)
            } catch (err: any) {
                console.error(err)
                setError('Không tìm thấy người dùng hoặc có lỗi xảy ra.')
            } finally {
                setLoading(false)
            }
        }

        if (id) {
            fetchUser()
        }
    }, [id])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-4 text-stone-500">
                    <Loader2 className="animate-spin text-emerald-500" size={32} />
                    <p className="text-sm font-medium">Đang tải thông tin...</p>
                </div>
            </div>
        )
    }

    if (error || !userData) {
        return (
            <div className="max-w-2xl mx-auto py-12 text-center">
                <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 mb-6">
                    <p className="font-semibold">{error}</p>
                </div>
                <Link
                    href="/sanxuat/users"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-200 font-medium transition-colors"
                >
                    <ArrowLeft size={18} />
                    Quay lại danh sách
                </Link>
            </div>
        )
    }

    return <SanxuatUserForm initialData={userData} isEditMode={true} />
}
