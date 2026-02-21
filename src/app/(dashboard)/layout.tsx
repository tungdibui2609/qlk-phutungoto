import DashboardLayout from '@/components/layout/DashboardLayout'
import { GlobalTooltip } from '@/components/ui/GlobalTooltip'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      {children}
      <GlobalTooltip />
    </DashboardLayout>
  )
}
