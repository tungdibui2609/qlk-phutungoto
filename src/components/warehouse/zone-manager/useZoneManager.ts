import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { LocalZone, LocalPosition, ZoneTemplate, DBZone, TemplateNode } from './types'

export function useZoneManager() {
    const { showToast, showConfirm } = useToast()
    const { systemType } = useSystem()

    const [zones, setZones] = useState<LocalZone[]>([])
    const [originalZones, setOriginalZones] = useState<DBZone[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
    const [isSaving, setIsSaving] = useState(false)
    const [templates, setTemplates] = useState<ZoneTemplate[]>([])
    const [positionsMap, setPositionsMap] = useState<Record<string, LocalPosition[]>>({})

    // UI State
    const [addingUnder, setAddingUnder] = useState<string | null>(null)
    const [quickAddCode, setQuickAddCode] = useState('')
    const [quickAddName, setQuickAddName] = useState('')
    const [quickAddCount, setQuickAddCount] = useState(1)
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

    const [editingZone, setEditingZone] = useState<string | null>(null)
    const [editCode, setEditCode] = useState('')
    const [editName, setEditName] = useState('')

    const [savingTemplate, setSavingTemplate] = useState<string | null>(null)
    const [templateName, setTemplateName] = useState('')

    const [addingPositionsTo, setAddingPositionsTo] = useState<string | null>(null)
    const [editingPosition, setEditingPosition] = useState<{ id: string, code: string } | null>(null)


    // Computed dirty state
    const hasChanges = zones.some(z => z._status && z._status !== 'existing') ||
        Object.values(positionsMap).some(list => list.some(p => p._status && p._status !== 'existing'))

    useEffect(() => {
        if (systemType) {
            fetchZones()
            loadTemplates()
        }
    }, [systemType])

    async function loadTemplates() {
        const { data, error } = await supabase
            .from('zone_templates')
            .select('*')
            .order('created_at', { ascending: false })

        if (!error && data) {
            setTemplates((data as any[]).map(t => ({
                id: t.id,
                name: t.name,
                structure: t.structure as TemplateNode,
                createdAt: t.created_at
            })))
        }
    }

    async function fetchZones(preserveExpanded = false) {
        setLoading(true)
        const { data, error } = await supabase
            .from('zones')
            .select('*')
            .eq('system_type', systemType)
            .order('level', { ascending: true })
            .order('code', { ascending: true })

        if (error) {
            console.error('Error fetching zones:', error)
        } else {
            const loadedZones = (data as any[] || []).map(z => ({ ...z, _status: 'existing' } as LocalZone))
            setZones(loadedZones)
            setOriginalZones(data || [])

            // Fetch positions
            const { data: zpData, error: zpError } = await supabase
                .from('zone_positions')
                .select('zone_id, positions(*)')

            if (!zpError && zpData) {
                const map: Record<string, LocalPosition[]> = {}
                zpData.forEach((item: any) => {
                    if (item.positions && item.zone_id) {
                        if (!map[item.zone_id]) map[item.zone_id] = []
                        map[item.zone_id].push({ ...item.positions, _status: 'existing' })
                    }
                })
                Object.keys(map).forEach(key => {
                    map[key].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
                })
                setPositionsMap(map)
            }

            if (!preserveExpanded) {
                const rootIds = loadedZones.filter(z => z.level === 0).map(z => z.id)
                setExpandedNodes(new Set(rootIds))
            }
        }
        setLoading(false)
    }

    // --- ACTIONS ---

    function generateId() {
        return crypto.randomUUID()
    }

    function toggleExpand(id: string) {
        setExpandedNodes(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function handleQuickAdd(parentId: string | null, code: string, name: string, count: number, templateId?: string) {
        if (!code.trim() || !name.trim()) {
            showToast('Vui lòng nhập mã và tên!', 'warning')
            return
        }

        if (templateId) {
            applyTemplateLocal(parentId, templateId, code, name)
            return
        }

        let level = 0
        if (parentId) {
            const parent = zones.find(z => z.id === parentId)
            if (parent) level = (parent.level || 0) + 1
        }

        const newZones: LocalZone[] = []
        for (let i = 0; i < count; i++) {
            const suffix = count > 1 ? (i + 1).toString() : ''
            newZones.push({
                id: generateId(),
                code: (code.toUpperCase() + suffix).trim(),
                name: name + (count > 1 ? ` ${i + 1}` : ''),
                parent_id: parentId,
                level,
                created_at: new Date().toISOString(),
                _status: 'new',
                system_type: systemType
            })
        }

        setZones(prev => [...prev, ...newZones])
        if (parentId) setExpandedNodes(prev => new Set(prev).add(parentId))
    }

    function applyTemplateLocal(parentId: string | null, templateId: string, baseCode: string, baseName: string) {
        const template = templates.find(t => t.id === templateId)
        if (!template) return

        let parentLevel = -1
        if (parentId) {
            const parent = zones.find(z => z.id === parentId)
            if (parent) parentLevel = parent.level || 0
        }

        const newLocalZones: LocalZone[] = []

        function createFromTemplate(node: TemplateNode, pId: string | null, level: number) {
            const zoneId = generateId()
            newLocalZones.push({
                id: zoneId,
                code: node.code,
                name: node.name,
                parent_id: pId,
                level,
                created_at: new Date().toISOString(),
                _status: 'new',
                system_type: systemType
            })

            for (const child of node.children) {
                createFromTemplate(child, zoneId, level + 1)
            }
        }

        // Root
        const rootId = generateId()
        newLocalZones.push({
            id: rootId,
            code: baseCode.toUpperCase(),
            name: baseName,
            parent_id: parentId,
            level: parentLevel + 1,
            created_at: new Date().toISOString(),
            _status: 'new',
            system_type: systemType
        })

        // Children
        for (const child of template.structure.children) {
            createFromTemplate(child, rootId, parentLevel + 2)
        }

        setZones(prev => [...prev, ...newLocalZones])
        if (parentId) setExpandedNodes(prev => new Set(prev).add(parentId))
    }

    function handleRename(zoneId: string, code: string, name: string) {
        if (!code.trim() || !name.trim()) return

        setZones(prev => prev.map(z => {
            if (z.id === zoneId) {
                const newStatus = z._status === 'new' ? 'new' : 'modified'
                return { ...z, code: code.toUpperCase().trim(), name: name.trim(), _status: newStatus }
            }
            return z
        }))
    }

    function handleDuplicate(zone: LocalZone) {
        const newZones: LocalZone[] = []
        function duplicateRecursive(originalZone: LocalZone, newParentId: string | null) {
            const newId = generateId()
            const isRoot = originalZone.id === zone.id

            newZones.push({
                ...originalZone,
                id: newId,
                parent_id: newParentId,
                code: isRoot ? originalZone.code + '_COPY' : originalZone.code,
                name: isRoot ? originalZone.name + ' (copy)' : originalZone.name,
                created_at: new Date().toISOString(),
                _status: 'new'
            })

            const children = zones.filter(z => z.parent_id === originalZone.id && z._status !== 'deleted')
            for (const child of children) {
                duplicateRecursive(child, newId)
            }
        }
        duplicateRecursive(zone, zone.parent_id)
        setZones(prev => [...prev, ...newZones])
    }

    function handleDelete(id: string) {
        const idsToDelete = new Set<string>()
        function collectIds(zoneId: string) {
            idsToDelete.add(zoneId)
            const children = zones.filter(z => z.parent_id === zoneId && z._status !== 'deleted')
            for (const child of children) {
                collectIds(child.id)
            }
        }
        collectIds(id)

        setZones(prev => prev.map(z => {
            if (idsToDelete.has(z.id)) {
                return { ...z, _status: 'deleted' }
            }
            return z
        }))
    }

    function handleDeletePosition(posId: string, zoneId: string) {
        setPositionsMap(prev => {
            const list = prev[zoneId] || []
            const updatedList = list.map(p => {
                if (p.id === posId) {
                    if (p._status === 'new') return null
                    return { ...p, _status: 'deleted' as const }
                }
                return p
            }).filter(Boolean) as LocalPosition[]

            return { ...prev, [zoneId]: updatedList }
        })
    }

    function handleRenamePosition(zoneId: string, posId: string, newCode: string) {
        if (!newCode.trim()) return
        setPositionsMap(prev => {
            const list = [...(prev[zoneId] || [])]
            const idx = list.findIndex(p => p.id === posId)
            if (idx !== -1) {
                const original = list[idx]
                const newStatus = original._status === 'new' ? 'new' : 'modified'
                list[idx] = { ...original, code: newCode.trim().toUpperCase(), _status: newStatus }
                list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
                return { ...prev, [zoneId]: list }
            }
            return prev
        })
    }

    // --- TEMPLATES ---
    function buildTemplateFromZone(zoneId: string): TemplateNode {
        const zone = zones.find(z => z.id === zoneId)!
        const children = zones.filter(z => z.parent_id === zoneId && z._status !== 'deleted')
        return {
            code: zone.code,
            name: zone.name,
            children: children.map(c => buildTemplateFromZone(c.id))
        }
    }

    async function handleSaveAsTemplate(zoneId: string, name: string) {
        if (!name.trim()) return showToast('Vui lòng nhập tên mẫu!', 'warning')
        const structure = buildTemplateFromZone(zoneId)
        const { error } = await (supabase.from('zone_templates') as any).insert([{ name: name.trim(), structure }])
        if (error) {
            showToast('Lỗi: ' + error.message, 'error')
        } else {
            await loadTemplates()
            showToast(`Đã lưu mẫu "${name}" thành công!`, 'success')
        }
    }

    async function deleteTemplate(templateId: string) {
        if (!await showConfirm('Xóa mẫu này?')) return
        await supabase.from('zone_templates').delete().eq('id', templateId)
        await loadTemplates()
    }

    async function handleDeleteAllZones() {
        if (!await showConfirm('CẢNH BÁO: XÓA SẠCH toàn bộ cấu trúc kho?')) return
        if (!await showConfirm('Xác nhận lần 2: Dữ liệu sẽ mất vĩnh viễn?')) return

        setIsSaving(true)
        try {
            await supabase.from('zone_positions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            await supabase.from('positions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            await supabase.from('zones').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            showToast('Đã xóa sạch dữ liệu cấu trúc!', 'success')
            await fetchZones(true)
        } catch (err: any) {
            console.error('Delete all failed:', err)
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    async function handleSaveChanges() {
        if (!await showConfirm('Lưu tất cả thay đổi?')) return
        setIsSaving(true)

        try {
            // Delete Zones (Deepest first)
            const zonesToDelete = zones.filter(z => z._status === 'deleted' && originalZones.some(oz => oz.id === z.id))
            zonesToDelete.sort((a, b) => (b.level ?? 0) - (a.level ?? 0))
            const zoneIdsToDelete = zonesToDelete.map(z => z.id)

            if (zoneIdsToDelete.length > 0) {
                // Find associated positions
                const { data: zpData } = await supabase.from('zone_positions').select('position_id').in('zone_id', zoneIdsToDelete)
                const posIdsToDelete = (zpData as any[])?.map(item => item.position_id) || []

                await (supabase.from('zone_positions') as any).delete().in('zone_id', zoneIdsToDelete)
                if (posIdsToDelete.length > 0) {
                    await supabase.from('positions').delete().in('id', posIdsToDelete)
                }

                for (const zone of zonesToDelete) {
                    const { error } = await supabase.from('zones').delete().eq('id', zone.id)
                    if (error) throw error
                }
            }

            // Update Zones
            for (const z of zones.filter(z => z._status === 'modified')) {
                const { error } = await (supabase.from('zones') as any).update({ code: z.code, name: z.name }).eq('id', z.id)
                if (error) throw error
            }

            // Insert Zones
            const newZones = zones.filter(z => z._status === 'new')
            if (newZones.length > 0) {
                newZones.sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
                const cleanZones = newZones.map(z => ({
                    id: z.id, code: z.code, name: z.name, parent_id: z.parent_id, level: z.level, system_type: systemType
                }))
                const { error } = await (supabase.from('zones') as any).insert(cleanZones)
                if (error) throw error
            }

            // --- POSITIONS ---
            let allPos: LocalPosition[] = []
            Object.values(positionsMap).forEach(list => allPos.push(...list))

            // Delete Positions
            const pIdsDel = allPos.filter(p => p._status === 'deleted').map(p => p.id)
            if (pIdsDel.length > 0) await (supabase.from('positions') as any).delete().in('id', pIdsDel)

            // Update Positions
            for (const p of allPos.filter(p => p._status === 'modified')) {
                await (supabase.from('positions') as any).update({ code: p.code }).eq('id', p.id)
            }

            // Insert Positions
            for (const [zoneId, localPositions] of Object.entries(positionsMap)) {
                const unsaved = localPositions.filter(p => p._status === 'new')
                if (unsaved.length > 0) {
                    const posPayloads = unsaved.map(p => ({
                        id: p.id, code: p.code, display_order: p.display_order, batch_name: p.batch_name, system_type: systemType
                    }))
                    await (supabase.from('positions') as any).insert(posPayloads)

                    const links = unsaved.map(p => ({ zone_id: zoneId, position_id: p.id }))
                    await (supabase.from('zone_positions') as any).insert(links)
                }
            }

            showToast('Đã lưu thành công!', 'success')
            await fetchZones(true)
        } catch (err: any) {
            console.error('Save failed:', err)
            showToast('Lỗi khi lưu: ' + err.message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    async function handleDiscardChanges() {
        if (!await showConfirm('Hủy bỏ mọi thay đổi chưa lưu?')) return
        fetchZones(true)
    }

    // Helpers
    function findLeafZones(parentZoneId: string): LocalZone[] {
        const children = zones.filter(z => z.parent_id === parentZoneId && z._status !== 'deleted')
        if (children.length === 0) {
            const zone = zones.find(z => z.id === parentZoneId)
            return zone ? [zone] : []
        }
        return children.flatMap(child => findLeafZones(child.id))
    }

    function buildDefaultPrefix(zoneId: string): string {
        const parts: string[] = []
        let current = zones.find(z => z.id === zoneId)
        while (current) {
            if (current.code) parts.unshift(current.code)
            current = zones.find(z => z.id === current?.parent_id)
        }
        return parts.join('.') + '.V'
    }

    return {

        // State
        zones,
        loading,
        expandedNodes,
        isSaving,
        templates,
        positionsMap,
        hasChanges,

        // UI State
        ui: {
            addingUnder, setAddingUnder,
            quickAddCode, setQuickAddCode,
            quickAddName, setQuickAddName,
            quickAddCount, setQuickAddCount,
            selectedTemplateId, setSelectedTemplateId,
            editingZone, setEditingZone,
            editCode, setEditCode,
            editName, setEditName,
            savingTemplate, setSavingTemplate,
            templateName, setTemplateName,
            addingPositionsTo, setAddingPositionsTo,
            editingPosition, setEditingPosition
        },

        // Actions
        toggleExpand,
        handleQuickAdd,
        handleRename,
        handleDuplicate,
        handleDelete,
        handleDeleteAllZones,
        handleSaveAsTemplate,
        deleteTemplate,
        handleSaveChanges,
        handleDiscardChanges,

        // Positions
        setPositionsMap,
        buildDefaultPrefix,
        findLeafZones,
        handleDeletePosition,
        handleRenamePosition,
        generateId,

        // Helpers
        buildTree: (parentId: string | null) => zones.filter(z => z.parent_id === parentId && z._status !== 'deleted').sort((a, b) => (a.code || '').localeCompare(b.code || '')),
        countChildren: (zoneId: string) => {
            const countR = (zId: string): number => {
                const children = zones.filter(z => z.parent_id === zId && z._status !== 'deleted')
                return children.length + children.reduce((sum, c) => sum + countR(c.id), 0)
            }
            return countR(zoneId)
        },
    }
}
