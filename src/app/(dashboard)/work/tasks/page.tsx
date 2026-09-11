'use client'

import React from 'react'
import ShiftTasksView from '@/components/tasks/ShiftTasksView'
import TaskErrorBoundary from '@/components/tasks/TaskErrorBoundary'

export default function WorkTasksPage() {
    return (
        <TaskErrorBoundary>
            <ShiftTasksView isSanxuat={false} />
        </TaskErrorBoundary>
    )
}
