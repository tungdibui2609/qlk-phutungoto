import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Chánh Thu - Quản Lý Kho & Giao Việc',
        short_name: 'Chánh Thu',
        description: 'Hệ thống giao việc, điều hành ca kíp và quản lý kho Chánh Thu',
        start_url: '/work/tasks',
        display: 'standalone',
        background_color: '#061a12',
        theme_color: '#061a12',
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
                src: '/icon-maskable-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            },
        ],
    }
}
