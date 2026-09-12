import { describe, it, expect } from 'vitest'
import {
    extractInlineImages,
    extractInlineImageUrls,
    formatTaskContentPreview,
    getCardContentPreview,
    parseContentWithInlineImages,
    removeInlineImageFromContent,
    markdownToDisplayText,
    displayTextToMarkdown,
    getOptimizedThumbnailUrl,
    getHighResImageUrl,
} from '../taskContentUtils'

describe('taskContentUtils', () => {
    const sampleContent = `xử lý cái đống này
![Khay xoài dãy B](https://res.cloudinary.com/demo/image/upload/sample.jpg)
làm xong chụp hình báo cáo lại
![Ảnh máy sấy](https://res.cloudinary.com/demo/image/upload/machine.jpg)`

    it('extracts inline images with alt text and url', () => {
        const images = extractInlineImages(sampleContent)
        expect(images).toHaveLength(2)
        expect(images[0].alt).toBe('Khay xoài dãy B')
        expect(images[0].url).toBe('https://res.cloudinary.com/demo/image/upload/sample.jpg')
        expect(images[1].alt).toBe('Ảnh máy sấy')
        expect(images[1].url).toBe('https://res.cloudinary.com/demo/image/upload/machine.jpg')
    })

    it('extracts inline image URLs array', () => {
        const urls = extractInlineImageUrls(sampleContent)
        expect(urls).toEqual([
            'https://res.cloudinary.com/demo/image/upload/sample.jpg',
            'https://res.cloudinary.com/demo/image/upload/machine.jpg',
        ])
    })

    it('formats preview replacing markdown with readable badge', () => {
        const preview = formatTaskContentPreview(sampleContent)
        expect(preview).toContain('[📷 Khay xoài dãy B]')
        expect(preview).toContain('[📷 Ảnh máy sấy]')
        expect(preview).not.toContain('https://res.cloudinary.com')
    })

    it('formats preview replacing raw file hashes with friendly label', () => {
        const rawContent = 'kiểm kho ![480247291_9233257653455378_612](https://res.cloudinary.com/demo/sample.jpg)'
        const preview = formatTaskContentPreview(rawContent)
        expect(preview).toBe('kiểm kho [📷 Hình ảnh]')
    })

    it('strips image markdown and tags completely for clean card preview', () => {
        const rawContent = 'kiểm kho ![480247291_9233257653455378_612](https://res.cloudinary.com/demo/sample.jpg)'
        const cardPreview = getCardContentPreview(rawContent)
        expect(cardPreview).toBe('kiểm kho')

        const multiContent = `kiểm kho hàng
[📷 Ảnh 1]
nhớ kiểm tra kệ A`
        expect(getCardContentPreview(multiContent)).toBe('kiểm kho hàng nhớ kiểm tra kệ A')

        const imageOnly = '![Ảnh](https://res.cloudinary.com/demo/sample.jpg)'
        expect(getCardContentPreview(imageOnly)).toBe('')
    })

    it('parses content into alternating text and image segments', () => {
        const segments = parseContentWithInlineImages(sampleContent)
        expect(segments.length).toBeGreaterThanOrEqual(3)
        expect(segments[0].type).toBe('text')
        expect((segments[0] as any).text).toContain('xử lý cái đống này')
        expect(segments[1].type).toBe('image')
        expect((segments[1] as any).url).toBe('https://res.cloudinary.com/demo/image/upload/sample.jpg')
    })

    it('removes inline image by URL cleanly', () => {
        const updated = removeInlineImageFromContent(
            sampleContent,
            'https://res.cloudinary.com/demo/image/upload/sample.jpg'
        )
        expect(updated).not.toContain('https://res.cloudinary.com/demo/image/upload/sample.jpg')
        expect(updated).toContain('https://res.cloudinary.com/demo/image/upload/machine.jpg')
        expect(updated).toContain('xử lý cái đống này')
    })

    it('converts markdown with long URLs into clean display tags like [📷 Ảnh 1]', () => {
        const { displayText, entries } = markdownToDisplayText(sampleContent)
        expect(displayText).toContain('[📷 Ảnh 1]')
        expect(displayText).toContain('[📷 Ảnh 2]')
        expect(displayText).not.toContain('https://res.cloudinary.com')
        expect(entries).toHaveLength(2)
        expect(entries[0].id).toBe(1)
        expect(entries[0].url).toBe('https://res.cloudinary.com/demo/image/upload/sample.jpg')
    })

    it('converts display tags back to markdown with original URLs', () => {
        const { displayText, entries } = markdownToDisplayText(sampleContent)
        const reconstructed = displayTextToMarkdown(displayText, entries)
        expect(reconstructed).toContain('![Khay xoài dãy B](https://res.cloudinary.com/demo/image/upload/sample.jpg)')
        expect(reconstructed).toContain('![Ảnh máy sấy](https://res.cloudinary.com/demo/image/upload/machine.jpg)')
    })

    it('generates lightweight thumbnail URL for Google Drive and Cloudinary', () => {
        const driveUrl = 'https://drive.google.com/thumbnail?id=abc123xyz&sz=w1000'
        const thumb = getOptimizedThumbnailUrl(driveUrl, 480)
        expect(thumb).toBe('https://drive.google.com/thumbnail?id=abc123xyz&sz=w480')

        const driveUcUrl = 'https://drive.google.com/uc?id=abc123xyz'
        const ucThumb = getOptimizedThumbnailUrl(driveUcUrl, 480)
        expect(ucThumb).toBe('https://drive.google.com/thumbnail?id=abc123xyz&sz=w480')

        const highRes = getHighResImageUrl(driveUrl, 1600)
        expect(highRes).toBe('https://drive.google.com/thumbnail?id=abc123xyz&sz=w1600')
    })

    it('matches all teams when task is assigned to Toàn bộ', async () => {
        const { isTaskAssignedToTeam } = await import('../taskUtils')
        const broadcastTask = { target_shifts: ['Toàn bộ'], target_shift: 'Toàn bộ' }
        expect(isTaskAssignedToTeam(broadcastTask, 'Ghép kho')).toBe(true)
        expect(isTaskAssignedToTeam(broadcastTask, 'Đội Thống kê')).toBe(true)
        expect(isTaskAssignedToTeam(broadcastTask, 'Xe nâng cao')).toBe(true)
    })

    it('never leaks raw data:image url into text segments when parsing markdown image with fallbackImages', () => {
        const base64Img = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/test123456789'
        const contentWithBase64 = `thư máy\n\n![Ảnh 1](${base64Img})\n\nlàm xong chụp hình lại`
        const fallbackImages = [base64Img]

        const segments = parseContentWithInlineImages(contentWithBase64, fallbackImages)
        expect(segments).toHaveLength(3)
        expect(segments[0].type).toBe('text')
        expect((segments[0] as any).text.trim()).toBe('thư máy')

        expect(segments[1].type).toBe('image')
        expect((segments[1] as any).alt).toBe('Ảnh 1')
        expect((segments[1] as any).url).toBe(base64Img)

        expect(segments[2].type).toBe('text')
        expect((segments[2] as any).text.trim()).toBe('làm xong chụp hình lại')
        // Tuyệt đối không được chứa chuỗi data:image trong text
        expect((segments[2] as any).text).not.toContain('data:image')
    })

    it('strips any leaked raw data:image or parentheses url from text', () => {
        const rawTextWithLeak = '(data:image/jpeg;base64,/9j/4AAQSkZJRg==)\n\nlàm xong chụp hình lại'
        const cleaned = getCardContentPreview(rawTextWithLeak)
        expect(cleaned).toBe('làm xong chụp hình lại')
        expect(cleaned).not.toContain('data:image')
    })

    it('applies text color and font size to selected text correctly', async () => {
        const { applyStyleToSelectedText } = await import('../taskContentUtils')
        const originalText = 'Không được ghép hàng tem vàng với tem đỏ'

        // 1. Áp dụng màu đỏ cho đoạn bôi đen
        const redResult = applyStyleToSelectedText(originalText, 0, originalText.length, {
            color: '#dc2626',
        })
        expect(redResult.newText).toBe('<span style="color:#dc2626">Không được ghép hàng tem vàng với tem đỏ</span>')

        // 2. Áp dụng cỡ chữ to tiếp theo
        const sizeResult = applyStyleToSelectedText(redResult.newText, 0, redResult.newText.length, {
            fontSize: '1.25em',
        })
        expect(sizeResult.newText).toContain('color:#dc2626')
        expect(sizeResult.newText).toContain('font-size:1.25em')

        // 3. Xóa định dạng
        const clearResult = applyStyleToSelectedText(sizeResult.newText, 0, sizeResult.newText.length, {
            clear: true,
        })
        expect(clearResult.newText).toBe(originalText)
    })

    it('renders safe rich text html with styled color and font size', async () => {
        const { formatRichTextToHtml } = await import('../taskContentUtils')
        const input = '<span style="color:#dc2626;font-size:1.18em">Không được ghép hàng</span>\n<script>alert(1)</script>'
        const html = formatRichTextToHtml(input)
        expect(html).toContain('<span style="color:#dc2626;font-size:1.18em">Không được ghép hàng</span>')
        // Tuyệt đối không cho phép script
        expect(html).not.toContain('<script>')
        expect(html).not.toContain('alert(1)')
    })
})


