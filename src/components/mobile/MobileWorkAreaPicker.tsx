'use client'

import { useState, useEffect } from 'react'
import { MapPin, Search, Check, Loader2, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'

interface WorkArea {
    id: string
    name: string
    code: string | null
}

interface MobileWorkAreaPickerProps {
    onSelect: (workArea: WorkArea) => void
    onClose?: () => void
}

export function MobileWorkAreaPicker({ onSelect, onClose }: MobileWorkAreaPickerProps) {
    const { currentSystem } = useSystem()
    const { profile } = useUser()
    const [workAreas, setWorkAreas] = useState<WorkArea[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => {
        const fetchWorkAreas = async () => {
            if (!currentSystem?.code || !profile?.company_id) return

            try {
                const { data, error } = await (supabase
                    .from('work_areas' as any)
                    .select('id, name, code') as any)
                    .eq('company_id', profile.company_id)
                    .eq('system_code', currentSystem.code)
                    .eq('is_active', true)
                    .order('name')

                if (error) throw error
                setWorkAreas(data || [])
            } catch (err) {
                console.error('Error fetching work areas:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchWorkAreas()
    }, [currentSystem, profile])

    const filteredAreas = workAreas.filter(area =>
        area.name.toLowerCase().includes(search.toLowerCase()) ||
        area.code?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="fixed inset-0 z-[200] bg-white dark:bg-zinc-950 flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-600">
                        <MapPin size={18} />
                    </div>
                    <div>
                        <h2 className="font-bold text-zinc-900 dark:text-white">Chọn khu vực</h2>
                        <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Bắt buộc để tiếp tục</p>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} className="p-2 text-zinc-400">
                        <X size={20} />
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm khu vực..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm font-medium"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {loading ? (
                    <div className="py-12 flex flex-col items-center justify-center text-zinc-400 italic text-sm">
                        <Loader2 size={24} className="animate-spin mb-2" />
                        Đang lấy danh sách khu vực...
                    </div>
                ) : filteredAreas.length === 0 ? (
                    <div className="py-12 text-center text-zinc-500 text-sm">
                        {search ? 'Không tìm thấy khu vực nào' : 'Chưa có khu vực nào được tạo'}
                    </div>
                ) : (
                    filteredAreas.map(area => (
                        <button
                            key={area.id}
                            onClick={() => onSelect(area)}
                            className="w-full p-4 flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl hover:border-orange-500/50 hover:bg-orange-50/30 dark:hover:bg-orange-500/5 transition-all text-left group active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-orange-500 transition-colors">
                                    <MapPin size={20} />
                                </div>
                                <div>
                                    <div className="font-bold text-zinc-900 dark:text-white">{area.name}</div>
                                    {area.code && (
                                        <div className="text-[10px] font-mono text-zinc-400 font-bold uppercase">{area.code}</div>
                                    )}
                                </div>
                            </div>
                            <div className="w-6 h-6 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center group-hover:border-orange-500/50 transition-colors">
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    )
}
