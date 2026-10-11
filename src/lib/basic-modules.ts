import { PRODUCT_MODULES } from './product-modules'
import { INBOUND_MODULES, OUTBOUND_MODULES } from './order-modules'
import { LOT_MODULES } from './lot-modules'
import { DASHBOARD_MODULES } from './dashboard-modules'
import { UTILITY_MODULES } from './utility-modules'
import { PRINT_MODULES } from './print-modules'
import { QR_MODULES } from './qr-modules'
import { REPORT_MODULES } from './report-modules'

/**
 * Aggregates all module IDs that are marked as 'is_basic'
 * These modules are always enabled for all companies.
 */
export const BASIC_MODULE_IDS = [
    ...PRODUCT_MODULES.filter(m => m.is_basic).map(m => m.id),
    ...INBOUND_MODULES.filter(m => m.is_basic).map(m => m.id),
    ...OUTBOUND_MODULES.filter(m => m.is_basic).map(m => m.id),
    ...LOT_MODULES.filter(m => m.is_basic).map(m => m.id),
    ...DASHBOARD_MODULES.filter(m => m.is_basic).map(m => m.id),
    ...UTILITY_MODULES.filter(m => m.is_basic).map(m => m.id),
    ...PRINT_MODULES.filter(m => m.is_basic).map(m => m.id),
    ...QR_MODULES.filter(m => m.is_basic).map(m => m.id),
    ...REPORT_MODULES.filter(m => m.is_basic).map(m => m.id)
]

export function isBasicModule(moduleId: string): boolean {
    return BASIC_MODULE_IDS.includes(moduleId)
}
