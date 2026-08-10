#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
====================================================================
  MODULAR WMS - 1-CLICK SERVER LAUNCHER & MANAGER
  Biến Laptop / Máy tính thành Server chỉ với 1 Click!
  Hỗ trợ: Chế độ Production (Tối ưu tốc độ cao) & Development
  Tự động: Docker Desktop -> Supabase Local -> Next.js -> Cloudflare Tunnel
====================================================================
"""

import os
import sys
import time
import socket
import threading
import subprocess
import webbrowser
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
from pathlib import Path

# --- CẤU HÌNH HỆ THỐNG ---
PROJECT_DIR = Path(r"d:\chanh thu\web")
TUNNEL_ID = "9df90c7f-63cf-4ac9-87f1-f615c0292e4d"
CLOUDFLARED_CONFIG = Path(os.path.expanduser(r"~\.cloudflared\config.yml"))

DOCKER_PATHS = [
    Path(os.path.expanduser(r"~\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe")),
    Path(r"C:\Program Files\Docker\Docker\Docker Desktop.exe"),
]

PORTS = {
    "nextjs": 3000,
    "supabase_api": 64321,
    "supabase_db": 64322,
    "supabase_studio": 64323,
    "supabase_mail": 64324,
}

URLS = {
    "web_local": f"http://localhost:{PORTS['nextjs']}",
    "studio_local": f"http://localhost:{PORTS['supabase_studio']}",
    "mail_local": f"http://localhost:{PORTS['supabase_mail']}",
    "domain_chanhthu": "https://www.chanhthu.click",
    "domain_sarita": "https://sarita.click",
}


def is_port_open(port: int, host: str = "127.0.0.1", timeout: float = 0.6) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(timeout)
            return s.connect_ex((host, port)) == 0
    except Exception:
        return False


def is_docker_ready() -> bool:
    try:
        res = subprocess.run(
            ["docker", "info"],
            capture_output=True,
            text=True,
            timeout=3,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        )
        return res.returncode == 0
    except Exception:
        return False


class ServerManagerGUI:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Modular WMS - Server Controller (Production Ready)")
        self.root.geometry("880x720")
        self.root.minsize(800, 600)
        self.root.configure(bg="#0f172a")

        self.proc_nextjs = None
        self.proc_tunnel = None
        self.is_starting_all = False
        self.is_stopping_all = False
        self.is_building = False
        self.running_loop = True

        # Chế độ chạy: 'prod' hoặc 'dev' (Mặc định là 'prod' theo yêu cầu người dùng)
        self.run_mode = tk.StringVar(value="prod")

        self._setup_styles()
        self._build_ui()

        self.status_thread = threading.Thread(target=self._monitor_services_loop, daemon=True)
        self.status_thread.start()

        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    def _setup_styles(self):
        style = ttk.Style()
        style.theme_use("clam")

        style.configure(".", background="#0f172a", foreground="#f8fafc", font=("Segoe UI", 10))
        style.configure("TFrame", background="#0f172a")
        style.configure("Card.TFrame", background="#1e293b", relief="flat")
        style.configure("TRadiobutton", background="#1e293b", foreground="#f8fafc", font=("Segoe UI", 9, "bold"))
        style.map("TRadiobutton", background=[("active", "#1e293b")])

        style.configure(
            "Primary.TButton",
            background="#2563eb",
            foreground="#ffffff",
            font=("Segoe UI", 11, "bold"),
            padding=8,
            borderwidth=0
        )
        style.map("Primary.TButton", background=[("active", "#1d4ed8"), ("disabled", "#475569")])

        style.configure(
            "Danger.TButton",
            background="#dc2626",
            foreground="#ffffff",
            font=("Segoe UI", 11, "bold"),
            padding=8,
            borderwidth=0
        )
        style.map("Danger.TButton", background=[("active", "#b91c1c"), ("disabled", "#475569")])

        style.configure(
            "Success.TButton",
            background="#059669",
            foreground="#ffffff",
            font=("Segoe UI", 9, "bold"),
            padding=5,
            borderwidth=0
        )
        style.map("Success.TButton", background=[("active", "#047857")])

        style.configure(
            "Backup.TButton",
            background="#0284c7",
            foreground="#ffffff",
            font=("Segoe UI", 9, "bold"),
            padding=5,
            borderwidth=0
        )
        style.map("Backup.TButton", background=[("active", "#0369a1"), ("disabled", "#475569")])

        style.configure(
            "Link.TButton",
            background="#334155",
            foreground="#38bdf8",
            font=("Segoe UI", 9, "bold"),
            padding=5,
            borderwidth=0
        )
        style.map("Link.TButton", background=[("active", "#475569")])

    def _build_ui(self):
        # 1. HEADER
        header_frame = tk.Frame(self.root, bg="#1e293b", height=70, padx=20, pady=12)
        header_frame.pack(fill=tk.X, side=tk.TOP)

        title_lbl = tk.Label(
            header_frame,
            text="⚡ MODULAR WMS - 1-CLICK PRODUCTION SERVER LAUNCHER",
            font=("Segoe UI", 14, "bold"),
            fg="#38bdf8",
            bg="#1e293b"
        )
        title_lbl.pack(anchor="w")

        subtitle_lbl = tk.Label(
            header_frame,
            text="Biến Laptop thành Server Production tốc độ cao & Online qua Cloudflare Tunnel chỉ với 1 Click",
            font=("Segoe UI", 9),
            fg="#94a3b8",
            bg="#1e293b"
        )
        subtitle_lbl.pack(anchor="w")

        # 2. MAIN CONTAINER
        main_container = tk.Frame(self.root, bg="#0f172a", padx=16, pady=12)
        main_container.pack(fill=tk.BOTH, expand=True)

        # 2.1 BẢNG ĐIỀU KHIỂN & CHỌN CHẾ ĐỘ
        top_grid = tk.Frame(main_container, bg="#0f172a")
        top_grid.pack(fill=tk.X, pady=(0, 10))

        # Cột trái: Điều khiển & Chế độ chạy
        actions_card = tk.Frame(top_grid, bg="#1e293b", padx=14, pady=12, highlightthickness=1, highlightbackground="#334155")
        actions_card.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 8))

        tk.Label(actions_card, text="🎮 ĐIỀU KHIỂN HỆ THỐNG", font=("Segoe UI", 10, "bold"), fg="#f1f5f9", bg="#1e293b").pack(anchor="w", pady=(0, 6))

        # Chọn chế độ: Production vs Dev
        mode_box = tk.Frame(actions_card, bg="#1e293b")
        mode_box.pack(fill=tk.X, pady=(0, 6))
        tk.Label(mode_box, text="Chế độ:", font=("Segoe UI", 9), fg="#94a3b8", bg="#1e293b").pack(side=tk.LEFT, padx=(0, 6))
        ttk.Radiobutton(mode_box, text="⚡ Production (Siêu mượt)", variable=self.run_mode, value="prod").pack(side=tk.LEFT, padx=(0, 8))
        ttk.Radiobutton(mode_box, text="🛠️ Dev", variable=self.run_mode, value="dev").pack(side=tk.LEFT)

        btn_box = tk.Frame(actions_card, bg="#1e293b")
        btn_box.pack(fill=tk.X, pady=2)

        self.btn_start_all = ttk.Button(btn_box, text="🚀 KHỞI ĐỘNG TẤT CẢ (1-CLICK)", style="Primary.TButton", command=self.start_all_services)
        self.btn_start_all.pack(fill=tk.X, pady=(0, 6))

        btn_sub_row = tk.Frame(btn_box, bg="#1e293b")
        btn_sub_row.pack(fill=tk.X)

        self.btn_stop_all = ttk.Button(btn_sub_row, text="🛑 DỪNG TẤT CẢ", style="Danger.TButton", command=self.stop_all_services)
        self.btn_stop_all.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 4))

        self.btn_build = ttk.Button(btn_sub_row, text="🔨 Build Lại Web", style="Success.TButton", command=self.build_production)
        self.btn_build.pack(side=tk.RIGHT, fill=tk.X, expand=True, padx=(4, 0))

        btn_backup_row = tk.Frame(btn_box, bg="#1e293b")
        btn_backup_row.pack(fill=tk.X, pady=(6, 0))

        self.btn_backup = ttk.Button(btn_backup_row, text="💾 SAO LƯU DỮ LIỆU", style="Backup.TButton", command=self.backup_database)
        self.btn_backup.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 4))

        self.btn_open_backup = ttk.Button(btn_backup_row, text="📂 Xem Thư Mục Backup", style="Link.TButton", command=self.open_backup_folder)
        self.btn_open_backup.pack(side=tk.RIGHT, fill=tk.X, expand=True, padx=(4, 0))

        # Cột phải: Bảng trạng thái dịch vụ (Status Dashboard)
        status_card = tk.Frame(top_grid, bg="#1e293b", padx=14, pady=12, highlightthickness=1, highlightbackground="#334155")
        status_card.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(8, 0))

        tk.Label(status_card, text="📊 TRẠNG THÁI DỊCH VỤ", font=("Segoe UI", 10, "bold"), fg="#f1f5f9", bg="#1e293b").pack(anchor="w", pady=(0, 6))

        self.status_labels = {}
        services = [
            ("docker", "🐳 Docker Desktop Engine"),
            ("supabase", "🗄️ Supabase Local (DB & API :64321)"),
            ("nextjs", "🌐 Next.js Web App (:3000)"),
            ("tunnel", "🚇 Cloudflare Tunnel (Online)"),
        ]

        for key, name in services:
            row = tk.Frame(status_card, bg="#1e293b")
            row.pack(fill=tk.X, pady=2)
            lbl_name = tk.Label(row, text=name, font=("Segoe UI", 9), fg="#cbd5e1", bg="#1e293b")
            lbl_name.pack(side=tk.LEFT)
            lbl_val = tk.Label(row, text="● Đang kiểm tra...", font=("Segoe UI", 9, "bold"), fg="#94a3b8", bg="#1e293b")
            lbl_val.pack(side=tk.RIGHT)
            self.status_labels[key] = lbl_val

        # 2.2 THANH PHÍM TẮT TRUY CẬP NHANH (QUICK ACCESS LINKS)
        links_card = tk.Frame(main_container, bg="#1e293b", padx=14, pady=10, highlightthickness=1, highlightbackground="#334155")
        links_card.pack(fill=tk.X, pady=(0, 10))

        tk.Label(links_card, text="🔗 TRUY CẬP NHANH TRÊN TRÌNH DUYỆT", font=("Segoe UI", 9, "bold"), fg="#94a3b8", bg="#1e293b").pack(anchor="w", pady=(0, 6))

        links_row = tk.Frame(links_card, bg="#1e293b")
        links_row.pack(fill=tk.X)

        ttk.Button(links_row, text="🌐 Web Local (:3000)", style="Link.TButton", command=lambda: webbrowser.open(URLS["web_local"])).pack(side=tk.LEFT, padx=(0, 6))
        ttk.Button(links_row, text="🗄️ Supabase Studio", style="Link.TButton", command=lambda: webbrowser.open(URLS["studio_local"])).pack(side=tk.LEFT, padx=(0, 6))
        ttk.Button(links_row, text="🌍 chanhthu.click", style="Link.TButton", command=lambda: webbrowser.open(URLS["domain_chanhthu"])).pack(side=tk.LEFT, padx=(0, 6))
        ttk.Button(links_row, text="🌍 sarita.click", style="Link.TButton", command=lambda: webbrowser.open(URLS["domain_sarita"])).pack(side=tk.LEFT, padx=(0, 6))
        ttk.Button(links_row, text="📧 Test Mailpit", style="Link.TButton", command=lambda: webbrowser.open(URLS["mail_local"])).pack(side=tk.LEFT)

        # 2.3 KHUNG NHẬT KÝ (LOG VIEWER)
        logs_card = tk.Frame(main_container, bg="#1e293b", padx=14, pady=10, highlightthickness=1, highlightbackground="#334155")
        logs_card.pack(fill=tk.BOTH, expand=True)

        log_head = tk.Frame(logs_card, bg="#1e293b")
        log_head.pack(fill=tk.X, pady=(0, 4))
        tk.Label(log_head, text="📜 NHẬT KÝ HOẠT ĐỘNG (REALTIME LOGS)", font=("Segoe UI", 9, "bold"), fg="#94a3b8", bg="#1e293b").pack(side=tk.LEFT)
        ttk.Button(log_head, text="🧹 Xóa nhật ký", style="Link.TButton", command=self.clear_logs).pack(side=tk.RIGHT)

        self.log_text = scrolledtext.ScrolledText(
            logs_card,
            bg="#0b0f19",
            fg="#e2e8f0",
            font=("Consolas", 9),
            relief="flat",
            padx=8,
            pady=6
        )
        self.log_text.pack(fill=tk.BOTH, expand=True)

        self.log("ℹ️ Trình quản lý Server đã sẵn sàng ở chế độ [⚡ PRODUCTION].")

    def log(self, message: str):
        timestamp = time.strftime("%H:%M:%S")
        formatted = f"[{timestamp}] {message}\n"
        self.root.after(0, self._append_log_text, formatted)

    def _append_log_text(self, text: str):
        self.log_text.insert(tk.END, text)
        self.log_text.see(tk.END)

    def clear_logs(self):
        self.log_text.delete("1.0", tk.END)

    def _update_status_ui(self, key: str, is_running: bool, running_text="● ĐANG CHẠY", stopped_text="○ ĐÃ DỪNG"):
        color = "#22c55e" if is_running else "#ef4444"
        text = running_text if is_running else stopped_text
        if key in self.status_labels:
            self.status_labels[key].configure(text=text, fg=color)

    def _monitor_services_loop(self):
        while self.running_loop:
            docker_ok = is_docker_ready()
            self.root.after(0, self._update_status_ui, "docker", docker_ok, "● HOẠT ĐỘNG", "○ TẮT")

            supabase_ok = is_port_open(PORTS["supabase_api"]) and is_port_open(PORTS["supabase_studio"])
            self.root.after(0, self._update_status_ui, "supabase", supabase_ok, "● HOẠT ĐỘNG", "○ TẮT")

            nextjs_ok = is_port_open(PORTS["nextjs"])
            self.root.after(0, self._update_status_ui, "nextjs", nextjs_ok, "● HOẠT ĐỘNG", "○ TẮT")

            tunnel_ok = (self.proc_tunnel is not None and self.proc_tunnel.poll() is None)
            self.root.after(0, self._update_status_ui, "tunnel", tunnel_ok, "● KẾT NỐI", "○ TẮT")

            time.sleep(2.5)

    def build_production(self):
        """Build lại bản production Next.js"""
        if self.is_building:
            return
        self.is_building = True
        self.btn_build.configure(state="disabled")
        threading.Thread(target=self._build_production_worker, daemon=True).start()

    def _build_production_worker(self):
        self.log("🔨 Đang tiến hành Build Production (npm run build)... Vui lòng chờ!")
        try:
            res = subprocess.run(
                "cmd.exe /c npm.cmd run build",
                cwd=str(PROJECT_DIR),
                shell=True,
                capture_output=True,
                text=True,
                timeout=180
            )
            if res.returncode == 0:
                self.log("✅ Build Production thành công 100%! Các trang đã được tối ưu hóa.")
            else:
                self.log(f"⚠️ Kết quả Build: {res.stdout or res.stderr}")
        except Exception as e:
            self.log(f"❌ Lỗi khi Build: {e}")
        finally:
            self.is_building = False
            self.root.after(0, lambda: self.btn_build.configure(state="normal"))

    def open_backup_folder(self):
        """Mở thư mục chứa file backup trên Windows Explorer"""
        backup_dir = Path(r"D:\chanh thu\backups")
        backup_dir.mkdir(parents=True, exist_ok=True)
        if sys.platform == "win32":
            os.startfile(str(backup_dir))
        self.log(f"📂 Đã mở thư mục sao lưu: {backup_dir}")

    def backup_database(self):
        """Sao lưu nhanh toàn bộ dữ liệu Supabase Database Local ra file .sql"""
        if getattr(self, "is_backing_up", False):
            return
        self.is_backing_up = True
        self.btn_backup.configure(state="disabled")
        threading.Thread(target=self._backup_database_worker, daemon=True).start()

    def _backup_database_worker(self):
        self.log("💾 ================= BẮT ĐẦU SAO LƯU DỮ LIỆU CSDL =================")
        try:
            backup_dir = Path(r"D:\chanh thu\backups")
            backup_dir.mkdir(parents=True, exist_ok=True)

            timestamp = time.strftime("%Y%m%d_%H%M%S")
            backup_file = backup_dir / f"backup_supabase_{timestamp}.sql"

            self.log(f"📦 Đang xuất dữ liệu từ Supabase Local ra: {backup_file.name}...")

            cmd = f'cmd.exe /c npx.cmd supabase db dump --local --data-only -f "{str(backup_file)}"'
            res = subprocess.run(
                cmd,
                cwd=str(PROJECT_DIR),
                shell=True,
                capture_output=True,
                text=True,
                timeout=120
            )

            if res.returncode == 0 and backup_file.exists() and backup_file.stat().st_size > 0:
                file_size_kb = round(backup_file.stat().st_size / 1024, 2)
                self.log(f"✅ Sao lưu CSDL THÀNH CÔNG! Dung lượng: {file_size_kb} KB")
                self.log(f"📁 File đã lưu tại: {str(backup_file)}")
                self.root.after(0, lambda: messagebox.showinfo(
                    "Sao Lưu Thành Công",
                    f"Đã sao lưu toàn bộ dữ liệu CSDL thành công!\n\nFile: {backup_file.name} ({file_size_kb} KB)\nThư mục: {str(backup_dir)}"
                ))
            else:
                err_msg = res.stderr or res.stdout or "Không xuất được file"
                self.log(f"❌ Lỗi khi sao lưu: {err_msg}")
                self.root.after(0, lambda: messagebox.showerror("Lỗi Sao Lưu", f"Không thể sao lưu dữ liệu:\n{err_msg}"))
        except Exception as e:
            self.log(f"❌ Ngoại lệ khi sao lưu: {e}")
            self.root.after(0, lambda: messagebox.showerror("Lỗi Ngoại Lệ", f"Lỗi: {e}"))
        finally:
            self.is_backing_up = False
            self.root.after(0, lambda: self.btn_backup.configure(state="normal"))

    def start_all_services(self):
        if self.is_starting_all:
            return
        self.is_starting_all = True
        self.btn_start_all.configure(state="disabled")
        threading.Thread(target=self._start_all_worker, daemon=True).start()

    def _start_all_worker(self):
        mode = self.run_mode.get()
        mode_name = "⚡ PRODUCTION (TỐI ƯU CAO)" if mode == "prod" else "🛠️ DEVELOPMENT (LẬP TRÌNH)"
        self.log(f"🚀 ================= BẮT ĐẦU KHỞI ĐỘNG HỆ THỐNG [{mode_name}] =================")

        # 1. DOCKER
        self.log("1️⃣ [Docker] Đang kiểm tra Docker Desktop Engine...")
        if not is_docker_ready():
            self.log("🐳 Docker chưa chạy. Đang tự động mở Docker Desktop...")
            opened = False
            for p in DOCKER_PATHS:
                if p.exists():
                    subprocess.Popen([str(p)], shell=True)
                    opened = True
                    break
            if not opened:
                subprocess.Popen(["start", "", "docker-desktop"], shell=True)

            self.log("⏳ Đang đợi Docker Engine khởi động hoàn tất...")
            retries = 0
            while not is_docker_ready() and retries < 40:
                time.sleep(2)
                retries += 1

            if not is_docker_ready():
                self.log("❌ Lỗi: Docker Desktop không thể khởi động. Vui lòng mở thủ công!")
                self._finish_start_all()
                return

        self.log("✅ Docker Engine đã sẵn sàng 100%!")

        # 2. SUPABASE LOCAL
        self.log("2️⃣ [Supabase] Đang kiểm tra CSDL Supabase Local...")
        if not (is_port_open(PORTS["supabase_api"]) and is_port_open(PORTS["supabase_studio"])):
            self.log("📦 Đang khởi động các container Supabase (Postgres, Studio, Auth)...")
            try:
                cmd = "cmd.exe /c npx.cmd supabase start"
                res = subprocess.run(
                    cmd,
                    cwd=str(PROJECT_DIR),
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=90
                )
                if res.returncode == 0:
                    self.log("✅ Supabase Local đã khởi động thành công!")
                else:
                    self.log(f"⚠️ Supabase Output: {res.stdout or res.stderr}")
            except Exception as e:
                self.log(f"❌ Lỗi Supabase: {e}")
        else:
            self.log("✅ Supabase Local đã đang chạy sẵn.")

        # 3. NEXT.JS WEB APP
        self.log(f"3️⃣ [Next.js] Đang khởi chạy Web App ({mode_name})...")
        if is_port_open(PORTS["nextjs"]):
            self.log("ℹ️ Đang giải phóng cổng 3000 cũ để áp dụng phiên bản mới...")
            try:
                subprocess.run("taskkill /F /IM node.exe /T", shell=True, capture_output=True)
                time.sleep(1.5)
            except Exception:
                pass

        try:
            if mode == "prod":
                # Kiểm tra nếu chưa build thì build trước
                dot_next = PROJECT_DIR / ".next"
                if not dot_next.exists():
                    self.log("🔨 Chưa tìm thấy bản build. Đang tự động build lần đầu...")
                    subprocess.run("cmd.exe /c npm.cmd run build", cwd=str(PROJECT_DIR), shell=True, capture_output=True, timeout=180)

                cmd_start = "cmd.exe /c npm.cmd run start"
                self.log("⚡ Đang khởi động Next.js Production Server (npm run start)...")
            else:
                cmd_start = "cmd.exe /c npm.cmd run dev"
                self.log("🛠️ Đang khởi động Next.js Dev Server (npm run dev)...")

            self.proc_nextjs = subprocess.Popen(
                cmd_start,
                cwd=str(PROJECT_DIR),
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            )
            threading.Thread(target=self._stream_proc_logs, args=(self.proc_nextjs, "[Next.js]"), daemon=True).start()

            for _ in range(25):
                if is_port_open(PORTS["nextjs"]):
                    break
                time.sleep(1)

            if is_port_open(PORTS["nextjs"]):
                self.log("✅ Next.js Web App đã online tại http://localhost:3000!")
            else:
                self.log("⚠️ Next.js đang khởi chạy ngầm...")
        except Exception as e:
            self.log(f"❌ Lỗi khởi động Next.js: {e}")

        # 4. CLOUDFLARE TUNNEL
        self.log("4️⃣ [Tunnel] Đang kiểm tra Cloudflare Tunnel...")
        if self.proc_tunnel is None or self.proc_tunnel.poll() is not None:
            try:
                tunnel_cmd = f"cloudflared.exe tunnel run {TUNNEL_ID}"
                self.proc_tunnel = subprocess.Popen(
                    tunnel_cmd,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
                )
                threading.Thread(target=self._stream_proc_logs, args=(self.proc_tunnel, "[Tunnel]"), daemon=True).start()
                self.log("✅ Cloudflare Tunnel đã kết nối! chanhthu.click & sarita.click đã sẵn sàng!")
            except Exception as e:
                self.log(f"❌ Lỗi Tunnel: {e}")
        else:
            self.log("✅ Cloudflare Tunnel đã đang chạy.")

        self.log("🎉 ================= HỆ THỐNG PRODUCTION ĐÃ SẴN SÀNG =================")
        self.log(f"🌐 Truy cập nội bộ: {URLS['web_local']}")
        self.log(f"🌍 Truy cập công khai: {URLS['domain_chanhthu']} | {URLS['domain_sarita']}")
        self.log(f"🗄️ Quản trị Database Studio: {URLS['studio_local']}")

        self._finish_start_all()

    def _finish_start_all(self):
        self.is_starting_all = False
        self.root.after(0, lambda: self.btn_start_all.configure(state="normal"))

    def _stream_proc_logs(self, process: subprocess.Popen, prefix: str):
        try:
            for line in iter(process.stdout.readline, ""):
                if line:
                    clean_line = line.strip()
                    if clean_line:
                        self.log(f"{prefix} {clean_line}")
                if not self.running_loop:
                    break
        except Exception:
            pass

    def stop_all_services(self):
        if self.is_stopping_all:
            return
        self.is_stopping_all = True
        self.btn_stop_all.configure(state="disabled")
        threading.Thread(target=self._stop_all_worker, daemon=True).start()

    def _stop_all_worker(self):
        self.log("🛑 ================= ĐANG DỪNG TOÀN BỘ HỆ THỐNG =================")

        if self.proc_tunnel and self.proc_tunnel.poll() is None:
            self.log("🛑 Đang đóng Cloudflare Tunnel...")
            try:
                subprocess.run("taskkill /F /IM cloudflared.exe /T", shell=True, capture_output=True)
                self.proc_tunnel = None
                self.log("✅ Đã tắt Cloudflare Tunnel.")
            except Exception as e:
                self.log(f"⚠️ Lỗi tắt tunnel: {e}")

        if self.proc_nextjs and self.proc_nextjs.poll() is None:
            self.log("🛑 Đang dừng Next.js Web App...")
            try:
                subprocess.run(f"taskkill /F /PID {self.proc_nextjs.pid} /T", shell=True, capture_output=True)
                self.proc_nextjs = None
                self.log("✅ Đã tắt Next.js.")
            except Exception as e:
                self.log(f"⚠️ Lỗi tắt Next.js: {e}")

        self.log("🛑 Đang dừng các container Supabase Local...")
        try:
            subprocess.run("cmd.exe /c npx.cmd supabase stop", cwd=str(PROJECT_DIR), shell=True, capture_output=True, timeout=30)
            self.log("✅ Đã dừng Supabase Local.")
        except Exception as e:
            self.log(f"⚠️ Lỗi dừng Supabase: {e}")

        self.log("🏁 Toàn bộ dịch vụ đã được tắt an toàn.")
        self.is_stopping_all = False
        self.root.after(0, lambda: self.btn_stop_all.configure(state="normal"))

    def _on_close(self):
        if (self.proc_nextjs and self.proc_nextjs.poll() is None) or (self.proc_tunnel and self.proc_tunnel.poll() is None):
            res = messagebox.askyesnocancel(
                "Thoát Server Launcher",
                "Các dịch vụ (Next.js, Tunnel, Supabase) đang hoạt động ngầm.\n\nBạn có muốn DỪNG TẤT CẢ dịch vụ trước khi thoát không?\n- Chọn Yes: Dừng hết rồi thoát.\n- Chọn No: Giữ server chạy ngầm và đóng giao diện.\n- Chọn Cancel: Quay lại."
            )
            if res is True:
                self.running_loop = False
                self.stop_all_services()
                self.root.destroy()
            elif res is False:
                self.running_loop = False
                self.root.destroy()
        else:
            self.running_loop = False
            self.root.destroy()


def main():
    root = tk.Tk()
    app = ServerManagerGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
