export default function Footer() {
    return (
        <footer className="py-6 px-4 md:px-8 border-t border-stone-200 bg-white mt-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-sm text-stone-500 text-center md:text-left">
                    © {new Date().getFullYear()} <span className="font-semibold text-stone-700">AnyWarehouse</span>. All rights reserved.
                </p>
                <div className="flex items-center gap-4 md:gap-6 text-sm text-stone-500">
                    <a href="#" className="hover:text-orange-600 transition-colors">Hỗ trợ</a>
                    <a href="#" className="hover:text-orange-600 transition-colors">Điều khoản</a>
                    <span className="text-stone-300">|</span>
                    <span>Version 1.0.0</span>
                </div>
            </div>
        </footer>
    )
}
