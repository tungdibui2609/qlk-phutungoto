import { SupabaseClient } from '@supabase/supabase-js'

export const projectService = {
    async getProjectStats(supabase: SupabaseClient, systemCode: string) {
        // 1. Công trình đang thực hiện (in_progress)
        const { count: activeProjects, error: projectError } = await supabase
            .from('construction_projects')
            .select('*', { count: 'exact', head: true })
            .eq('system_code', systemCode)
            .eq('status', 'in_progress')

        if (projectError) throw projectError

        // 2. Nhiệm vụ chưa hoàn thành
        const { count: pendingTasks, error: taskError } = await supabase
            .from('construction_tasks')
            .select('*, construction_projects!inner(system_code)', { count: 'exact', head: true })
            .eq('construction_projects.system_code', systemCode)
            .neq('status', 'done')

        if (taskError) throw taskError

        return {
            activeProjects: activeProjects || 0,
            pendingTasks: pendingTasks || 0
        }
    },

    async getRecentProjects(supabase: SupabaseClient, systemCode: string, limit = 5) {
        const { data, error } = await supabase
            .from('construction_projects')
            .select('*')
            .eq('system_code', systemCode)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) throw error
        return data
    }
}
