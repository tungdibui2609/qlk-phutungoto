'use client'

import React from 'react'
import ShiftTasksView from '@/components/tasks/ShiftTasksView'
import TaskErrorBoundary from '@/components/tasks/TaskErrorBoundary'

export default function SanxuatWorkTasksPage() {
    return (
        <TaskErrorBoundary>
            <ShiftTasksView isSanxuat={true} />
        </TaskErrorBoundary>
    )
}
