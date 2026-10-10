'use client'

import React, { useState, useEffect, useRef } from 'react'

interface FastTextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    value: string
    onChange: (val: string) => void
    debounceMs?: number
}

/**
 * FastTextInput:
 * Ô nhập văn bản phản hồi tức thì (Zero-Latency), cách ly hoàn toàn với React tree cha trong lúc gõ.
 * - Cập nhật native DOM nội bộ với độ trễ 0ms (giữ vững bộ gõ tiếng Việt Telex/VNI, không đơ/lag khi modal có nhiều dòng).
 * - Tự động đồng bộ lên state cha sau khi ngừng gõ (debounced) hoặc ngay khi rời ô (onBlur).
 */
export function FastTextInput({
    value,
    onChange,
    debounceMs = 150,
    className,
    placeholder,
    ...rest
}: FastTextInputProps) {
    const [localValue, setLocalValue] = useState(value || '')
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange

    // Đồng bộ khi prop value từ bên ngoài thay đổi (e.g. load dữ liệu khi sửa phiếu)
    useEffect(() => {
        setLocalValue(value || '')
    }, [value])

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nextVal = e.target.value
        setLocalValue(nextVal)

        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
            onChangeRef.current(nextVal)
        }, debounceMs)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }
        onChangeRef.current(localValue)
        if (rest.onBlur) rest.onBlur(e)
    }

    return (
        <input
            {...rest}
            value={localValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            className={className}
            placeholder={placeholder}
        />
    )
}
