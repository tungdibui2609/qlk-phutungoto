'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
    children: ReactNode
    fallbackTitle?: string
}

interface State {
    hasError: boolean
    error: Error | null
    errorInfo: ErrorInfo | null
}

export default class TaskErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        }
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorInfo: null,
        }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[TaskErrorBoundary] Caught client exception:', error, errorInfo)
        this.setState({ errorInfo })
    }

    handleReload = () => {
        if (typeof window !== 'undefined') {
            window.location.reload()
        }
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null })
    }

    render() {
        if (this.state.hasError) {
            const errMessage = this.state.error?.message || 'Lỗi không xác định'
            const stack = this.state.error?.stack || ''

            return (
                <div className="min-h-[400px] flex items-center justify-center p-4">
                    <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-rose-100 p-6 sm:p-8 text-center space-y-4">
                        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto ring-8 ring-rose-50/50">
                            <AlertTriangle className="w-7 h-7" />
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-stone-900">
                                {this.props.fallbackTitle || 'Đã xảy ra sự cố khi tải giao diện Công việc'}
                            </h3>
                            <p className="text-sm text-stone-500 mt-1">
                                Đã xảy ra lỗi hiển thị trên trình duyệt. Bạn hãy bấm Thử lại hoặc Tải lại trang.
                            </p>
                        </div>

                        <div className="text-left bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs text-rose-700 font-mono overflow-auto max-h-40">
                            <p className="font-semibold text-stone-800 mb-1">Chi tiết lỗi:</p>
                            <p>{errMessage}</p>
                            {stack && (
                                <pre className="mt-2 text-[10px] text-stone-500 whitespace-pre-wrap">
                                    {stack.split('\n').slice(0, 5).join('\n')}
                                </pre>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                            <button
                                onClick={this.handleReset}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Thử lại
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-semibold rounded-xl transition flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Tải lại trang
                            </button>
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
