import type { Metadata, Viewport } from 'next'
import SwRegister from './SwRegister'

export const metadata: Metadata = {
  title: 'Chánh Thu - Máy Quét Pallet & Tem Thùng',
  description: 'Ứng dụng quét tem thùng, nhận diện con dấu mực và kiểm kê Pallet Chánh Thu trên di động.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CT Scanner',
  },
  icons: {
    icon: '/logoanywarehouse.png',
    apple: '/logoanywarehouse.png',
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0b0f19',
}

export default function ScannerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#0b0f19] text-slate-100 h-[100dvh] w-full overflow-hidden fixed inset-0 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-white">
      <SwRegister />
      {children}
    </div>
  )
}
