import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Chánh Thu - Điều Hành & Giao Việc',
        short_name: 'Chánh Thu',
        description: 'Hệ thống giao việc, điều hành ca kíp và quản lý kho Chánh Thu',
        start_url: '/work/tasks',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#059669',
        orientation: 'portrait',
        icons: [
            {
                src: '/logoanywarehouse.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/logoanywarehouse.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/logoanywarehouse.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            },
        ],
    }
}
