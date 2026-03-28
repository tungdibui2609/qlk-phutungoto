import '../mobile/mobile.css'

export const metadata = {
  title: 'LOT Sản Xuất',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function ProductionLotLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mobile-app">
      {children}
    </div>
  )
}
