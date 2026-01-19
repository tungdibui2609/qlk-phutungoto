'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Lock, Loader2, X, Eye, EyeOff } from 'lucide-react'

interface ChangePasswordModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null)
    const [showPassword, setShowPassword] = useState(false)

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirmPassword) {
            setMessage({ text: 'Mật khẩu xác nhận không khớp', type: 'error' })
            return
        }
        if (password.length < 6) {
            setMessage({ text: 'Mật khẩu phải có ít nhất 6 ký tự', type: 'error' })
            return
        }

        setLoading(true)
        setMessage(null)

        try {
            const { error } = await supabase.auth.updateUser({ password: password })
            if (error) throw error
            setMessage({ text: 'Đổi mật khẩu thành công!', type: 'success' })
            setTimeout(() => {
                onClose()
                setPassword('')
                setConfirmPassword('')
                setMessage(null)
            }, 1500)
        } catch (error: any) {
            setMessage({ text: error.message, type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">
                {/* Header */}
                <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50">
                    <h3 className="font-semibold text-stone-800 flex items-center gap-2">
                        <Lock className="text-orange-500" size={18} />
                        Đổi mật khẩu
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-stone-200 text-stone-500 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {message && (
                        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${message.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`} />
                            {message.text}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">Mật khẩu mới</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full pl-3 pr-10 py-2.5 rounded-lg border border-stone-200 text-stone-800 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all"
                                placeholder="Nhập mật khẩu mới"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">Xác nhận mật khẩu mới</label>
                        <input
                            type={showPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="w-full px-3 py-2.5 rounded-lg border border-stone-200 text-stone-800 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all"
                            placeholder="Nhập lại mật khẩu mới"
                        />
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-br from-orange-500 to-orange-600 shadow-md hover:shadow-lg transition-all disabled:opacity-70 flex items-center gap-2"
                        >
                            {loading && <Loader2 className="animate-spin" size={16} />}
                            Lưu thay đổi
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
