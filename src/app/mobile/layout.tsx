import './mobile.css'
import MobileBottomNav from './_components/MobileBottomNav'
import { MobileProvider } from '@/contexts/MobileContext'

export const metadata = {
  title: 'Mobile Workspace',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileProvider>
      <div className="mobile-app">
        <div className="mobile-content">
          {children}
        </div>
        <MobileBottomNav />
      </div>
    </MobileProvider>
  )
}
