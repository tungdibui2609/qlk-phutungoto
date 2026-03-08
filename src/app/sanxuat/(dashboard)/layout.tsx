import SanxuatDashboardLayout from '@/components/layout/SanxuatDashboardLayout'
import { GlobalTooltip } from '@/components/ui/GlobalTooltip'

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <SanxuatDashboardLayout>
            {children}
            <GlobalTooltip />
        </SanxuatDashboardLayout>
    )
}
