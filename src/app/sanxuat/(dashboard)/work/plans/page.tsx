'use client'

import React from 'react'
import WorkPlansView from '@/components/work-plans/WorkPlansView'
import TaskErrorBoundary from '@/components/tasks/TaskErrorBoundary'

export default function SanxuatWorkPlansPage() {
    return (
        <TaskErrorBoundary>
            <WorkPlansView />
        </TaskErrorBoundary>
    )
}

