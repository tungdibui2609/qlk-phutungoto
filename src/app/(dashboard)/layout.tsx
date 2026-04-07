import DashboardLayout from '@/components/layout/DashboardLayout'
import { GlobalTooltip } from '@/components/ui/GlobalTooltip'
import StockWarningNotifier from '@/components/shared/StockWarningNotifier'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      {children}
      <GlobalTooltip />
      <StockWarningNotifier />
    </DashboardLayout>
  )
}
