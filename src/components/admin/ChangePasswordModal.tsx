'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, X, Lock, Check } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'

interface ChangePasswordModalProps {
    onClose: () => void
}

export default function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
    const { showToast } = useToast()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password.length < 6) {
            return showToast('Mật khẩu phải từ 6 ký tự trở lên', 'error')
        }
        if (password !== confirmPassword) {
            return showToast('Mật khẩu xác nhận không khớp', 'error')
        }

        setLoading(true)
        try {
            const { error } = await supabase.auth.updateUser({ password })
            if (error) throw error

            showToast('Đổi mật khẩu thành công', 'success')
            onClose()
        } catch (error: any) {
            showToast('Lỗi: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md shadow-xl animate-scale-in">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Lock size={18} className="text-orange-600" />
                        Đổi Mật Khẩu
                    </h3>
                    <button onClick={onClose}><X size={20} className="text-stone-400 hover:text-stone-600" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-stone-600">Mật khẩu mới</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                            placeholder="Nhập mật khẩu mới..."
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-stone-600">Xác nhận mật khẩu</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                            placeholder="Nhập lại mật khẩu..."
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg font-medium"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2 font-medium shadow-lg shadow-orange-200"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                            Lưu Thay Đổi
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
