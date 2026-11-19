import type { Metadata, Viewport } from 'next'
import SwRegister from './SwRegister'

export const metadata: Metadata = {
  title: 'Chánh Thu - Máy Quét Pallet & Tem Thùng',
  description: 'Ứng dụng quét tem thùng, nhận diện con dấu mực, số liệu tác nghiệp và kiểm kê Pallet Chánh Thu trên di động.',
  manifest: '/scanner-manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CT Scanner',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/logoanywarehouse.png',
    apple: '/logoanywarehouse.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0b1120',
  interactiveWidget: 'resizes-content',
}

export default function ScannerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-[#0b1120] text-slate-100 h-[100dvh] w-full overflow-hidden overscroll-none select-none touch-manipulation fixed inset-0 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-white"
      style={{
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <SwRegister />
      {children}
    </div>
  )
}
