#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
====================================================================
  MODULAR WMS - 1-CLICK SERVER LAUNCHER & ENVIRONMENT MANAGER
  Biến Laptop / Máy tính thành Server chỉ với 1 Click!
  Hỗ trợ: Chế độ Production (Tối ưu tốc độ cao) & Development
  Tự động: Docker Desktop -> Supabase Local -> Next.js -> Cloudflare Tunnel
  Tích hợp: Bác Sĩ Môi Trường (Kiểm tra & Tải phần mềm tự động)
====================================================================
"""

import os
import sys
import time
import socket
import shutil
import threading
import subprocess
import webbrowser
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext, filedialog
from pathlib import Path

# --- CẤU HÌNH HỆ THỐNG ĐỘNG (DYNAMIC PATHS) ---
if getattr(sys, "frozen", False):
    PROJECT_DIR = Path(sys.executable).resolve().parent
else:
    PROJECT_DIR = Path(__file__).resolve().parent

TUNNEL_ID = "9df90c7f-63cf-4ac9-87f1-f615c0292e4d"
TUNNEL_SETUP_DIR = PROJECT_DIR / "tunnel_setup"
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


def ensure_tunnel_ready():
    """Tự động sao chép credentials và config Tunnel vào ~/.cloudflared nếu chưa có"""
    try:
        cf_dir = Path(os.path.expanduser(r"~\.cloudflared"))
        cf_dir.mkdir(parents=True, exist_ok=True)
        if TUNNEL_SETUP_DIR.exists():
            for item in TUNNEL_SETUP_DIR.glob("*"):
                if item.is_file() and item.suffix != ".exe":
                    dest = cf_dir / item.name
                    if not dest.exists():
                        shutil.copy2(item, dest)
    except Exception:
        pass


def get_cloudflared_bin() -> str:
    """Tìm đường dẫn thực thi cloudflared.exe tối ưu nhất"""
    local_cf = TUNNEL_SETUP_DIR / "cloudflared.exe"
    if local_cf.exists():
        return str(local_cf)
    for p in [
        Path(r"C:\Program Files (x86)\cloudflared\cloudflared.exe"),
        Path(r"C:\Program Files\cloudflared\cloudflared.exe"),
    ]:
        if p.exists():
            return str(p)
    return "cloudflared.exe"


def extract_base_domain(hostname: str) -> str:
    """Rút gọn hostname về tên miền gốc (loại bỏ www. và api.)"""
    h = hostname.strip().lower()
    if h.startswith("www."):
        h = h[4:]
    elif h.startswith("api."):
        h = h[4:]
    return h


def get_tunnel_config_targets() -> list[Path]:
    """Lấy danh sách các file cấu hình config.yml cần đồng bộ"""
    targets = []
    user_cfg = Path(os.path.expanduser(r"~\.cloudflared\config.yml"))
    if user_cfg.exists():
        targets.append(user_cfg)
    setup_cfg = TUNNEL_SETUP_DIR / "config.yml"
    if setup_cfg.exists() and setup_cfg not in targets:
        targets.append(setup_cfg)
    return targets


def get_all_domains_with_status() -> list[dict]:
    """
    Đọc tất cả tên miền trong config.yml cùng trạng thái Bật/Tắt (enabled).
    Trả về: [{'domain': 'chanhthu.click', 'enabled': True}, ...]
    """
    domain_map = {}
    targets = get_tunnel_config_targets()
    cfg_file = targets[0] if targets else (TUNNEL_SETUP_DIR / "config.yml")

    if cfg_file.exists():
        try:
            content = cfg_file.read_text(encoding="utf-8-sig")
            for line in content.splitlines():
                line_clean = line.strip()
                is_disabled = "[DISABLED]" in line_clean or "[TAT]" in line_clean
                if "hostname:" in line_clean:
                    parts = line_clean.split("hostname:", 1)
                    raw_host = parts[1].strip()
                    base = extract_base_domain(raw_host)
                    if base and "." in base:
                        if base not in domain_map:
                            domain_map[base] = {"has_active": False, "has_disabled": False}
                        if is_disabled:
                            domain_map[base]["has_disabled"] = True
                        else:
                            domain_map[base]["has_active"] = True
        except Exception:
            pass

    if not domain_map:
        return [
            {"domain": "chanhthu.click", "enabled": True},
            {"domain": "sarita.click", "enabled": True},
        ]

    result = []
    for d, info in sorted(domain_map.items()):
        result.append({
            "domain": d,
            "enabled": info["has_active"]
        })
    return result


def get_configured_domains() -> list[str]:
    """Đọc danh sách các tên miền ĐANG BẬT (active) trong Cloudflare Tunnel"""
    doms = get_all_domains_with_status()
    active = [d["domain"] for d in doms if d["enabled"]]
    return active if active else ["chanhthu.click", "sarita.click"]


def toggle_domain_status(target_domain: str, enable: bool) -> tuple[bool, str]:
    """Bật hoặc Tắt một tên miền trong cấu hình Cloudflare Tunnel"""
    target_clean = target_domain.strip().lower()
    targets = get_tunnel_config_targets()
    if not targets:
        return False, "Không tìm thấy file cấu hình config.yml của Cloudflare Tunnel!"

    updated_any = False
    for p in targets:
        try:
            content = p.read_text(encoding="utf-8-sig")
            lines = content.splitlines()
            new_lines = []
            current_rule_matches = False

            for line in lines:
                line_clean = line.strip()
                if "hostname:" in line_clean:
                    parts = line_clean.split("hostname:", 1)
                    raw_host = parts[1].strip()
                    if raw_host == target_clean or raw_host.endswith("." + target_clean):
                        current_rule_matches = True
                    else:
                        current_rule_matches = False
                elif line_clean.startswith("- service:") or (line_clean.startswith("#") and "- service:" in line_clean):
                    current_rule_matches = False
                elif not line_clean:
                    current_rule_matches = False

                if current_rule_matches and line_clean:
                    if enable:
                        if "# [DISABLED] " in line:
                            line = line.replace("# [DISABLED] ", "")
                        elif "# [DISABLED]" in line:
                            line = line.replace("# [DISABLED]", "")
                    else:
                        if "[DISABLED]" not in line:
                            stripped = line.lstrip()
                            indent = line[:len(line) - len(stripped)]
                            line = f"{indent}# [DISABLED] {stripped}"

                new_lines.append(line)

            new_content = "\n".join(new_lines) + ("\n" if content.endswith("\n") else "")
            p.write_text(new_content, encoding="utf-8")
            updated_any = True
        except Exception as e:
            return False, f"Lỗi cập nhật file {p.name}: {e}"

    if not updated_any:
        return False, f"Không thể cập nhật trạng thái cho tên miền '{target_domain}'."

    state_str = "BẬT" if enable else "TẮT"
    return True, f"Đã {state_str} tên miền '{target_clean}' thành công!"


def delete_domain_from_tunnel(target_domain: str) -> tuple[bool, str]:
    """Xóa hoàn toàn một tên miền khỏi cấu hình Cloudflare Tunnel"""
    target_clean = target_domain.strip().lower()
    targets = get_tunnel_config_targets()
    if not targets:
        return False, "Không tìm thấy file cấu hình config.yml!"

    updated_any = False
    for p in targets:
        try:
            content = p.read_text(encoding="utf-8-sig")
            lines = content.splitlines()
            new_lines = []
            current_rule_matches = False

            for line in lines:
                line_clean = line.strip()
                # Bỏ qua dòng chú thích tiêu đề liên quan đến domain này
                if line_clean.startswith("#") and target_clean in line_clean.lower() and "hostname:" not in line_clean:
                    continue

                if "hostname:" in line_clean:
                    parts = line_clean.split("hostname:", 1)
                    raw_host = parts[1].strip()
                    if raw_host == target_clean or raw_host.endswith("." + target_clean):
                        current_rule_matches = True
                    else:
                        current_rule_matches = False
                elif line_clean.startswith("- service:") or (line_clean.startswith("#") and "- service:" in line_clean):
                    current_rule_matches = False
                elif not line_clean:
                    current_rule_matches = False

                if current_rule_matches:
                    continue

                new_lines.append(line)

            new_content = "\n".join(new_lines) + ("\n" if content.endswith("\n") else "")
            p.write_text(new_content, encoding="utf-8")
            updated_any = True
        except Exception as e:
            return False, f"Lỗi xóa tên miền trong {p.name}: {e}"

    if not updated_any:
        return False, f"Không thể xóa tên miền '{target_domain}'."

    return True, f"Đã xóa hoàn toàn tên miền '{target_clean}' khỏi hệ thống!"


def add_domain_to_tunnel(new_domain: str):
    """Thêm tên miền mới vào config.yml của Cloudflare Tunnel hoặc kích hoạt lại nếu đang tắt"""
    domain = new_domain.strip().lower()
    domain = domain.replace("https://", "").replace("http://", "").split("/")[0]
    if domain.startswith("www."):
        domain = domain[4:]

    if not domain or "." not in domain or len(domain) < 4:
        return False, "Tên miền không hợp lệ! Ví dụ đúng: khohangmoi.com hoặc wms.tencongty.vn"

    # Kiểm tra xem tên miền đã có chưa
    existing_domains = get_all_domains_with_status()
    for item in existing_domains:
        if item["domain"] == domain:
            if not item["enabled"]:
                # Tên miền đã có nhưng đang tắt -> Bật lại
                ok, msg = toggle_domain_status(domain, True)
                if ok:
                    return True, f"Tên miền '{domain}' đã tồn tại và vừa được BẬT lại thành công!"
                return False, msg
            else:
                return False, f"Tên miền '{domain}' đã tồn tại và đang BẬT sẵn!"

    targets = [
        Path(os.path.expanduser(r"~\.cloudflared\config.yml")),
        TUNNEL_SETUP_DIR / "config.yml"
    ]

    updated_any = False
    for p in targets:
        if not p.exists():
            continue
        try:
            content = p.read_text(encoding="utf-8-sig")
            new_rules = f"""  # Tên miền bổ sung: {domain}
  - hostname: {domain}
    service: http://localhost:3000
  - hostname: www.{domain}
    service: http://localhost:3000
  - hostname: api.{domain}
    service: http://localhost:64321

  - service: http_status:404"""

            if "- service: http_status:404" in content:
                content = content.replace("  - service: http_status:404", new_rules)
            else:
                content += "\n" + new_rules

            p.write_text(content, encoding="utf-8")
            updated_any = True
        except Exception as e:
            return False, f"Lỗi ghi file {p.name}: {e}"

    if not updated_any:
        return False, f"Chưa tìm thấy file config.yml để ghi cấu hình!"

    return True, f"Đã thêm mới và kích hoạt tên miền '{domain}' thành công!"


class ServerManagerGUI:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Modular WMS - Server Controller & Environment Suite")
        self.root.geometry("900x740")
        self.root.minsize(820, 620)
        self.root.configure(bg="#0f172a")

        self.proc_nextjs = None
        self.proc_tunnel = None
        self.is_starting_all = False
        self.is_stopping_all = False
        self.is_building = False
        self.is_backing_up = False
        self.is_restoring = False
        self.running_loop = True

        # Tự động đồng bộ file Cloudflare Tunnel vào thư mục người dùng máy mới
        ensure_tunnel_ready()

        # Chế độ chạy: 'prod' hoặc 'dev'
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
            font=("Segoe UI", 10, "bold"),
            padding=6,
            borderwidth=0
        )
        style.map("Danger.TButton", background=[("active", "#b91c1c"), ("disabled", "#475569")])

        style.configure(
            "Success.TButton",
            background="#059669",
            foreground="#ffffff",
            font=("Segoe UI", 10, "bold"),
            padding=6,
            borderwidth=0
        )
        style.map("Success.TButton", background=[("active", "#047857"), ("disabled", "#475569")])

        style.configure(
            "Backup.TButton",
            background="#0284c7",
            foreground="#ffffff",
            font=("Segoe UI", 10, "bold"),
            padding=6,
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

        style.configure(
            "Doctor.TButton",
            background="#0d9488",
            foreground="#ffffff",
            font=("Segoe UI", 9, "bold"),
            padding=5,
            borderwidth=0
        )
        style.map("Doctor.TButton", background=[("active", "#0f766e"), ("disabled", "#475569")])

        style.configure(
            "Domain.TButton",
            background="#6366f1",
            foreground="#ffffff",
            font=("Segoe UI", 9, "bold"),
            padding=5,
            borderwidth=0
        )
        style.map("Domain.TButton", background=[("active", "#4f46e5"), ("disabled", "#475569")])

        style.configure(
            "Switch.TButton",
            background="#8b5cf6",
            foreground="#ffffff",
            font=("Segoe UI", 9, "bold"),
            padding=4,
            borderwidth=0
        )
        style.map("Switch.TButton", background=[("active", "#7c3aed"), ("disabled", "#475569")])

        style.configure(
            "ToggleOff.TButton",
            background="#dc2626",
            foreground="#ffffff",
            font=("Segoe UI", 9, "bold"),
            padding=5,
            borderwidth=0
        )
        style.map("ToggleOff.TButton", background=[("active", "#b91c1c"), ("disabled", "#475569")])

        style.configure(
            "ToggleOn.TButton",
            background="#16a34a",
            foreground="#ffffff",
            font=("Segoe UI", 9, "bold"),
            padding=5,
            borderwidth=0
        )
        style.map("ToggleOn.TButton", background=[("active", "#15803d"), ("disabled", "#475569")])

        style.configure(
            "Delete.TButton",
            background="#334155",
            foreground="#f87171",
            font=("Segoe UI", 9, "bold"),
            padding=5,
            borderwidth=0
        )
        style.map("Delete.TButton", background=[("active", "#7f1d1d"), ("disabled", "#475569")])

    def _build_ui(self):
        # 1. HEADER
        header_frame = tk.Frame(self.root, bg="#1e293b", height=70, padx=20, pady=12)
        header_frame.pack(fill=tk.X, side=tk.TOP)

        title_lbl = tk.Label(
            header_frame,
            text="⚡ MODULAR WMS - 1-CLICK PRODUCTION SERVER & SUITE",
            font=("Segoe UI", 14, "bold"),
            fg="#38bdf8",
            bg="#1e293b"
        )
        title_lbl.pack(anchor="w")

        subtitle_lbl = tk.Label(
            header_frame,
            text="Hệ thống Quản lý Kho Thông minh: Next.js + Supabase Local (Docker) + Cloudflare Tunnel",
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
        ttk.Radiobutton(mode_box, text="⚡ Production", variable=self.run_mode, value="prod").pack(side=tk.LEFT, padx=(0, 8))
        ttk.Radiobutton(mode_box, text="🛠️ Dev", variable=self.run_mode, value="dev").pack(side=tk.LEFT, padx=(0, 4))

        self.btn_switch_mode = ttk.Button(mode_box, text="🔄 Chuyển Chế Độ", style="Switch.TButton", command=self.switch_mode_fast)
        self.btn_switch_mode.pack(side=tk.RIGHT)

        btn_box = tk.Frame(actions_card, bg="#1e293b")
        btn_box.pack(fill=tk.X, pady=2)

        self.btn_start_all = ttk.Button(btn_box, text="🚀 KHỞI ĐỘNG TẤT CẢ (1-CLICK)", style="Primary.TButton", command=self.start_all_services)
        self.btn_start_all.pack(fill=tk.X, pady=(0, 6))

        btn_sub_row = tk.Frame(btn_box, bg="#1e293b")
        btn_sub_row.pack(fill=tk.X)

        self.btn_stop_all = ttk.Button(btn_sub_row, text="🛑 DỪNG TẤT CẢ", style="Danger.TButton", command=self.stop_all_services)
        self.btn_stop_all.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 4))

        self.btn_build = ttk.Button(btn_sub_row, text="🔨 Build Lại Web", style="Link.TButton", command=self.build_production)
        self.btn_build.pack(side=tk.RIGHT, fill=tk.X, expand=True, padx=(4, 0))

        # Hàng nút CSDL: Sao Lưu & Nạp CSDL
        btn_db_row = tk.Frame(btn_box, bg="#1e293b")
        btn_db_row.pack(fill=tk.X, pady=(6, 0))

        self.btn_backup = ttk.Button(btn_db_row, text="💾 SAO LƯU CSDL", style="Backup.TButton", command=self.backup_database)
        self.btn_backup.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 4))

        self.btn_restore = ttk.Button(btn_db_row, text="📥 NẠP / PHỤC HỒI CSDL", style="Success.TButton", command=self.restore_database)
        self.btn_restore.pack(side=tk.RIGHT, fill=tk.X, expand=True, padx=(4, 0))

        # Hàng nút Tiện ích 1: Bác Sĩ Môi Trường & Quản Lý Tên Miền
        btn_tools_row = tk.Frame(btn_box, bg="#1e293b")
        btn_tools_row.pack(fill=tk.X, pady=(6, 0))

        self.btn_doctor = ttk.Button(btn_tools_row, text="🩺 BÁC SĨ MÔI TRƯỜNG", style="Doctor.TButton", command=self.open_environment_doctor)
        self.btn_doctor.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 4))

        self.btn_domain = ttk.Button(btn_tools_row, text="🌐 QUẢN LÝ TÊN MIỀN", style="Domain.TButton", command=self.open_domain_manager)
        self.btn_domain.pack(side=tk.RIGHT, fill=tk.X, expand=True, padx=(4, 0))

        # Hàng nút Tiện ích 2: Mở Thư Mục Backup & Tài Liệu Hướng Dẫn
        btn_tools_row2 = tk.Frame(btn_box, bg="#1e293b")
        btn_tools_row2.pack(fill=tk.X, pady=(6, 0))

        self.btn_open_backup = ttk.Button(btn_tools_row2, text="📂 Xem Thư Mục Backup", style="Link.TButton", command=self.open_backup_folder)
        self.btn_open_backup.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 4))

        self.btn_open_guide = ttk.Button(btn_tools_row2, text="📖 Hướng Dẫn Cloudflare", style="Link.TButton", command=self.open_docs_guide)
        self.btn_open_guide.pack(side=tk.RIGHT, fill=tk.X, expand=True, padx=(4, 0))

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

        self.log("ℹ️ Trình quản lý Server Modular WMS đã sẵn sàng.")
        self.log(f"📁 Thư mục dự án: {PROJECT_DIR}")

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

    def get_backup_dir(self) -> Path:
        """Lấy thư mục sao lưu dữ liệu (linh hoạt và tự tạo nếu chưa có)"""
        b1 = PROJECT_DIR / "backups"
        b1.mkdir(parents=True, exist_ok=True)
        return b1

    def open_backup_folder(self):
        """Mở thư mục chứa file backup trên Windows Explorer"""
        backup_dir = self.get_backup_dir()
        if sys.platform == "win32":
            os.startfile(str(backup_dir))
        self.log(f"📂 Đã mở thư mục sao lưu: {backup_dir}")

    def backup_database(self):
        """Sao lưu nhanh toàn bộ dữ liệu Supabase Database Local ra file .sql"""
        if self.is_backing_up:
            return
        self.is_backing_up = True
        self.btn_backup.configure(state="disabled")
        threading.Thread(target=self._backup_database_worker, daemon=True).start()

    def _backup_database_worker(self):
        self.log("💾 ================= BẮT ĐẦU SAO LƯU DỮ LIỆU CSDL =================")
        try:
            backup_dir = self.get_backup_dir()
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
                timeout=180
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

    def restore_database(self):
        """Phục hồi / Nạp CSDL từ file .sql vào Supabase Local"""
        if self.is_restoring:
            return

        if not is_port_open(PORTS["supabase_db"]):
            res = messagebox.askyesno(
                "Supabase Chưa Khởi Động",
                "Cơ sở dữ liệu Supabase Local (cổng 64322) hiện chưa chạy.\n\nBạn có muốn tự động khởi động các dịch vụ trước khi nạp dữ liệu không?"
            )
            if res:
                self.start_all_services()
            return

        backup_dir = self.get_backup_dir()
        file_path = filedialog.askopenfilename(
            title="Chọn file sao lưu CSDL (.sql) để nạp vào hệ thống",
            filetypes=[("SQL Files (*.sql)", "*.sql"), ("Tất Cả Các File (*.*)", "*.*")],
            initialdir=str(backup_dir)
        )
        if not file_path:
            return

        confirm = messagebox.askyesno(
            "Xác Nhận Nạp CSDL",
            f"Bạn có chắc muốn nạp dữ liệu từ file:\n{Path(file_path).name}\n\nvào hệ thống Supabase Local không?\n(Dữ liệu từ file này sẽ được phục hồi vào CSDL hiện tại)"
        )
        if not confirm:
            return

        self.is_restoring = True
        self.btn_restore.configure(state="disabled")
        threading.Thread(target=self._restore_database_worker, args=(file_path,), daemon=True).start()

    def _restore_database_worker(self, file_path: str):
        p = Path(file_path)
        self.log(f"📥 ================= BẮT ĐẦU NẠP CSDL TỪ: {p.name} =================")
        try:
            file_size_kb = round(p.stat().st_size / 1024, 2)
            self.log(f"📦 Kích thước file: {file_size_kb} KB. Đang nạp vào Supabase PostgreSQL container...")

            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                res = subprocess.run(
                    ["docker", "exec", "-i", "supabase_db_anywarehouse", "psql", "-U", "postgres", "-d", "postgres"],
                    stdin=f,
                    capture_output=True,
                    text=True,
                    timeout=300
                )

            err_out = res.stderr or ""
            if res.returncode == 0:
                self.log(f"✅ Nạp CSDL THÀNH CÔNG 100%! Dữ liệu từ {p.name} đã được phục hồi.")
                self.root.after(0, lambda: messagebox.showinfo(
                    "Nạp CSDL Thành Công",
                    f"Đã phục hồi dữ liệu thành công từ file:\n{p.name}\n\nToàn bộ dữ liệu mới đã sẵn sàng sử dụng!"
                ))
            else:
                self.log(f"⚠️ Quá trình nạp hoàn tất với mã {res.returncode}. Thông báo:\n{err_out[:500]}")
                if "FATAL" in err_out.upper() or "ERROR:" in err_out:
                    self.root.after(0, lambda: messagebox.showwarning(
                        "Thông Báo Nạp CSDL",
                        f"Nạp hoàn tất với một số lưu ý:\n\n{err_out[:350]}..."
                    ))
                else:
                    self.root.after(0, lambda: messagebox.showinfo("Nạp CSDL Thành Công", f"Đã nạp dữ liệu xong từ {p.name}!"))
        except Exception as e:
            self.log(f"❌ Ngoại lệ khi nạp CSDL: {e}")
            self.root.after(0, lambda: messagebox.showerror("Lỗi Nạp CSDL", f"Không thể nạp dữ liệu: {e}"))
        finally:
            self.is_restoring = False
            self.root.after(0, lambda: self.btn_restore.configure(state="normal"))

    def build_production(self):
        """Build lại bản production Next.js"""
        if self.is_building:
            return
        self.is_building = True
        self.btn_build.configure(state="disabled")
        threading.Thread(target=self._build_production_worker, daemon=True).start()

    def _build_production_worker(self):
        self.log("🔨 ================= BẮT ĐẦU BUILD PRODUCTION (npm run build) =================")
        if is_port_open(PORTS["nextjs"]):
            self.log("ℹ️ Đang tạm dừng Web App cũ để tránh xung đột file lock...")
            try:
                subprocess.run("taskkill /F /IM node.exe /T", shell=True, capture_output=True)
                time.sleep(1.5)
            except Exception:
                pass

        self.log("🔨 Đang biên dịch Production... Vui lòng chờ 1 - 2 phút!")
        try:
            res = subprocess.run(
                "cmd.exe /c npm.cmd run build",
                cwd=str(PROJECT_DIR),
                shell=True,
                capture_output=True,
                text=True,
                timeout=300
            )
            if res.returncode == 0:
                self.log("✅ Build Production THÀNH CÔNG 100%! Bản build mới đã sẵn sàng.")
                self.log("🚀 Đang tự động chạy lại Web App với phiên bản vừa Build...")
                self.root.after(0, self.start_all_services)
            else:
                err_text = res.stderr or res.stdout or "Lỗi build"
                self.log(f"❌ Kết quả Build thất bại:\n{err_text}")
        except Exception as e:
            self.log(f"❌ Ngoại lệ khi Build: {e}")
        finally:
            self.is_building = False
            self.root.after(0, lambda: self.btn_build.configure(state="normal"))

    def switch_mode_fast(self):
        """Chuyển nhanh chế độ giữa Production và Dev"""
        if self.is_starting_all or self.is_stopping_all:
            return
        current = self.run_mode.get()
        new_mode = "dev" if current == "prod" else "prod"
        self.run_mode.set(new_mode)
        mode_text = "🛠️ DEVELOPMENT" if new_mode == "dev" else "⚡ PRODUCTION"
        self.log(f"🔄 Đang chuyển nhanh sang chế độ [{mode_text}]...")
        self.start_all_services()

    def start_all_services(self):
        if self.is_starting_all:
            return
        self.is_starting_all = True
        self.btn_start_all.configure(state="disabled")
        if hasattr(self, "btn_switch_mode"):
            self.btn_switch_mode.configure(state="disabled")
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
                self.log("❌ Lỗi: Docker Desktop chưa sẵn sàng. Bạn có thể mở Bác Sĩ Môi Trường để kiểm tra cài đặt!")
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
                    timeout=120
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
        ensure_tunnel_ready()
        if self.proc_tunnel is None or self.proc_tunnel.poll() is not None:
            try:
                cf_bin = get_cloudflared_bin()
                tunnel_cmd = f'"{cf_bin}" tunnel run {TUNNEL_ID}'
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
        if hasattr(self, "btn_switch_mode"):
            self.root.after(0, lambda: self.btn_switch_mode.configure(state="normal"))

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
            subprocess.run("cmd.exe /c npx.cmd supabase stop", cwd=str(PROJECT_DIR), shell=True, capture_output=True, timeout=40)
            self.log("✅ Đã dừng Supabase Local.")
        except Exception as e:
            self.log(f"⚠️ Lỗi dừng Supabase: {e}")

        self.log("🏁 Toàn bộ dịch vụ đã được tắt an toàn.")
        self.is_stopping_all = False
        self.root.after(0, lambda: self.btn_stop_all.configure(state="normal"))

    def _restart_tunnel_if_running(self, reason: str = ""):
        """Tự động reload / restart Tunnel nếu đang chạy để áp dụng cấu hình mới"""
        if self.proc_tunnel and self.proc_tunnel.poll() is None:
            self.log(f"🔄 Đang khởi động lại Cloudflare Tunnel ({reason})...")
            try:
                subprocess.run("taskkill /F /IM cloudflared.exe /T", shell=True, capture_output=True)
                self.proc_tunnel = None
                time.sleep(1)
                cf_bin = get_cloudflared_bin()
                self.proc_tunnel = subprocess.Popen(
                    f'"{cf_bin}" tunnel run {TUNNEL_ID}',
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
                )
                threading.Thread(target=self._stream_proc_logs, args=(self.proc_tunnel, "[Tunnel]"), daemon=True).start()
                self.log(f"✅ Cloudflare Tunnel đã tự động kết nối lại thành công với cấu hình mới ({reason})!")
            except Exception as e:
                self.log(f"⚠️ Lỗi khởi động lại tunnel: {e}")

    # ====================================================================
    # BÁC SĨ MÔI TRƯỜNG & KIỂM TRA PHẦN MỀM (ENVIRONMENT DOCTOR)
    # ====================================================================
    def open_environment_doctor(self):
        """Mở cửa sổ chẩn đoán và tự động hỗ trợ cài đặt các phần mềm phụ thuộc"""
        doc_win = tk.Toplevel(self.root)
        doc_win.title("🩺 BÁC SĨ MÔI TRƯỜNG - KIỂM TRA & TẢI PHẦN MỀM HỆ THỐNG")
        doc_win.geometry("760x600")
        doc_win.minsize(700, 500)
        doc_win.configure(bg="#0f172a")

        header = tk.Frame(doc_win, bg="#1e293b", padx=16, pady=12)
        header.pack(fill=tk.X)
        tk.Label(
            header,
            text="🩺 TRÌNH CHẨN ĐOÁN & CÀI ĐẶT MÔI TRƯỜNG MÁY MỚI",
            font=("Segoe UI", 12, "bold"),
            fg="#38bdf8",
            bg="#1e293b"
        ).pack(anchor="w")
        tk.Label(
            header,
            text="Tự động kiểm tra Docker, Node.js, Python, Tunnel. Nếu thiếu có thể bấm nút để cài đặt tự động!",
            font=("Segoe UI", 9),
            fg="#94a3b8",
            bg="#1e293b"
        ).pack(anchor="w")

        content = tk.Frame(doc_win, bg="#0f172a", padx=16, pady=12)
        content.pack(fill=tk.BOTH, expand=True)

        items_box = tk.Frame(content, bg="#0f172a")
        items_box.pack(fill=tk.X)

        # 1. Docker
        docker_status = "Đang kiểm tra..."
        docker_installed = shutil.which("docker") is not None
        docker_running = is_docker_ready()
        if docker_running:
            docker_status = "✅ Đang chạy hoàn hảo"
            docker_color = "#22c55e"
        elif docker_installed:
            docker_status = "⚠️ Đã cài đặt nhưng chưa khởi động"
            docker_color = "#eab308"
        else:
            docker_status = "❌ Chưa cài đặt"
            docker_color = "#ef4444"

        row1 = tk.Frame(items_box, bg="#1e293b", padx=12, pady=10, highlightthickness=1, highlightbackground="#334155")
        row1.pack(fill=tk.X, pady=(0, 8))
        tk.Label(row1, text="🐳 Docker Desktop (Bắt buộc cho Supabase CSDL):", font=("Segoe UI", 9, "bold"), fg="#f8fafc", bg="#1e293b").pack(side=tk.LEFT)
        tk.Label(row1, text=docker_status, font=("Segoe UI", 9, "bold"), fg=docker_color, bg="#1e293b").pack(side=tk.LEFT, padx=10)

        btn_install_docker = ttk.Button(
            row1,
            text="⚡ Cài Docker (winget)",
            style="Doctor.TButton",
            command=lambda: self._install_via_winget("Docker Desktop", "Docker.DockerDesktop")
        )
        btn_install_docker.pack(side=tk.RIGHT, padx=4)
        ttk.Button(
            row1,
            text="🌐 Tải Trực Tiếp",
            style="Link.TButton",
            command=lambda: webbrowser.open("https://www.docker.com/products/docker-desktop/")
        ).pack(side=tk.RIGHT)

        # 2. Node.js
        node_status = "❌ Chưa cài đặt"
        node_color = "#ef4444"
        try:
            n_res = subprocess.run(["node", "-v"], capture_output=True, text=True, timeout=2)
            if n_res.returncode == 0:
                node_status = f"✅ Đã cài đặt ({n_res.stdout.strip()})"
                node_color = "#22c55e"
        except Exception:
            pass

        row2 = tk.Frame(items_box, bg="#1e293b", padx=12, pady=10, highlightthickness=1, highlightbackground="#334155")
        row2.pack(fill=tk.X, pady=(0, 8))
        tk.Label(row2, text="🌐 Node.js LTS (Bắt buộc cho Web App Next.js):", font=("Segoe UI", 9, "bold"), fg="#f8fafc", bg="#1e293b").pack(side=tk.LEFT)
        tk.Label(row2, text=node_status, font=("Segoe UI", 9, "bold"), fg=node_color, bg="#1e293b").pack(side=tk.LEFT, padx=10)

        btn_install_node = ttk.Button(
            row2,
            text="⚡ Cài Node.js (winget)",
            style="Doctor.TButton",
            command=lambda: self._install_via_winget("Node.js LTS", "OpenJS.NodeJS.LTS")
        )
        btn_install_node.pack(side=tk.RIGHT, padx=4)
        ttk.Button(
            row2,
            text="🌐 Tải Trực Tiếp",
            style="Link.TButton",
            command=lambda: webbrowser.open("https://nodejs.org/")
        ).pack(side=tk.RIGHT)

        # 3. Python 3
        py_status = f"✅ Đã cài đặt ({sys.version.split()[0]})"
        py_color = "#22c55e"
        row3 = tk.Frame(items_box, bg="#1e293b", padx=12, pady=10, highlightthickness=1, highlightbackground="#334155")
        row3.pack(fill=tk.X, pady=(0, 8))
        tk.Label(row3, text="🐍 Python 3 (Bảng điều khiển máy chủ):", font=("Segoe UI", 9, "bold"), fg="#f8fafc", bg="#1e293b").pack(side=tk.LEFT)
        tk.Label(row3, text=py_status, font=("Segoe UI", 9, "bold"), fg=py_color, bg="#1e293b").pack(side=tk.LEFT, padx=10)

        # 4. Cloudflare Tunnel
        tunnel_ready = (TUNNEL_SETUP_DIR / "cloudflared.exe").exists() or shutil.which("cloudflared") is not None
        cf_cred_ready = Path(os.path.expanduser(r"~\.cloudflared\config.yml")).exists()
        tunnel_status = "✅ Đã tích hợp sẵn kèm bộ cài" if (tunnel_ready and cf_cred_ready) else "⚠️ Chưa đồng bộ"
        tunnel_color = "#22c55e" if (tunnel_ready and cf_cred_ready) else "#eab308"

        row4 = tk.Frame(items_box, bg="#1e293b", padx=12, pady=10, highlightthickness=1, highlightbackground="#334155")
        row4.pack(fill=tk.X, pady=(0, 8))
        tk.Label(row4, text="🚇 Cloudflare Tunnel (Online Tên Miền):", font=("Segoe UI", 9, "bold"), fg="#f8fafc", bg="#1e293b").pack(side=tk.LEFT)
        tk.Label(row4, text=tunnel_status, font=("Segoe UI", 9, "bold"), fg=tunnel_color, bg="#1e293b").pack(side=tk.LEFT, padx=10)
        ttk.Button(
            row4,
            text="🔄 Đồng Bộ Cấu Hình Ngay",
            style="Link.TButton",
            command=lambda: [ensure_tunnel_ready(), messagebox.showinfo("Thành Công", "Đã đồng bộ file cấu hình Tunnel vào ~/.cloudflared!")]
        ).pack(side=tk.RIGHT)

        # 5. Tiện ích tạo Shortcut Desktop
        row5 = tk.Frame(items_box, bg="#1e293b", padx=12, pady=10, highlightthickness=1, highlightbackground="#334155")
        row5.pack(fill=tk.X, pady=(0, 8))
        tk.Label(row5, text="📌 Tạo biểu tượng khởi động ngoài màn hình:", font=("Segoe UI", 9, "bold"), fg="#f8fafc", bg="#1e293b").pack(side=tk.LEFT)
        ttk.Button(
            row5,
            text="📌 Tạo Shortcut Desktop Ngay",
            style="Success.TButton",
            command=self.create_desktop_shortcut
        ).pack(side=tk.RIGHT)

        # Khung nhật ký riêng của Doctor
        doc_log_box = tk.Frame(content, bg="#1e293b", padx=10, pady=8)
        doc_log_box.pack(fill=tk.BOTH, expand=True, pady=(8, 0))
        tk.Label(doc_log_box, text="📜 Tiến trình cài đặt tự động:", font=("Segoe UI", 9, "bold"), fg="#94a3b8", bg="#1e293b").pack(anchor="w")

        doc_text = scrolledtext.ScrolledText(doc_log_box, bg="#0b0f19", fg="#38bdf8", font=("Consolas", 9), height=8)
        doc_text.pack(fill=tk.BOTH, expand=True, pady=(4, 0))
        doc_text.insert(tk.END, "Chào mừng bạn đến với Bác Sĩ Môi Trường!\nNếu máy mới thiếu phần mềm nào, hãy bấm nút '⚡ Cài...' tương ứng để hệ thống tự động tải và cài đặt qua winget.\n")
        self._doc_text = doc_text

    def _install_via_winget(self, app_name: str, package_id: str):
        """Chạy lệnh winget cài đặt tự động ngầm"""
        if hasattr(self, "_doc_text") and self._doc_text:
            self._doc_text.insert(tk.END, f"\n[BẮT ĐẦU] Đang tải & cài đặt {app_name} ({package_id}) qua winget...\n")
            self._doc_text.see(tk.END)

        def worker():
            cmd = f'winget install --id {package_id} -e --accept-source-agreements --accept-package-agreements'
            proc = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            for line in iter(proc.stdout.readline, ""):
                if line and hasattr(self, "_doc_text") and self._doc_text:
                    self.root.after(0, lambda l=line: (self._doc_text.insert(tk.END, l), self._doc_text.see(tk.END)))
            proc.wait()
            if proc.returncode == 0:
                self.root.after(0, lambda: messagebox.showinfo("Cài Đặt Thành Công", f"Đã cài đặt {app_name} thành công!"))
            else:
                self.root.after(0, lambda: messagebox.showwarning("Thông Báo", f"Cài đặt hoàn tất với mã {proc.returncode}. Vui lòng kiểm tra lại."))

        threading.Thread(target=worker, daemon=True).start()

    def create_desktop_shortcut(self):
        """Tạo Shortcut ngoài màn hình Desktop dẫn đến hệ thống"""
        try:
            desktop = Path(os.path.expanduser("~/Desktop"))
            shortcut_path = desktop / "Modular WMS Server.lnk"

            bat_file = PROJECT_DIR / "CHAY_SERVER.bat"
            target_path = str(bat_file)
            work_dir = str(PROJECT_DIR)

            vbs = f'''Set oWS = WScript.CreateObject("WScript.Shell")
Set oLink = oWS.CreateShortcut("{shortcut_path}")
oLink.TargetPath = "{target_path}"
oLink.WorkingDirectory = "{work_dir}"
oLink.Description = "Khoi dong Modular WMS Server 1-Click"
oLink.Save
'''
            vbs_file = PROJECT_DIR / "_temp_sc.vbs"
            vbs_file.write_text(vbs, encoding="utf-8")
            subprocess.run(["cscript", "//nologo", str(vbs_file)], check=True)
            if vbs_file.exists():
                vbs_file.unlink()

            self.log(f"📌 Đã tạo biểu tượng Shortcut ngoài màn hình Desktop: {shortcut_path.name}")
            messagebox.showinfo("Thành Công", f"Đã tạo biểu tượng Shortcut ngoài màn hình Desktop:\n\n{shortcut_path}")
        except Exception as e:
            self.log(f"❌ Lỗi tạo shortcut: {e}")
            messagebox.showerror("Lỗi", f"Không thể tạo Shortcut: {e}")

    def open_docs_guide(self):
        """Mở trang tài liệu HTML hướng dẫn cấu hình Cloudflare Tunnel offline"""
        guide_path = PROJECT_DIR / "docs" / "HUONG_DAN_TEN_MIEN_CLOUDFLARE.html"
        if not guide_path.exists():
            guide_path = PROJECT_DIR / "public" / "HUONG_DAN_TEN_MIEN_CLOUDFLARE.html"
        if guide_path.exists():
            webbrowser.open(str(guide_path))
            self.log(f"📖 Đã mở tài liệu hướng dẫn: {guide_path.name}")
        else:
            messagebox.showinfo("Tài Liệu Hướng Dẫn", "Chưa tìm thấy file hướng dẫn.")

    def open_domain_manager(self):
        """Mở cửa sổ quản lý tên miền và cấu hình Cloudflare Tunnel với tính năng Bật/Tắt và Xóa"""
        dm_win = tk.Toplevel(self.root)
        dm_win.title("🌐 QUẢN LÝ TÊN MIỀN & CLOUDFLARE TUNNEL")
        dm_win.geometry("780x660")
        dm_win.minsize(720, 560)
        dm_win.configure(bg="#0f172a")

        header = tk.Frame(dm_win, bg="#1e293b", padx=16, pady=12)
        header.pack(fill=tk.X)
        tk.Label(
            header,
            text="🌐 QUẢN LÝ TÊN MIỀN & CLOUDFLARE TUNNEL",
            font=("Segoe UI", 12, "bold"),
            fg="#38bdf8",
            bg="#1e293b"
        ).pack(anchor="w")
        tk.Label(
            header,
            text="Quản lý, Bật/Tắt hoặc Thêm tên miền riêng chỉ với 1 click. Hệ thống sẽ tự động cập nhật cấu hình và nạp lại Tunnel!",
            font=("Segoe UI", 9),
            fg="#94a3b8",
            bg="#1e293b"
        ).pack(anchor="w")

        content = tk.Frame(dm_win, bg="#0f172a", padx=16, pady=12)
        content.pack(fill=tk.BOTH, expand=True)

        # 1. KHUNG NHẬP TÊN MIỀN MỚI
        input_card = tk.Frame(content, bg="#1e293b", padx=14, pady=12, highlightthickness=1, highlightbackground="#334155")
        input_card.pack(fill=tk.X, pady=(0, 12))

        tk.Label(input_card, text="➕ THÊM TÊN MIỀN MỚI CHO HỆ THỐNG", font=("Segoe UI", 10, "bold"), fg="#f8fafc", bg="#1e293b").pack(anchor="w", pady=(0, 6))
        tk.Label(input_card, text="Nhập tên miền (ví dụ: khohangmoi.com hoặc wms.tencongty.vn):", font=("Segoe UI", 9), fg="#94a3b8", bg="#1e293b").pack(anchor="w", pady=(0, 4))

        input_row = tk.Frame(input_card, bg="#1e293b")
        input_row.pack(fill=tk.X, pady=4)

        ent_domain = tk.Entry(input_row, font=("Segoe UI", 10), bg="#0f172a", fg="#ffffff", insertbackground="#38bdf8", relief="flat")
        ent_domain.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 8), ipady=4)

        # 2. KHUNG THÔNG TIN DNS CẦN TRỎ TRÊN CLOUDFLARE
        dns_card = tk.Frame(content, bg="#1e293b", padx=14, pady=12, highlightthickness=1, highlightbackground="#334155")
        dns_card.pack(fill=tk.X, pady=(0, 12))

        tk.Label(dns_card, text="📋 THÔNG SỐ DNS CẦN TRỎ TRÊN CLOUDFLARE", font=("Segoe UI", 10, "bold"), fg="#f8fafc", bg="#1e293b").pack(anchor="w", pady=(0, 6))

        tunnel_target = f"{TUNNEL_ID}.cfargotunnel.com"
        target_row = tk.Frame(dns_card, bg="#0f172a", padx=10, pady=8, highlightthickness=1, highlightbackground="#334155")
        target_row.pack(fill=tk.X, pady=4)

        tk.Label(target_row, text="CNAME Target:", font=("Segoe UI", 9, "bold"), fg="#94a3b8", bg="#0f172a").pack(side=tk.LEFT)
        lbl_target = tk.Label(target_row, text=tunnel_target, font=("Consolas", 9, "bold"), fg="#38bdf8", bg="#0f172a")
        lbl_target.pack(side=tk.LEFT, padx=8)

        def copy_target():
            self.root.clipboard_clear()
            self.root.clipboard_append(tunnel_target)
            messagebox.showinfo("Đã Sao Chép", f"Đã sao chép CNAME Target vào bộ nhớ tạm:\n\n{tunnel_target}")

        ttk.Button(target_row, text="📋 Sao Chép", style="Link.TButton", command=copy_target).pack(side=tk.RIGHT)

        tk.Label(
            dns_card,
            text="💡 Thêm 3 bản ghi CNAME: '@', 'www', 'api' trỏ đến Target trên và BẬT đám mây màu cam 🟠 (Proxied).",
            font=("Segoe UI", 8),
            fg="#facc15",
            bg="#1e293b"
        ).pack(anchor="w", pady=(4, 0))

        # 3. KHUNG QUẢN LÝ DANH SÁCH TÊN MIỀN (BẬT / TẮT / XÓA)
        list_card = tk.Frame(content, bg="#1e293b", padx=14, pady=12, highlightthickness=1, highlightbackground="#334155")
        list_card.pack(fill=tk.BOTH, expand=True, pady=(0, 10))

        list_head = tk.Frame(list_card, bg="#1e293b")
        list_head.pack(fill=tk.X, pady=(0, 8))
        lbl_list_title = tk.Label(list_head, text="🌍 QUẢN LÝ TRẠNG THÁI TÊN MIỀN", font=("Segoe UI", 10, "bold"), fg="#f8fafc", bg="#1e293b")
        lbl_list_title.pack(side=tk.LEFT)

        ttk.Button(
            list_head,
            text="📖 Mở Hướng Dẫn Cloudflare Đầy Đủ (HTML)",
            style="Link.TButton",
            command=self.open_docs_guide
        ).pack(side=tk.RIGHT)

        # Danh sách dạng cuộn
        list_scroll_frame = tk.Frame(list_card, bg="#0f172a")
        list_scroll_frame.pack(fill=tk.BOTH, expand=True)

        canvas = tk.Canvas(list_scroll_frame, bg="#0f172a", highlightthickness=0)
        scrollbar = ttk.Scrollbar(list_scroll_frame, orient="vertical", command=canvas.yview)
        domains_box = tk.Frame(canvas, bg="#0f172a")

        domains_box.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        canvas_win_id = canvas.create_window((0, 0), window=domains_box, anchor="nw")
        canvas.bind('<Configure>', lambda e: canvas.itemconfig(canvas_win_id, width=e.width))

        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        def _on_mousewheel(event):
            try:
                if canvas.winfo_exists():
                    canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
            except Exception:
                pass

        dm_win.bind("<MouseWheel>", _on_mousewheel)

        def refresh_domain_list():
            for child in domains_box.winfo_children():
                child.destroy()
            d_list = get_all_domains_with_status()

            active_cnt = sum(1 for d in d_list if d["enabled"])
            disabled_cnt = len(d_list) - active_cnt
            lbl_list_title.config(
                text=f"🌍 QUẢN LÝ TRẠNG THÁI TÊN MIỀN ({active_cnt} Đang Bật | {disabled_cnt} Đang Tắt)"
            )

            if not d_list:
                empty_lbl = tk.Label(
                    domains_box,
                    text="Chưa có tên miền nào trong hệ thống. Hãy nhập tên miền ở khung trên để thêm!",
                    font=("Segoe UI", 9, "italic"),
                    fg="#94a3b8",
                    bg="#0f172a",
                    pady=16
                )
                empty_lbl.pack(fill=tk.X)
                return

            for item in d_list:
                domain_name = item["domain"]
                is_enabled = item["enabled"]

                r = tk.Frame(domains_box, bg="#1e293b", padx=10, pady=8, highlightthickness=1, highlightbackground="#334155")
                r.pack(fill=tk.X, pady=3, padx=2)

                left_col = tk.Frame(r, bg="#1e293b")
                left_col.pack(side=tk.LEFT, fill=tk.X, expand=True)

                lbl_name = tk.Label(
                    left_col,
                    text=f"🌐 {domain_name}",
                    font=("Segoe UI", 10, "bold"),
                    fg="#38bdf8" if is_enabled else "#94a3b8",
                    bg="#1e293b"
                )
                lbl_name.pack(side=tk.LEFT)

                if is_enabled:
                    lbl_badge = tk.Label(
                        left_col,
                        text="● Đang BẬT",
                        font=("Segoe UI", 8, "bold"),
                        fg="#22c55e",
                        bg="#1e293b"
                    )
                else:
                    lbl_badge = tk.Label(
                        left_col,
                        text="○ Đang TẮT",
                        font=("Segoe UI", 8, "bold"),
                        fg="#ef4444",
                        bg="#1e293b"
                    )
                lbl_badge.pack(side=tk.LEFT, padx=12)

                btn_group = tk.Frame(r, bg="#1e293b")
                btn_group.pack(side=tk.RIGHT)

                # Nút Bật/Tắt
                if is_enabled:
                    btn_toggle = ttk.Button(
                        btn_group,
                        text="⏸️ Tắt Tên Miền",
                        style="ToggleOff.TButton",
                        command=lambda dom=domain_name: handle_toggle(dom, False)
                    )
                else:
                    btn_toggle = ttk.Button(
                        btn_group,
                        text="▶️ Bật Tên Miền",
                        style="ToggleOn.TButton",
                        command=lambda dom=domain_name: handle_toggle(dom, True)
                    )
                btn_toggle.pack(side=tk.LEFT, padx=(0, 6))

                # Nút Mở Web
                if is_enabled:
                    btn_web = ttk.Button(
                        btn_group,
                        text="🌐 Mở Web",
                        style="Link.TButton",
                        command=lambda url=f"https://{domain_name}": webbrowser.open(url)
                    )
                else:
                    btn_web = ttk.Button(
                        btn_group,
                        text="🌐 Mở Web",
                        style="Link.TButton",
                        state="disabled"
                    )
                btn_web.pack(side=tk.LEFT, padx=(0, 6))

                # Nút Xóa
                btn_del = ttk.Button(
                    btn_group,
                    text="🗑️ Xóa",
                    style="Delete.TButton",
                    command=lambda dom=domain_name: handle_delete(dom)
                )
                btn_del.pack(side=tk.LEFT)

        def handle_toggle(domain: str, enable: bool):
            action_text = "BẬT" if enable else "TẮT"
            if not enable:
                confirm = messagebox.askyesno(
                    "Xác Nhận Tắt Tên Miền",
                    f"Bạn có chắc chắn muốn TẮT tên miền '{domain}' không?\n\n"
                    f"- Khi tắt, Cloudflare Tunnel sẽ ngưng trỏ traffic cho tên miền này.\n"
                    f"- Người dùng truy cập tên miền này sẽ nhận phản hồi 404 (Không tìm thấy).\n"
                    f"- Bạn có thể bấm 'Bật Tên Miền' để kích hoạt lại bất kỳ lúc nào!"
                )
                if not confirm:
                    return

            ok, msg = toggle_domain_status(domain, enable)
            if not ok:
                messagebox.showerror("Lỗi", msg)
                return

            self.log(f"🌐 Đã {action_text} tên miền: {domain} trong cấu hình Cloudflare Tunnel!")
            self._restart_tunnel_if_running(f"{action_text} tên miền {domain}")
            refresh_domain_list()
            messagebox.showinfo(
                f"Đã {action_text} Tên Miền",
                f"Đã {action_text.lower()} tên miền '{domain}' thành công!\n\nCấu hình Tunnel đã được cập nhật tự động."
            )

        def handle_delete(domain: str):
            confirm = messagebox.askyesno(
                "Xác Nhận Xóa Tên Miền",
                f"Bạn có chắc chắn muốn XÓA VĨNH VIỄN tên miền '{domain}' khỏi cấu hình Tunnel không?\n\n"
                f"- Toàn bộ cấu hình của '{domain}', 'www.{domain}', 'api.{domain}' sẽ bị gỡ bỏ.\n"
                f"- Bạn vẫn có thể thêm lại tên miền này sau nếu muốn."
            )
            if not confirm:
                return

            ok, msg = delete_domain_from_tunnel(domain)
            if not ok:
                messagebox.showerror("Lỗi", msg)
                return

            self.log(f"🗑️ Đã xóa tên miền: {domain} khỏi cấu hình Cloudflare Tunnel!")
            self._restart_tunnel_if_running(f"Xóa tên miền {domain}")
            refresh_domain_list()
            messagebox.showinfo("Đã Xóa Tên Miền", f"Đã xóa hoàn toàn tên miền '{domain}' khỏi hệ thống!")

        def handle_add():
            domain = ent_domain.get().strip()
            if not domain:
                messagebox.showwarning("Thông Báo", "Vui lòng nhập tên miền cần thêm!")
                return
            ok, res = add_domain_to_tunnel(domain)
            if not ok:
                messagebox.showerror("Lỗi", res)
                return

            self.log(f"🌐 {res}")
            self._restart_tunnel_if_running(f"Thêm/Bật tên miền {domain}")
            ent_domain.delete(0, tk.END)
            refresh_domain_list()
            messagebox.showinfo(
                "Thành Công",
                f"{res}\n\n"
                f"Bây giờ bạn chỉ cần vào Cloudflare Dashboard trỏ 3 bản ghi CNAME (@, www, api) về Target trên là nhân viên có thể truy cập được ngay!\n\n"
                f"Bấm '📖 Mở Hướng Dẫn' nếu bạn muốn xem chi tiết từng bước."
            )

        btn_add = ttk.Button(input_row, text="➕ Thêm Tên Miền Ngay", style="Success.TButton", command=handle_add)
        btn_add.pack(side=tk.RIGHT)

        # Tải danh sách lần đầu
        refresh_domain_list()

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
