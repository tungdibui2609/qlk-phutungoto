import { parseISO, format, startOfDay } from 'date-fns'

const dateStr = "2026-05-16T08:52"
try {
    const parsed = parseISO(dateStr)
    console.log('Parsed Date:', parsed.toISOString())
} catch (e) {
    console.error('Error parsing date:', e)
}

const dateStrSimple = "2026-05-16"
try {
    const parsed = startOfDay(parseISO(dateStrSimple))
    console.log('Parsed Simple Date:', parsed.toISOString())
} catch (e) {
    console.error('Error parsing simple date:', e)
}
