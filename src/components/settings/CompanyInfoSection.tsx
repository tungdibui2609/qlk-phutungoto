'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { Loader2, Save, Building2, Globe, Mail, Phone, MapPin, Receipt, Upload, Image as ImageIcon, X } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import Image from 'next/image'

type CompanySettings = Database['public']['Tables']['company_settings']['Row']

export default function CompanyInfoSection() {
    const { showToast } = useToast()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [info, setInfo] = useState<CompanySettings | null>(null)
    const [logoUrl, setLogoUrl] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        fetchInfo()
    }, [])

    async function fetchInfo() {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('company_settings')
                .select('*')
                .limit(1)
                .single()

            if (data) {
                const settings = data as any
                setInfo(settings)
                setLogoUrl(settings.logo_url)
            }
        } catch (err) {
            console.error('Error fetching info:', err)
        } finally {
            setLoading(false)
        }
    }

    async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files || e.target.files.length === 0) return

        const file = e.target.files[0]
        const fileExt = file.name.split('.').pop()
        const fileName = `logo_${Date.now()}.${fileExt}`
        const filePath = `${fileName}`

        setUploading(true)
        try {
            const { error: uploadError } = await supabase.storage
                .from('company-assets')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('company-assets')
                .getPublicUrl(filePath)

            setLogoUrl(publicUrl)
            showToast('Đã tải lên logo!', 'success')
        } catch (error: any) {
            showToast('Lỗi tải ảnh: ' + error.message, 'error')
        } finally {
            setUploading(false)
        }
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        try {
            const form = e.target as HTMLFormElement
            const formData = new FormData(form)

            const payload = {
                name: formData.get('name') as string,
                short_name: formData.get('short_name') as string,
                tax_code: formData.get('tax_code') as string,
                address: formData.get('address') as string,
                phone: formData.get('phone') as string,
                email: formData.get('email') as string,
                website: formData.get('website') as string,
                logo_url: logoUrl, // Use state value
                updated_at: new Date().toISOString()
            }

            if (info?.id) {
                const { error } = await (supabase
                    .from('company_settings') as any)
                    .update(payload)
                    .eq('id', info.id)
                if (error) throw error
            } else {
                const { error } = await (supabase
                    .from('company_settings') as any)
                    .insert(payload)
                if (error) throw error
            }

            showToast('Đã lưu thông tin!', 'success')
            fetchInfo()
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>

    return (
        <form onSubmit={handleSave} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                <div>
                    <h2 className="font-bold text-lg text-stone-800 flex items-center gap-2">
                        <Building2 className="text-orange-500" size={20} />
                        Thông tin Công ty
                    </h2>
                    <p className="text-stone-500 text-xs mt-1">Thông tin hiển thị trên các chứng từ, báo cáo</p>
                </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: Logo */}
                <div className="md:col-span-1 flex flex-col items-center space-y-4">
                    <div className="relative w-40 h-40 rounded-full border-2 border-dashed border-stone-300 flex items-center justify-center bg-stone-50 overflow-hidden group hover:border-orange-400 transition-colors">
                        {logoUrl ? (
                            <>
                                <Image
                                    src={logoUrl}
                                    alt="Logo"
                                    fill
                                    className="object-contain p-2"
                                />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="text-white text-xs font-medium flex flex-col items-center gap-1"
                                    >
                                        <Upload size={20} />
                                        Thay đổi
                                    </button>
                                </div>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center gap-2 text-stone-400 hover:text-orange-500 transition-colors"
                            >
                                <ImageIcon size={32} />
                                <span className="text-xs font-medium">Tải lên Logo</span>
                            </button>
                        )}
                        {uploading && (
                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                <Loader2 className="animate-spin text-orange-500" />
                            </div>
                        )}
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleLogoUpload}
                    />
                    <div className="text-center">
                        <p className="text-sm font-medium text-stone-700">Logo công ty</p>
                        <p className="text-xs text-stone-500 mt-1">Định dạng: PNG, JPG (Max 2MB)</p>
                    </div>
                </div>

                {/* Right Columns: Form Fields */}
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="col-span-1 md:col-span-2 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1">Tên công ty <span className="text-red-500">*</span></label>
                            <input
                                name="name"
                                defaultValue={info?.name || ''}
                                required
                                placeholder="Công ty TNHH..."
                                className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all font-medium"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1">Tên ngắn gọn <span className="text-red-500">*</span></label>
                            <input
                                name="short_name"
                                defaultValue={info?.short_name || ''}
                                required
                                placeholder="Toàn Thắng..."
                                className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all font-medium"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1 flex items-center gap-1">
                                <Receipt size={14} className="text-stone-400" /> Mã số thuế
                            </label>
                            <input
                                name="tax_code"
                                defaultValue={info?.tax_code || ''}
                                placeholder="010xxxxxx"
                                className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1 flex items-center gap-1">
                                <MapPin size={14} className="text-stone-400" /> Địa chỉ
                            </label>
                            <textarea
                                name="address"
                                defaultValue={info?.address || ''}
                                rows={2}
                                placeholder="Số nhà, đường, quận/huyện..."
                                className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1 flex items-center gap-1">
                                <Phone size={14} className="text-stone-400" /> Điện thoại
                            </label>
                            <input
                                name="phone"
                                defaultValue={info?.phone || ''}
                                placeholder="09xxx..."
                                className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1 flex items-center gap-1">
                                <Mail size={14} className="text-stone-400" /> Email
                            </label>
                            <input
                                name="email"
                                defaultValue={info?.email || ''}
                                type="email"
                                placeholder="contact@company.com"
                                className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1 flex items-center gap-1">
                                <Globe size={14} className="text-stone-400" /> Website
                            </label>
                            <input
                                name="website"
                                defaultValue={info?.website || ''}
                                placeholder="https://..."
                                className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-end">
                <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-medium shadow-md shadow-orange-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
            </div>
        </form>
    )
}
