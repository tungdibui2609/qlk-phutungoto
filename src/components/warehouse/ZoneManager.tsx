'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { Layers, Plus, Trash2, ChevronRight, ChevronDown, FolderTree, Copy, X, Edit2, Check, Save, FileDown, RotateCcw, CloudUpload, Package, Zap } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'

// Original DB type
type DBZone = Database['public']['Tables']['zones']['Row']
type DBPosition = Database['public']['Tables']['positions']['Row']

// Extended type for local state
interface LocalZone extends DBZone {
    _status?: 'new' | 'modified' | 'deleted' | 'existing'
}

interface LocalPosition extends DBPosition {
    _status?: 'new' | 'modified' | 'deleted' | 'existing'
}

interface ZoneTemplate {
    id: string
    name: string
    structure: TemplateNode
    createdAt: string
}

interface TemplateNode {
    code: string
    name: string
    children: TemplateNode[]
}

interface ZoneManagerProps {
    onZonesChanged?: () => void
}

export default function ZoneManager({ onZonesChanged }: ZoneManagerProps) {
    const { showToast, showConfirm } = useToast()
    const { systemType } = useSystem()

    // Main state now holds both existing and new/modified zones
    const [zones, setZones] = useState<LocalZone[]>([])
    const [originalZones, setOriginalZones] = useState<DBZone[]>([]) // To track what was originally there
    const [loading, setLoading] = useState(true)
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
    const [isSaving, setIsSaving] = useState(false)

    // Templates
    const [templates, setTemplates] = useState<ZoneTemplate[]>([])
    const [savingTemplate, setSavingTemplate] = useState<string | null>(null)
    const [templateName, setTemplateName] = useState('')

    // Quick add state
    const [addingUnder, setAddingUnder] = useState<string | null>(null)
    const [quickAddCode, setQuickAddCode] = useState('')
    const [quickAddName, setQuickAddName] = useState('')
    const [quickAddCount, setQuickAddCount] = useState(1)
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

    // Edit state
    const [editingZone, setEditingZone] = useState<string | null>(null)
    const [editCode, setEditCode] = useState('')
    const [editName, setEditName] = useState('')

    // Position creation state
    const [addingPositionsTo, setAddingPositionsTo] = useState<string | null>(null)
    const [posPrefix, setPosPrefix] = useState('V')
    const [posStart, setPosStart] = useState(1)
    const [posCount, setPosCount] = useState(10)
    const [isCreatingPositions, setIsCreatingPositions] = useState(false)
    const [positionsMap, setPositionsMap] = useState<Record<string, LocalPosition[]>>({})
    // Auto position creation mode
    const [autoMode, setAutoMode] = useState(false)
    const [autoPosSuffix, setAutoPosSuffix] = useState('V')
    const [autoPosPattern, setAutoPosPattern] = useState('')  // Custom pattern for position codes
    const [editingPosition, setEditingPosition] = useState<{ id: string, code: string } | null>(null)

    // ... (existing helper fns)

    async function handleCreatePositions() {
        if (!addingPositionsTo) return
        if (posCount < 1) return showToast('Số lượng phải > 0', 'warning')

        // Allow creating for new zones too, no restriction needed as we save everything together.
        const targetZone = zones.find(z => z.id === addingPositionsTo)
        if (!targetZone) return

        setIsCreatingPositions(true)
        try {
            const newPositions: LocalPosition[] = Array.from({ length: posCount }).map((_, i) => ({
                id: generateId(),
                code: `${posPrefix}${posStart + i}`.toUpperCase(),
                display_order: posStart + i,
                batch_name: `Batch ${new Date().toLocaleTimeString()} - ${targetZone?.name}`,
                created_at: new Date().toISOString(),
                status: 'active',
                lot_id: null,
                _status: 'new',
                system_type: systemType // Add system_type
            } as any))

            setPositionsMap(prev => {
                const currentList = prev[addingPositionsTo] || []
                return {
                    ...prev,
                    [addingPositionsTo]: [...currentList, ...newPositions].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
                }
            })

            setAddingPositionsTo(null)
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setIsCreatingPositions(false)
        }
    }

    // Find all leaf zones (zones with no children) under a parent zone
    function findLeafZones(parentZoneId: string): LocalZone[] {
        const children = zones.filter(z => z.parent_id === parentZoneId && z._status !== 'deleted')
        if (children.length === 0) {
            // This is a leaf zone
            const zone = zones.find(z => z.id === parentZoneId)
            return zone ? [zone] : []
        }
        // Recursively find leaves in children
        return children.flatMap(child => findLeafZones(child.id))
    }

    // Auto create positions for all leaf zones under a parent
    async function handleAutoCreatePositions() {
        if (!addingPositionsTo) return
        if (posCount < 1) return showToast('Số lượng phải > 0', 'warning')

        setIsCreatingPositions(true)
        try {
            const leafZones = findLeafZones(addingPositionsTo)
            if (leafZones.length === 0) {
                showToast('Không tìm thấy zone cuối cùng nào!', 'warning')
                return
            }

            let totalCreated = 0
            const newPositionsMap: Record<string, LocalPosition[]> = { ...positionsMap }

            for (const leafZone of leafZones) {
                // Build zone parts map for flexible placeholder replacement
                const zoneParts: Record<string, string> = {}
                const zonePathParts: string[] = []
                let current: LocalZone | undefined = leafZone

                while (current) {
                    if (current.code) {
                        zonePathParts.unshift(current.code)
                        // Extract prefix (letters) from code, e.g., "NK1" -> "NK"
                        const prefix = current.code.replace(/\d+/g, '').toUpperCase()
                        zoneParts[prefix] = current.code
                    }
                    current = zones.find(z => z.id === current?.parent_id)
                }

                const zonePath = zonePathParts.join('.')

                // Get the pattern - either custom or default
                const pattern = autoPosPattern || `{zone}.${autoPosSuffix}{#}`

                // Replace {#} with placeholder for position number
                let codePattern = pattern.replace(/\{#\}/g, '___POS_NUM___')

                // Replace {zone} with full path
                codePattern = codePattern.replace(/\{zone\}/gi, zonePath)

                // Replace individual zone placeholders like {NK}, {N}, {KA}, {D}, {T}
                // Sort by length descending to replace longer prefixes first
                const sortedPrefixes = Object.keys(zoneParts).sort((a, b) => b.length - a.length)
                for (const prefix of sortedPrefixes) {
                    const regex = new RegExp(`\\{${prefix}\\}`, 'gi')
                    codePattern = codePattern.replace(regex, zoneParts[prefix])
                }

                const newPositions: LocalPosition[] = Array.from({ length: posCount }).map((_, i) => ({
                    id: generateId(),
                    code: codePattern.replace(/___POS_NUM___/g, String(posStart + i)).toUpperCase(),
                    display_order: posStart + i,
                    batch_name: `Auto Batch ${new Date().toLocaleTimeString()} - ${leafZone?.name}`,
                    created_at: new Date().toISOString(),
                    status: 'active',
                    lot_id: null,
                    _status: 'new' as const,
                    system_type: systemType // Add system_type
                } as any))

                const currentList = newPositionsMap[leafZone.id] || []
                newPositionsMap[leafZone.id] = [...currentList, ...newPositions].sort((a, b) =>
                    a.code.localeCompare(b.code, undefined, { numeric: true })
                )
                totalCreated += newPositions.length
            }

            setPositionsMap(newPositionsMap)
            showToast(`Đã tạo ${totalCreated} vị trí cho ${leafZones.length} zone cuối cùng!`, 'success')
            setAddingPositionsTo(null)
            setAutoMode(false)
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setIsCreatingPositions(false)
        }
    }

    // Computed dirty state
    const hasChanges = zones.some(z => z._status && z._status !== 'existing') ||
        Object.values(positionsMap).some(list => list.some(p => p._status && p._status !== 'existing'))

    useEffect(() => {
        fetchZones()
        loadTemplates()
    }, [systemType]) // Add dependency

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
            .eq('system_type', systemType) // Filter by systemType
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
                // Sort positions by code
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

    // --- LOCAL STATE MANIPULATION ---

    // Generate a temporary UUID for new items
    function generateId() {
        return crypto.randomUUID()
    }

    function handleQuickAdd(parentId: string | null) {
        if (!quickAddCode.trim() || !quickAddName.trim()) {
            showToast('Vui lòng nhập mã và tên!', 'warning')
            return
        }

        // Apply template logic (locally)
        if (selectedTemplateId) {
            applyTemplateLocal(parentId, selectedTemplateId, quickAddCode, quickAddName)
            resetAddForm()
            return
        }

        let level = 0
        if (parentId) {
            const parent = zones.find(z => z.id === parentId)
            if (parent) level = (parent.level || 0) + 1
        }

        const newZones: LocalZone[] = []
        for (let i = 0; i < quickAddCount; i++) {
            const suffix = quickAddCount > 1 ? (i + 1).toString() : ''
            newZones.push({
                id: generateId(),
                code: (quickAddCode.toUpperCase() + suffix).trim(),
                name: quickAddName + (quickAddCount > 1 ? ` ${i + 1}` : ''),
                parent_id: parentId,
                level,
                created_at: new Date().toISOString(),
                _status: 'new',
                system_type: systemType
            })
        }

        setZones(prev => [...prev, ...newZones])
        resetAddForm()

        // Auto expand parent
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

    function handleRename(zoneId: string) {
        if (!editCode.trim() || !editName.trim()) return

        setZones(prev => prev.map(z => {
            if (z.id === zoneId) {
                const newStatus = z._status === 'new' ? 'new' : 'modified'
                return { ...z, code: editCode.toUpperCase().trim(), name: editName.trim(), _status: newStatus }
            }
            return z
        }))
        setEditingZone(null)
    }

    function handleDuplicate(zone: LocalZone) {
        // Deep copy locally
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

            // Find children in current local state
            const children = zones.filter(z => z.parent_id === originalZone.id && z._status !== 'deleted')
            for (const child of children) {
                duplicateRecursive(child, newId)
            }
        }

        duplicateRecursive(zone, zone.parent_id)
        setZones(prev => [...prev, ...newZones])
    }

    function handleDelete(id: string) {
        // Recursive delete mark
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

    function resetAddForm() {
        setAddingUnder(null)
        setQuickAddCode('')
        setQuickAddName('')
        setQuickAddCount(1)
        setSelectedTemplateId('')
    }

    function handleDeletePosition(posId: string, zoneId: string) {
        setPositionsMap(prev => {
            const list = prev[zoneId] || []
            // If it's new (unsaved), just remove it.
            // If it's existing/modified, mark as deleted.
            const updatedList = list.map(p => {
                if (p.id === posId) {
                    if (p._status === 'new') return null // Will filter out
                    return { ...p, _status: 'deleted' as const }
                }
                return p
            }).filter(Boolean) as LocalPosition[]

            return { ...prev, [zoneId]: updatedList }
        })
    }

    function handleRenamePosition() {
        if (!editingPosition || !editingPosition.code.trim()) return

        setPositionsMap(prev => {
            const newMap = { ...prev }
            for (const zId in newMap) {
                const idx = newMap[zId].findIndex(p => p.id === editingPosition.id)
                if (idx !== -1) {
                    const original = newMap[zId][idx]
                    const newPositions = [...newMap[zId]]

                    const newStatus = original._status === 'new' ? 'new' : 'modified'

                    newPositions[idx] = {
                        ...original,
                        code: editingPosition.code.trim().toUpperCase(),
                        _status: newStatus
                    }
                    newPositions.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
                    newMap[zId] = newPositions
                    break
                }
            }
            return newMap
        })
        setEditingPosition(null)
    }

    // --- SAVE LOGIC ---

    async function handleSaveChanges() {
        const confirmed = await showConfirm('Lưu tất cả thay đổi vào cơ sở dữ liệu?')
        if (!confirmed) return
        setIsSaving(true)

        try {
            // --- ZONES ---
            // 1. Deletes - IMPORTANT: Delete from deepest level first (children before parents)
            // to avoid foreign key constraint issues with parent_id
            const zonesToDelete = zones.filter(z => z._status === 'deleted' && originalZones.some(oz => oz.id === z.id))

            // Sort by level descending (deepest first)
            zonesToDelete.sort((a, b) => (b.level ?? 0) - (a.level ?? 0))
            const zoneIdsToDelete = zonesToDelete.map(z => z.id)

            if (zoneIdsToDelete.length > 0) {
                console.log(`[ZoneManager] Attempting to delete ${zoneIdsToDelete.length} zones:`, zoneIdsToDelete)

                // 0. Find all positions associated with these zones (to delete them later)
                const { data: zpData } = await supabase
                    .from('zone_positions')
                    .select('position_id')
                    .in('zone_id', zoneIdsToDelete)

                const posIdsToDelete = (zpData as any[])?.map(item => item.position_id) || []
                console.log(`[ZoneManager] Found ${posIdsToDelete.length} associated positions to delete`)

                // 1. First, delete zone_positions for these zones (though CASCADE should handle this)
                const { error: zpError, count: zpCount } = await (supabase.from('zone_positions') as any).delete().in('zone_id', zoneIdsToDelete)
                console.log(`[ZoneManager] zone_positions delete result: count=${zpCount}, error=`, zpError)
                if (zpError) console.warn('zone_positions delete warning:', zpError)

                // 2. Delete orphaned positions
                if (posIdsToDelete.length > 0) {
                    // Split into chunks if too many? For now just try direct delete.
                    // The logic is: if a zone is deleted, its positions are also deleted.
                    const { error: pError } = await supabase.from('positions').delete().in('id', posIdsToDelete)
                    if (pError) console.error('Failed to delete orphan positions:', pError)
                    else console.log(`[ZoneManager] Deleted ${posIdsToDelete.length} orphan positions`)
                }

                // 3. Delete zones one by one from deepest level to avoid constraint issues
                for (const zone of zonesToDelete) {
                    console.log(`[ZoneManager] Deleting zone: id=${zone.id}, code=${zone.code}, level=${zone.level}`)
                    const { error, count } = await supabase.from('zones').delete().eq('id', zone.id)
                    console.log(`[ZoneManager] Delete result for ${zone.code}: count=${count}, error=`, error)
                    if (error) {
                        console.error(`Failed to delete zone ${zone.id} (${zone.code}):`, error)
                        throw error
                    }
                }
                console.log(`[ZoneManager] Successfully deleted ${zonesToDelete.length} zones`)
            }

            // 2. Updates
            const zoneUpdates = zones.filter(z => z._status === 'modified')
            for (const z of zoneUpdates) {
                const { error } = await (supabase.from('zones') as any).update({ code: z.code, name: z.name }).eq('id', z.id)
                if (error) throw error
            }

            // 3. Inserts
            const newZones = zones.filter(z => z._status === 'new')
            if (newZones.length > 0) {
                newZones.sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
                const cleanZones = newZones.map(z => ({
                    id: z.id,
                    code: z.code,
                    name: z.name,
                    parent_id: z.parent_id,
                    level: z.level,
                    system_type: systemType // Add system_type
                }))
                const { error } = await (supabase.from('zones') as any).insert(cleanZones)
                if (error) throw error
            }

            // --- POSITIONS ---
            let allPos: LocalPosition[] = []
            Object.values(positionsMap).forEach(list => allPos.push(...list))

            // 1. Pos Deletes
            const posIdsToDelete = allPos.filter(p => p._status === 'deleted').map(p => p.id)
            if (posIdsToDelete.length > 0) {
                const { error } = await (supabase.from('positions') as any).delete().in('id', posIdsToDelete)
                if (error) throw error
            }

            // 2. Pos Updates
            const posUpdates = allPos.filter(p => p._status === 'modified')
            for (const p of posUpdates) {
                const { error } = await (supabase.from('positions') as any).update({ code: p.code }).eq('id', p.id)
                if (error) throw error
            }

            // 3. Pos Inserts
            // Iterate map to keep track of zone_id
            for (const [zoneId, localPositions] of Object.entries(positionsMap)) {
                const unsaved = localPositions.filter(p => p._status === 'new')
                if (unsaved.length > 0) {
                    // For each new position, we need to insert it
                    const posPayloads = unsaved.map(p => ({
                        id: p.id,
                        code: p.code,
                        display_order: p.display_order,
                        batch_name: p.batch_name,
                        system_type: systemType // Add system_type
                    }))

                    const { error: posError } = await (supabase.from('positions') as any).insert(posPayloads)
                    if (posError) throw posError

                    // Create links
                    const links = unsaved.map(p => ({
                        zone_id: zoneId,
                        position_id: p.id
                    }))
                    const { error: linkError } = await (supabase.from('zone_positions') as any).insert(links)
                    if (linkError) throw linkError
                }
            }

            showToast('Đã lưu thành công!', 'success')
            await fetchZones(true)
            onZonesChanged?.()

        } catch (err: any) {
            console.error('Save failed:', err)
            showToast('Lỗi khi lưu: ' + (err.message || JSON.stringify(err)), 'error')
        } finally {
            setIsSaving(false)
        }
    }

    async function handleDiscardChanges() {
        const confirmed = await showConfirm('Hủy bỏ mọi thay đổi chưa lưu?')
        if (!confirmed) return
        fetchZones(true) // Reload original
    }

    // --- UTILS ---

    function buildTemplateFromZone(zoneId: string): TemplateNode {
        const zone = zones.find(z => z.id === zoneId)!
        const children = zones.filter(z => z.parent_id === zoneId && z._status !== 'deleted')

        return {
            code: zone.code,
            name: zone.name,
            children: children.map(c => buildTemplateFromZone(c.id))
        }
    }

    async function handleSaveAsTemplate(zoneId: string) {
        if (!templateName.trim()) {
            showToast('Vui lòng nhập tên mẫu!', 'warning')
            return
        }

        const structure = buildTemplateFromZone(zoneId)

        const { error } = await (supabase
            .from('zone_templates') as any)
            .insert([{
                name: templateName.trim(),
                structure
            }])

        if (error) {
            showToast('Lỗi: ' + error.message, 'error')
        } else {
            setSavingTemplate(null)
            setTemplateName('')
            await loadTemplates()
            showToast(`Đã lưu mẫu "${templateName}" thành công!`, 'success')
        }
    }

    async function deleteTemplate(templateId: string) {
        const confirmed = await showConfirm('Xóa mẫu này?')
        if (!confirmed) return
        const { error } = await supabase.from('zone_templates').delete().eq('id', templateId)
        if (!error) await loadTemplates()
    }

    async function handleDeleteAllZones() {
        const confirmed = await showConfirm('CẢNH BÁO: Hành động này sẽ XÓA SẠCH toàn bộ cấu trúc kho (Zones & Vị trí)!\n\nBạn có chắc chắn muốn tiếp tục không?')
        if (!confirmed) return

        const doubleCheck = await showConfirm('Xác nhận lần 2: Dữ liệu sẽ mất vĩnh viễn. Tiếp tục?')
        if (!doubleCheck) return

        setIsSaving(true)
        try {
            // Delete in order: zone_positions -> positions (if needed, but schema handles cascade) -> zones
            // Actually our schema: zone_positions CASCADE on zone delete. 
            // So we just need to delete all zones.

            console.log('[ZoneManager] Deleting ALL zones...')

            // 1. Delete all zone_positions first to be safe
            const { error: zpError } = await supabase.from('zone_positions').delete().neq('id', '00000000-0000-0000-0000-000000000000') // delete all
            if (zpError) console.warn('Error clearing zone_positions:', zpError)

            // 2. Delete all positions (orphan cleanup)
            const { error: pError } = await supabase.from('positions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            if (pError) throw pError

            // 3. Delete all zones
            const { error: zError } = await supabase.from('zones').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            if (zError) throw zError

            showToast('Đã xóa sạch dữ liệu cấu trúc!', 'success')
            await fetchZones(true)
            onZonesChanged?.()
        } catch (err: any) {
            console.error('Delete all failed:', err)
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    function toggleExpand(id: string) {
        setExpandedNodes(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function buildTree(parentId: string | null): LocalZone[] {
        return zones
            .filter(z => z.parent_id === parentId && z._status !== 'deleted')
            .sort((a, b) => (a.code || '').localeCompare(b.code || ''))
    }

    function countChildren(zoneId: string): number {
        const children = zones.filter(z => z.parent_id === zoneId && z._status !== 'deleted')
        return children.length + children.reduce((sum, c) => sum + countChildren(c.id), 0)
    }

    function buildDefaultPrefix(zoneId: string): string {
        const parts: string[] = []
        let current = zones.find(z => z.id === zoneId)

        while (current) {
            if (current.code) parts.unshift(current.code)
            current = zones.find(z => z.id === current?.parent_id)
        }

        // Return structured prefix, e.g., NK1.KA.D1.V
        // Or maybe just dot notation ending with dot? User prompted "V" but structured is better.
        // User example: NK1.KAD1.T1
        // Usually it's nice to have a separator.
        return parts.join('.') + '.V'
    }

    const rootZones = buildTree(null)

    // Render helpers
    function renderQuickAddForm(parentId: string | null, depth: number = 0) {
        if (addingUnder !== (parentId || 'root')) return null

        return (
            <div
                className="flex flex-wrap items-center gap-2 py-2 px-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 my-1"
                style={{ marginLeft: `${depth * 20 + 12}px` }}
            >
                <input
                    type="text"
                    value={quickAddCode}
                    onChange={(e) => setQuickAddCode(e.target.value)}
                    placeholder="Mã"
                    className="w-24 px-2 py-1 border rounded text-xs font-mono uppercase"
                    autoFocus
                />
                <input
                    type="text"
                    value={quickAddName}
                    onChange={(e) => setQuickAddName(e.target.value)}
                    placeholder="Tên"
                    className="w-32 px-2 py-1 border rounded text-xs"
                />

                {/* Template selector */}
                {templates.length > 0 && (
                    <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="px-2 py-1 border rounded text-xs bg-white"
                    >
                        <option value="">-- Không dùng mẫu --</option>
                        {templates.map(t => (
                            <option key={t.id} value={t.id}>📋 {t.name}</option>
                        ))}
                    </select>
                )}

                {/* Count (only if no template) */}
                {!selectedTemplateId && (
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">×</span>
                        <input
                            type="number"
                            value={quickAddCount}
                            onChange={(e) => setQuickAddCount(Math.max(1, parseInt(e.target.value) || 1))}
                            min={1}
                            max={50}
                            className="w-12 px-1 py-1 border rounded text-xs text-center"
                        />
                    </div>
                )}

                <button
                    onClick={() => handleQuickAdd(parentId)}
                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                >
                    {selectedTemplateId ? 'Áp dụng mẫu' : 'Tạo'}
                </button>
                <button onClick={() => { setAddingUnder(null); setSelectedTemplateId('') }} className="p-1 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                </button>
            </div>
        )
    }

    // Render Node
    function renderZoneNode(zone: LocalZone, depth: number = 0) {
        const children = buildTree(zone.id)
        const positions = positionsMap[zone.id] || []
        const hasChildren = children.length > 0 || positions.length > 0
        const isExpanded = expandedNodes.has(zone.id)
        const isEditing = editingZone === zone.id
        const isSavingTemplate = savingTemplate === zone.id
        const childCount = countChildren(zone.id)
        const posCount = positions.length

        // Visual diffs
        const isNew = zone._status === 'new'
        const isModified = zone._status === 'modified'

        return (
            <div key={zone.id} className="select-none">
                <div
                    className={`flex items-center gap-2 py-2 px-3 rounded-lg group border-l-2 transition-colors
                        ${isNew ? 'bg-green-50 border-green-500 hover:bg-green-100' :
                            isModified ? 'bg-yellow-50 border-yellow-500 hover:bg-yellow-100' :
                                'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                    style={{ paddingLeft: `${depth * 20 + 12}px` }}
                >
                    <button
                        onClick={() => toggleExpand(zone.id)}
                        className={`w-5 h-5 flex items-center justify-center text-gray-400 ${!hasChildren && 'invisible'}`}
                    >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    <Layers size={16} className={isNew ? "text-green-500" : isModified ? "text-yellow-600" : "text-orange-500"} />

                    {isSavingTemplate ? (
                        <div className="flex items-center gap-2 flex-1">
                            <span className="text-xs text-gray-500">Tên mẫu:</span>
                            <input
                                type="text"
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                className="flex-1 px-2 py-0.5 border rounded text-xs"
                                placeholder="VD: Khu 7 dãy x 5 tầng"
                                autoFocus
                            />
                            <button onClick={() => handleSaveAsTemplate(zone.id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                <Check size={14} />
                            </button>
                            <button onClick={() => { setSavingTemplate(null); setTemplateName('') }} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                                <X size={14} />
                            </button>
                        </div>
                    ) : isEditing ? (
                        <div className="flex items-center gap-2 flex-1">
                            <input
                                type="text"
                                value={editCode}
                                onChange={(e) => setEditCode(e.target.value)}
                                className="w-24 px-2 py-0.5 border rounded text-xs font-mono uppercase"
                                placeholder="Mã"
                            />
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="flex-1 px-2 py-0.5 border rounded text-xs"
                                placeholder="Tên"
                            />
                            <button onClick={() => handleRename(zone.id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                <Check size={14} />
                            </button>
                            <button onClick={() => setEditingZone(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{zone.code}</span>
                                <span className="text-sm text-gray-900 dark:text-white font-medium">{zone.name}</span>
                                <span className="text-xs text-gray-400">(L{zone.level})</span>
                                {childCount > 0 && <span className="text-xs text-blue-500">• {childCount} zone con</span>}
                                {posCount > 0 && <span className="text-xs text-green-600 font-medium">• {posCount} vị trí</span>}
                                {isNew && <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">Mới</span>}
                                {isModified && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded">Sửa</span>}
                            </div>

                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => { setEditingZone(zone.id); setEditCode(zone.code); setEditName(zone.name) }}
                                    className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded"
                                    title="Đổi tên"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button
                                    onClick={() => { setAddingUnder(zone.id); setQuickAddCode(''); setQuickAddName(''); setQuickAddCount(1); setSelectedTemplateId('') }}
                                    className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                                    title="Thêm zone con"
                                >
                                    <Plus size={14} />
                                </button>
                                {hasChildren && (
                                    <button
                                        onClick={() => { setSavingTemplate(zone.id); setTemplateName('') }}
                                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                                        title="Lưu làm mẫu"
                                    >
                                        <Save size={14} />
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDuplicate(zone)}
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Nhân bản"
                                >
                                    <Copy size={14} />
                                </button>
                                <button
                                    onClick={() => { setAddingPositionsTo(zone.id); setPosPrefix(buildDefaultPrefix(zone.id)); setPosStart(1); setPosCount(10); }}
                                    className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded"
                                    title="Tạo vị trí hàng loạt"
                                >
                                    <Package size={14} />
                                </button>
                                <button
                                    onClick={() => handleDelete(zone.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    title="Xóa"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {renderQuickAddForm(zone.id, depth + 1)}

                {hasChildren && isExpanded && (
                    <div>
                        {children.map(child => renderZoneNode(child, depth + 1))}
                        {/* Render Positions */}
                        {positions.filter(p => p._status !== 'deleted').map(pos => {
                            const isEditingPos = editingPosition?.id === pos.id

                            return (
                                <div
                                    key={pos.id}
                                    className="flex items-center gap-2 py-1 px-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 group/pos border-l-2 border-transparent"
                                    style={{ paddingLeft: `${(depth + 1) * 20 + 12}px` }}
                                >
                                    <div className="w-5" /> {/* Placeholder for expand arrow */}
                                    <Package size={14} className="text-blue-400" />

                                    {isEditingPos ? (
                                        <div className="flex items-center gap-1 flex-1">
                                            <input
                                                autoFocus
                                                type="text"
                                                value={editingPosition.code}
                                                onChange={(e) => setEditingPosition({ ...editingPosition, code: e.target.value.toUpperCase() })}
                                                className="w-full px-1 py-0.5 text-xs font-mono border rounded uppercase"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleRenamePosition()
                                                    if (e.key === 'Escape') setEditingPosition(null)
                                                }}
                                            />
                                            <button onClick={handleRenamePosition} className="p-0.5 text-green-600"><Check size={14} /></button>
                                            <button onClick={() => setEditingPosition(null)} className="p-0.5 text-red-500"><X size={14} /></button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="font-mono text-xs text-gray-700 dark:text-gray-300 select-all">{pos.code}</span>

                                            <div className="flex-1" />

                                            <div className="flex items-center gap-1 opacity-0 group-hover/pos:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setEditingPosition({ id: pos.id, code: pos.code })}
                                                    className="p-1 text-gray-300 hover:text-blue-500"
                                                    title="Sửa tên"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePosition(pos.id, zone.id)}
                                                    className="p-1 text-gray-300 hover:text-red-500"
                                                    title="Xóa vị trí"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Save Bar */}
            {hasChanges && (
                <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 p-4 rounded-xl border-l-4 border-l-yellow-500 shadow-lg flex items-center justify-between animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <div className="bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-full">
                            <Edit2 size={20} className="text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white">Có thay đổi chưa lưu!</p>
                            <p className="text-xs text-gray-500">
                                {(() => {
                                    // Calculate stats
                                    const zStats = {
                                        new: zones.filter(z => z._status === 'new').length,
                                        del: zones.filter(z => z._status === 'deleted').length,
                                        mod: zones.filter(z => z._status === 'modified').length
                                    }

                                    const pStats = {
                                        new: 0,
                                        del: 0,
                                        mod: 0
                                    }

                                    Object.values(positionsMap).forEach(list => {
                                        pStats.new += list.filter(p => p._status === 'new').length
                                        pStats.del += list.filter(p => p._status === 'deleted').length
                                        pStats.mod += list.filter(p => p._status === 'modified').length
                                    })

                                    return `${zStats.new + pStats.new} thêm, ${zStats.del + pStats.del} xóa, ${zStats.mod + pStats.mod} sửa`
                                })()}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDiscardChanges}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm font-medium flex items-center gap-2"
                        >
                            <RotateCcw size={16} />
                            Hủy bỏ
                        </button>
                        <button
                            onClick={handleSaveChanges}
                            disabled={isSaving}
                            className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-bold shadow-md transition-all transform hover:scale-105 flex items-center gap-2"
                        >
                            {isSaving ? 'Đang lưu...' : (
                                <>
                                    <CloudUpload size={18} />
                                    Lưu Thay Đổi
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Template list */}
            {templates.length > 0 && (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-purple-800 dark:text-purple-300 flex items-center gap-2">
                            <FileDown size={16} />
                            Mẫu đã lưu ({templates.length})
                        </h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {templates.map(t => (
                            <div key={t.id} className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 rounded border text-xs">
                                <span className="font-medium text-gray-700 dark:text-gray-300">{t.name}</span>
                                <button onClick={() => deleteTemplate(t.id)} className="p-0.5 text-gray-400 hover:text-red-500">
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Zone tree */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <FolderTree className="text-orange-500" size={20} />
                    Thiết kế Cấu trúc Khu (Zone)
                </h3>

                <p className="text-xs text-gray-500 mb-4">
                    💡 Chế độ thiết kế: Mọi thay đổi sẽ được lưu tạm. Bấm "Lưu Thay Đổi" ở trên cùng để áp dụng.
                </p>

                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="p-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <span className="text-xs text-gray-500">Cấu trúc Zone ({zones.filter(z => z._status !== 'deleted').length} zone)</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleDeleteAllZones}
                                className="flex items-center gap-1 px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium border border-red-200"
                                title="Xóa toàn bộ dữ liệu (Reset)"
                            >
                                <Trash2 size={12} />
                                Xóa tất cả
                            </button>
                            <button
                                onClick={() => { setAddingUnder('root'); setQuickAddCode(''); setQuickAddName(''); setQuickAddCount(1); setSelectedTemplateId('') }}
                                className="flex items-center gap-1 px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-medium"
                            >
                                <Plus size={12} />
                                Thêm Zone gốc
                            </button>
                        </div>
                    </div>

                    <div className="max-h-[600px] overflow-y-auto p-2">
                        {renderQuickAddForm(null, 0)}

                        {loading ? (
                            <p className="text-sm text-gray-500 text-center py-4">Đang tải...</p>
                        ) : rootZones.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4 italic">Chưa có zone nào</p>
                        ) : (
                            rootZones.map(zone => renderZoneNode(zone))
                        )}
                    </div>
                </div>
            </div>

            {/* Position Creator Modal */}
            {addingPositionsTo && (() => {
                const currentZone = zones.find(z => z.id === addingPositionsTo)
                const leafZones = findLeafZones(addingPositionsTo)
                const hasChildren = zones.some(z => z.parent_id === addingPositionsTo && z._status !== 'deleted')

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
                            <div className="p-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Package size={18} className="text-orange-500" />
                                    Tạo vị trí hàng loạt
                                </h3>
                                <button
                                    onClick={() => { setAddingPositionsTo(null); setAutoMode(false); }}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-4 space-y-3 overflow-y-auto flex-1">
                                {/* Zone info */}
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                                    Đang tạo vị trí cho: <span className="font-bold">{currentZone?.name}</span>
                                    {hasChildren && (
                                        <span className="ml-2 text-xs bg-blue-200 dark:bg-blue-800 px-2 py-0.5 rounded-full">
                                            {leafZones.length} zone cuối cùng
                                        </span>
                                    )}
                                </div>

                                {/* Mode Tabs - Only show if zone has children */}
                                {hasChildren && (
                                    <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-900 rounded-lg">
                                        <button
                                            onClick={() => setAutoMode(false)}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${!autoMode
                                                ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
                                                : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            <Package size={16} />
                                            Thủ công
                                        </button>
                                        <button
                                            onClick={() => setAutoMode(true)}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${autoMode
                                                ? 'bg-gradient-to-r from-purple-500 to-indigo-500 shadow text-white'
                                                : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            <Zap size={16} />
                                            Auto ({leafZones.length} zone)
                                        </button>
                                    </div>
                                )}

                                {/* Manual Mode Content */}
                                {!autoMode && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Mã bắt đầu (Tiền tố)</label>
                                                <input
                                                    type="text"
                                                    value={posPrefix}
                                                    onChange={(e) => setPosPrefix(e.target.value.toUpperCase())}
                                                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase bg-gray-50 focus:bg-white transition-colors outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="VD: A"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Số bắt đầu</label>
                                                <input
                                                    type="number"
                                                    value={posStart}
                                                    onChange={(e) => setPosStart(Math.max(0, parseInt(e.target.value) || 0))}
                                                    className="w-full px-3 py-2 border rounded-lg text-sm text-center bg-gray-50 focus:bg-white transition-colors outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Số lượng cần tạo</label>
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="100"
                                                    value={posCount}
                                                    onChange={(e) => setPosCount(parseInt(e.target.value))}
                                                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                                />
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="1000"
                                                    value={posCount}
                                                    onChange={(e) => setPosCount(Math.max(1, parseInt(e.target.value) || 0))}
                                                    className="w-20 px-2 py-1 text-center font-bold text-lg text-blue-600 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none hover:border-blue-300 transition-colors"
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3">
                                            <p className="text-xs font-medium text-gray-500 mb-2">Xem trước (3 vị trí đầu/cuối):</p>
                                            <div className="flex flex-wrap gap-2 font-mono text-xs">
                                                <span className="bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm">{posPrefix}{posStart}</span>
                                                <span className="bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm">{posPrefix}{posStart + 1}</span>
                                                <span className="text-gray-400">...</span>
                                                <span className="bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm">{posPrefix}{posStart + posCount - 1}</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleCreatePositions}
                                            disabled={isCreatingPositions}
                                            className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold rounded-xl shadow-lg transform transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            {isCreatingPositions ? 'Đang xử lý...' : (
                                                <>
                                                    <Package size={20} />
                                                    Tạo & Gán Ngay
                                                </>
                                            )}
                                        </button>
                                    </>
                                )}

                                {/* Auto Mode Content */}
                                {autoMode && (
                                    <>
                                        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-2">
                                            <div className="flex items-center gap-2">
                                                <Zap size={16} className="text-purple-600 dark:text-purple-300" />
                                                <span className="text-xs text-purple-700 dark:text-purple-300">
                                                    Tạo <b>{posCount}</b> vị trí tại <b>{leafZones.length}</b> zone cuối cùng = <b className="text-purple-800">{leafZones.length * posCount}</b> vị trí mới
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Hậu tố vị trí</label>
                                                <input
                                                    type="text"
                                                    value={autoPosSuffix}
                                                    onChange={(e) => setAutoPosSuffix(e.target.value.toUpperCase())}
                                                    className="w-full px-2 py-1.5 border rounded text-xs font-mono uppercase bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-purple-500"
                                                    placeholder="V"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Số bắt đầu</label>
                                                <input
                                                    type="number"
                                                    value={posStart}
                                                    onChange={(e) => setPosStart(Math.max(0, parseInt(e.target.value) || 0))}
                                                    className="w-full px-2 py-1.5 border rounded text-xs text-center bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-purple-500"
                                                />
                                            </div>
                                        </div>

                                        {/* Pattern */}
                                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded p-2 border border-purple-200 dark:border-purple-800">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-medium text-purple-700 dark:text-purple-300">📋 Định dạng mã:</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setAutoPosPattern('')}
                                                    className="text-[10px] text-purple-500 hover:text-purple-700 underline"
                                                >
                                                    Reset
                                                </button>
                                            </div>
                                            {/* Editable pattern input */}
                                            <input
                                                type="text"
                                                value={autoPosPattern || `{zone}.${autoPosSuffix}{#}`}
                                                onChange={(e) => setAutoPosPattern(e.target.value.toUpperCase())}
                                                placeholder="{zone}.V{#}"
                                                className="w-full font-mono text-xs text-purple-800 dark:text-purple-200 bg-white dark:bg-gray-800 px-2 py-1 rounded border outline-none focus:ring-1 focus:ring-purple-500 mb-1"
                                            />
                                            <div className="text-[10px] text-purple-600 dark:text-purple-400 space-y-0.5">
                                                <p>
                                                    <code className="bg-purple-100 px-0.5 rounded">{'{zone}'}</code> = {(() => {
                                                        const firstLeaf = leafZones[0]
                                                        if (!firstLeaf) return 'đường dẫn đầy đủ'
                                                        return buildDefaultPrefix(firstLeaf.id).replace(/\.V$/, '')
                                                    })()}
                                                </p>
                                                <p>
                                                    Hoặc: {(() => {
                                                        const firstLeaf = leafZones[0]
                                                        if (!firstLeaf) return ''
                                                        const parts: string[] = []
                                                        let current: LocalZone | undefined = firstLeaf
                                                        while (current) {
                                                            if (current.code) {
                                                                const prefix = current.code.replace(/\d+/g, '').toUpperCase()
                                                                parts.unshift(`{${prefix}}=${current.code}`)
                                                            }
                                                            current = zones.find(z => z.id === current?.parent_id)
                                                        }
                                                        return parts.map((p, i) => (
                                                            <code key={i} className="bg-purple-100 px-0.5 rounded mx-0.5">{p}</code>
                                                        ))
                                                    })()}
                                                </p>
                                                <p><code className="bg-purple-100 px-0.5 rounded">{'{#}'}</code> = số vị trí ({posStart}→{posStart + posCount - 1})</p>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">
                                                Số lượng / zone
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="50"
                                                    value={posCount}
                                                    onChange={(e) => setPosCount(parseInt(e.target.value))}
                                                    className="flex-1 h-1.5 bg-purple-200 rounded appearance-none cursor-pointer"
                                                />
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="100"
                                                    value={posCount}
                                                    onChange={(e) => setPosCount(Math.max(1, parseInt(e.target.value) || 0))}
                                                    className="w-14 px-1 py-0.5 text-center font-bold text-sm text-purple-600 border rounded outline-none focus:ring-1 focus:ring-purple-500"
                                                />
                                            </div>
                                        </div>

                                        {/* Preview - showing first/middle/last across ALL positions */}
                                        <div className="bg-gray-100 dark:bg-gray-900 rounded p-2">
                                            <p className="text-[10px] font-medium text-gray-500 mb-1">
                                                🔍 Xem trước ({leafZones.length * posCount} mã):
                                            </p>
                                            <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                                                {leafZones.length > 0 && (() => {
                                                    const totalPositions = leafZones.length * posCount

                                                    // Helper to get position code for a specific global index (0-based)
                                                    const getPositionCode = (globalIdx: number) => {
                                                        const zoneIdx = Math.floor(globalIdx / posCount)
                                                        const posIdx = globalIdx % posCount
                                                        const zone = leafZones[Math.min(zoneIdx, leafZones.length - 1)]

                                                        // Build zone parts map
                                                        const zoneParts: Record<string, string> = {}
                                                        const zonePathParts: string[] = []
                                                        let current: LocalZone | undefined = zone
                                                        while (current) {
                                                            if (current.code) {
                                                                zonePathParts.unshift(current.code)
                                                                const prefix = current.code.replace(/\d+/g, '').toUpperCase()
                                                                zoneParts[prefix] = current.code
                                                            }
                                                            current = zones.find(z => z.id === current?.parent_id)
                                                        }
                                                        const zonePath = zonePathParts.join('.')

                                                        const pattern = autoPosPattern || `{zone}.${autoPosSuffix}{#}`

                                                        // Replace {#} with placeholder for position number
                                                        let code = pattern.replace(/\{#\}/g, '___POS_NUM___')
                                                        code = code.replace(/\{zone\}/gi, zonePath)

                                                        // Replace individual zone placeholders (sort by length to replace longer first)
                                                        const sortedPrefixes = Object.keys(zoneParts).sort((a, b) => b.length - a.length)
                                                        for (const prefix of sortedPrefixes) {
                                                            code = code.replace(new RegExp(`\\{${prefix}\\}`, 'gi'), zoneParts[prefix])
                                                        }

                                                        return code.replace(/___POS_NUM___/g, String(posStart + posIdx)).toUpperCase()
                                                    }

                                                    const firstCode = getPositionCode(0)
                                                    const middleCode = getPositionCode(Math.floor(totalPositions / 2))
                                                    const lastCode = getPositionCode(totalPositions - 1)

                                                    return (
                                                        <>
                                                            <span className="bg-white px-1.5 py-0.5 rounded text-green-600 border border-green-200" title="Mã đầu tiên">
                                                                🟢{firstCode}
                                                            </span>
                                                            {totalPositions > 2 && (
                                                                <>
                                                                    <span className="text-gray-400">...</span>
                                                                    <span className="bg-white px-1.5 py-0.5 rounded text-blue-600 border border-blue-200" title="Mã ở giữa">
                                                                        🔵{middleCode}
                                                                    </span>
                                                                    <span className="text-gray-400">...</span>
                                                                </>
                                                            )}
                                                            {totalPositions > 1 && (
                                                                <span className="bg-white px-1.5 py-0.5 rounded text-red-600 border border-red-200" title="Mã cuối cùng">
                                                                    🔴{lastCode}
                                                                </span>
                                                            )}
                                                        </>
                                                    )
                                                })()}
                                            </div>
                                        </div>

                                        {/* Leaf zones */}
                                        <div className="bg-gray-100 dark:bg-gray-900 rounded p-2 max-h-16 overflow-y-auto">
                                            <p className="text-[10px] font-medium text-gray-500 mb-1">📦 {leafZones.length} zone cuối:</p>
                                            <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                                                {leafZones.slice(0, 8).map((lz) => (
                                                    <span key={lz.id} className="bg-white px-1.5 py-0.5 rounded text-gray-600">
                                                        {lz.code}
                                                    </span>
                                                ))}
                                                {leafZones.length > 8 && (
                                                    <span className="text-gray-400">+{leafZones.length - 8}...</span>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleAutoCreatePositions}
                                            disabled={isCreatingPositions}
                                            className="w-full py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold text-sm rounded-lg shadow-md flex items-center justify-center gap-2"
                                        >
                                            {isCreatingPositions ? 'Đang xử lý...' : (
                                                <>
                                                    <Zap size={16} />
                                                    Tạo {leafZones.length * posCount} Vị Trí
                                                </>
                                            )}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div >
                )
            })()}
        </div >
    )
}
