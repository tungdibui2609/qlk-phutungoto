import './mobile.css'

export const metadata = {
  title: 'Mobile Workspace',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  },
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mobile-app">
      {children}
    </div>
  )
}
