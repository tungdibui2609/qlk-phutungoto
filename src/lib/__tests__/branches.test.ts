import { describe, it, expect } from 'vitest'
import { getBranchesOfCompany, getDefaultBranchName, BRANCH_FILTER_ALL } from '../branches'

const CHANH_THU = 'b503014d-19b6-464e-91f3-f34eba4b4b05'
const SARITA = '1a82b359-3c58-4929-ae3b-5345324af19e'

const branches = [
    { id: '1', name: "CN Cư M'gar", code: 'CN001', is_default: true, company_id: CHANH_THU },
    { id: '2', name: 'CN Cư Knap', code: 'CN002', is_default: false, company_id: CHANH_THU },
    { id: '3', name: 'Chi Nhánh Sarita', code: 'CN-SR', is_default: true, company_id: SARITA },
    { id: '4', name: 'Kho Mặc Định', code: 'DEFAULT', is_default: false, company_id: null }
]

describe('getBranchesOfCompany', () => {
    it('chi nhánh là cấp công ty: mọi kho của công ty đều thấy toàn bộ chi nhánh', () => {
        expect(getBranchesOfCompany(branches, CHANH_THU).map(b => b.name))
            .toEqual(["CN Cư M'gar", 'CN Cư Knap'])
    })

    it('không lộ chi nhánh của công ty khác (multi-tenant)', () => {
        expect(getBranchesOfCompany(branches, SARITA).map(b => b.name)).toEqual(['Chi Nhánh Sarita'])
        expect(getBranchesOfCompany(branches, 'company-khong-ton-tai')).toEqual([])
    })

    it('công ty chưa khai báo chi nhánh → rỗng để không ép bắt buộc', () => {
        expect(getBranchesOfCompany(branches, 'company-khong-ton-tai')).toEqual([])
        expect(getBranchesOfCompany(null, CHANH_THU)).toEqual([])
    })

    it('tài khoản chưa gắn công ty (superadmin) → giữ toàn bộ danh sách như hành vi cũ', () => {
        expect(getBranchesOfCompany(branches, null)).toHaveLength(4)
    })

    it('bỏ qua dòng chi nhánh không có tên', () => {
        const withBlank = [{ id: '9', name: null, company_id: CHANH_THU }, ...branches]
        expect(getBranchesOfCompany(withBlank, CHANH_THU).map(b => b.name)).toEqual(["CN Cư M'gar", 'CN Cư Knap'])
    })
})

describe('getDefaultBranchName', () => {
    it('ưu tiên chi nhánh is_default của công ty đang đăng nhập', () => {
        expect(getDefaultBranchName(branches, CHANH_THU)).toBe("CN Cư M'gar")
    })

    it('không có chi nhánh → chuỗi rỗng để bộ lọc giữ giá trị "all"', () => {
        expect(getDefaultBranchName(branches, 'company-khong-ton-tai') || BRANCH_FILTER_ALL)
            .toBe(BRANCH_FILTER_ALL)
    })
})
