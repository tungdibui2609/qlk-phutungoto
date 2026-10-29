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
import re
import sys
import time
import socket
import shutil
import tempfile
import threading
import subprocess
import webbrowser
import ctypes
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
    "nextjs_dev": 3001,
    "supabase_api": 64321,
    "supabase_db": 64322,
    "supabase_studio": 64323,
    "supabase_mail": 64324,
}

SUPABASE_DB_CONTAINER = "supabase_db_anywarehouse"

# Bảng nội bộ của chính các dịch vụ Supabase (GoTrue / Storage).
# Không nằm trong file backup nhưng nếu xóa theo thì dịch vụ sẽ hỏng.
RESTORE_PROTECTED_TABLES = {
    "auth.schema_migrations",
    "storage.migrations",
}

# Các schema nghiệp vụ chịu sự quản lý của chức năng Sao lưu / Phục hồi
RESTORE_SCHEMAS = ("public", "auth", "storage")


def build_migration_checklist_text(archive_name, dump_name, archive_mb, db_tables, db_rows, pg_image):
    """Soạn nội dung CHECKLIST_CHUYEN_MAY.txt đặt cạnh file nén.

    db_tables / db_rows là số bảng và tổng số dòng đúng của ảnh chụp CSDL vừa nhúng
    vào gói nén - người dùng máy mới lấy con số này để đối chiếu với messagebox sau khi nạp.
    """
    return f"""========================================================================
  BỘ DI CHUYỂN MÁY - MODULAR WMS / ANYWAREHOUSE
========================================================================

Gói nén          : {archive_name} ({archive_mb} MB)
Ảnh CSDL kèm theo: {dump_name}  (ĐÃ nằm BÊN TRONG gói nén này)
Số bảng          : {db_tables}
Tổng số dòng     : {db_rows:,}
Image PostgreSQL : {pg_image}

------------------------------------------------------------------------
GÓI NÀY CHỮ GÌ / KHÔNG CHỮ GÌ
------------------------------------------------------------------------
CÓ   : toàn bộ src, supabase/migrations, config.toml, roles.sql, docker-compose.yml
CÓ   : .env.local + .env.test.local (Windows không đặt thuộc tính ẩn cho 2 file này)
CÓ   : node_modules (máy mới KHÔNG cần chạy npm install)
CÓ   : ảnh CSDL {dump_name}
KHÔNG: .next      -> máy mới phải bấm "Build Production" trong launcher
KHÔNG: dist_installer, các file .rar/.zip cũ (tránh nén lồng trong nén)

VỊ TRÍ ẢNH CSDL SAU KHI GIẢI NÉN: backups\\{dump_name} nếu gói là .rar,
                       hoặc nằm ngay ở gốc thư mục nếu gói là .zip.

CẢNH BÁO: .env.local chứa mật khẩu Gmail app, Google Drive refresh token,
          Cloudinary và SUPABASE_SERVICE_ROLE_KEY. Hãy coi gói nén này là
          một phong bì bí mật - chỉ giữ ở vùng riêng tư, tuyệt đối không
          commit lên git, không chia sẻ link công khai.

------------------------------------------------------------------------
ĐIỀU KIỆN Ở MÁY MỚI (cài ĐÚNG vị trí như máy cũ)
------------------------------------------------------------------------
  Docker Desktop       C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe
  cloudflared          C:\\Program Files\\cloudflared\\cloudflared.exe
                       (hoặc C:\\Program Files (x86)\\cloudflared\\)
  WinRAR (tuỳ chọn)    C:\\Program Files\\WinRAR\\Rar.exe
  Inno Setup 6 (t. c.)  C:\\Program Files\\Inno Setup 6\\ISCC.exe
  Node.js 24.x, Python 3.x, Git
  Supabase CLI: lấy từ package.json của dự án qua npx (máy cũ đang dùng v2.113.0)

------------------------------------------------------------------------
TRÌNH TỰ 7 BƯỚC TRÊN MÁY MỚI
------------------------------------------------------------------------
1. Cài đủ phần mềm ở trên, khởi động Docker Desktop (chờ nó chạy xong hẳn).
2. Giải nén gói này vào ĐƯỜNG DẪN NÀO CŨNG ĐƯỢC. Đường dẫn không quan trọng:
   tên các Docker volume lấy từ project_id = "anywarehouse" trong config.toml.
3. Mở cmd trong thư mục dự án, chạy:  npx supabase start
4. LẤY KEY MỚI, chạy:                  npx supabase status
   -> chép 2 giá trị anon_key và service_role vào .env.local, GHI ĐÈ key cũ.
   LÝ DO: JWT secret của Supabase Local được sinh NGẪU NHIÊN theo từng máy
   và nằm trong Docker volume của máy cũ, KHÔNG nằm trong thư mục dự án.
   Đem key cũ sang máy mới = mọi request báo 401 (nhìn như app hỏng).
5. Mở CHAY_SERVER.bat -> bấm "Build Production" (vì .next đã bị loại khỏi gói).
6. Mở launcher -> bấm "NẠP / PHỤC HỒI CSDL" -> chọn file {dump_name}.
   Launcher sẽ TỰ ĐẾM số dòng từng bảng sau khi nạp xong.
   CON SỐ PHẢI KHỚP: {db_tables} bảng, {db_rows:,} dòng.
   Nếu hộp thoại báo LỆCH: đừng hoảng - launcher đã lưu sẵn bản
   pre_restore_<timestamp>.sql ngay trước khi ghi đè, nạp lại bản đó là về cũ.
7. Kiểm tra cuối: đăng nhập được, mở từng phân hệ kho, xác nhận các module
   bật/tắt vẫn đúng như máy cũ; ảnh sản phẩm vẫn hiển thị vì ảnh nằm trên
   Google Drive (không phụ thuộc máy) - chỉ cần refresh token ở bước trên còn hạn.

------------------------------------------------------------------------
VẾT CẦN LƯU Ý
------------------------------------------------------------------------
- Phiên đăng nhập cũ bị vô hiệu sau bước 4 (đổi JWT) - hoàn toàn bình thường.
- Nếu KHÔNG muốn đổi key, thay bước 3-4 bằng cách bê nguyên Docker volume:
    máy cũ : docker run --rm -v supabase_db_anywarehouse:/from alpine tar czf db.tar -C /from .
    máy mới: chạy supabase start MỘT lần rồi dừng stack, giải tar ngược vào
             volume cùng tên. Cách này mang theo cả dữ liệu lẫn secret, nhưng
             bắt buộc trùng image PostgreSQL ({pg_image}).
- Sau khi máy mới chạy ổn, nhớ bật lại lịch sao lưu tự động 12:20 trên máy mới.
========================================================================
"""

URLS = {
    "web_local": f"http://localhost:{PORTS['nextjs']}",
    "web_dev": f"http://localhost:{PORTS['nextjs_dev']}",
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


def kill_process_on_port(port: int):
    """Tìm và tắt chính xác tiến trình đang chiếm port cụ thể trên Windows"""
    try:
        out = subprocess.check_output(f"netstat -ano | findstr :{port}", shell=True, text=True, stderr=subprocess.DEVNULL)
        pids = set()
        for line in out.strip().splitlines():
            parts = line.split()
            if len(parts) >= 5 and "LISTENING" in parts:
                pids.add(parts[-1])
        for pid in pids:
            if pid and pid != "0":
                subprocess.run(f"taskkill /F /PID {pid} /T", shell=True, capture_output=True)
    except Exception:
        pass


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
        # Tự bám theo độ lớn màn hình: bảng nút đã gom gọn nên phần chiều dọc
        # thừa dồn hết cho khung nhật ký (trước đây bị 8 hàng nút chiếm gần hết).
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        win_w = max(1000, min(1260, sw - 24))
        # Trừ 100px cho thanh title + taskbar: nếu cửa sổ cao bằng màn hình thì
        # đáy khung nhật ký nằm khuất sau taskbar, nhìn vẫn như bị cụt.
        win_h = max(600, min(900, sh - 100))
        self.root.geometry(f"{win_w}x{win_h}+{max(0, (sw - win_w) // 2)}+8")
        self.root.minsize(min(940, sw - 40), min(560, sh - 140))
        self.root.configure(bg="#0f172a")

        self.proc_nextjs = None
        self.proc_nextjs_dev = None
        self.proc_tunnel = None
        self.is_starting_all = False
        self.is_stopping_all = False
        self.is_building = False
        self.is_backing_up = False
        self.is_restoring = False
        self.is_creating_installer = False
        self.is_archiving_project = False
        self.is_optimizing_dns = False
        self.last_auto_backup_date = None
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
            "Dev.TButton",
            background="#7c3aed",
            foreground="#ffffff",
            font=("Segoe UI", 11, "bold"),
            padding=8,
            borderwidth=0
        )
        style.map("Dev.TButton", background=[("active", "#6d28d9"), ("disabled", "#475569")])

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
            "Pack.TButton",
            background="#d97706",
            foreground="#ffffff",
            font=("Segoe UI", 9, "bold"),
            padding=5,
            borderwidth=0
        )
        style.map("Pack.TButton", background=[("active", "#b45309"), ("disabled", "#475569")])

        style.configure(
            "Archive.TButton",
            background="#0284c7",
            foreground="#ffffff",
            font=("Segoe UI", 9, "bold"),
            padding=5,
            borderwidth=0
        )
        style.map("Archive.TButton", background=[("active", "#0369a1"), ("disabled", "#475569")])

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
            "Dns.TButton",
            background="#0284c7",
            foreground="#ffffff",
            font=("Segoe UI", 9, "bold"),
            padding=5,
            borderwidth=0
        )
        style.map("Dns.TButton", background=[("active", "#0369a1"), ("disabled", "#475569")])

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
        header_frame = tk.Frame(self.root, bg="#1e293b", height=70, padx=20, pady=6)
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
        main_container = tk.Frame(self.root, bg="#0f172a", padx=16, pady=8)
        main_container.pack(fill=tk.BOTH, expand=True)

        # 2.1 BẢNG ĐIỀU KHIỂN & CHỌN CHẾ ĐỘ
        top_grid = tk.Frame(main_container, bg="#0f172a")
        top_grid.pack(fill=tk.X, pady=(0, 10))

        # Cột trái: Điều khiển & Chế độ chạy
        actions_card = tk.Frame(top_grid, bg="#1e293b", padx=14, pady=12, highlightthickness=1, highlightbackground="#334155")
        # fill=Y (không expand) để thẻ này giữ đúng bề rộng tự nhiên của 3 cột nút,
        # cột phải nhận phần còn lại. Nếu cho expand, nút dài nhất sẽ bị cắt chữ.
        actions_card.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 8))

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

        # 15 nút chia đều 3 cột x 5 hàng. Trước đây mỗi hàng 2 nút = 8 hàng,
        # khung nhật ký bị dồn xuống còn non một dòng nên không đọc được gì.
        btn_grid = tk.Frame(btn_box, bg="#1e293b")
        btn_grid.pack(fill=tk.X)
        for col in range(3):
            btn_grid.columnconfigure(col, weight=1, uniform="btn_cell")

        self.btn_start_all = ttk.Button(btn_grid, text="🚀 CHẠY HỆ THỐNG (:3000)", style="Primary.TButton", command=self.start_all_services)
        self.btn_dev = ttk.Button(btn_grid, text="🛠️ BẬT DEV (:3001)", style="Dev.TButton", command=self.toggle_dev_server)
        self.btn_stop_all = ttk.Button(btn_grid, text="🛑 DỪNG TẤT CẢ", style="Danger.TButton", command=self.stop_all_services)

        self.btn_build = ttk.Button(btn_grid, text="🔨 Build Lại Web", style="Link.TButton", command=self.build_production)
        self.btn_backup = ttk.Button(btn_grid, text="💾 SAO LƯU (Tự động 12:20)", style="Backup.TButton", command=self.backup_database)
        self.btn_restore = ttk.Button(btn_grid, text="📥 NẠP / PHỤC HỒI CSDL", style="Success.TButton", command=self.restore_database)

        self.btn_doctor = ttk.Button(btn_grid, text="🩺 BÁC SĨ MÔI TRƯỜNG", style="Doctor.TButton", command=self.open_environment_doctor)
        self.btn_domain = ttk.Button(btn_grid, text="🌐 QUẢN LÝ TÊN MIỀN", style="Domain.TButton", command=self.open_domain_manager)
        self.btn_optimize_dns = ttk.Button(btn_grid, text="⚡ TỐI ƯU DNS & XOÁ CACHE", style="Dns.TButton", command=self.optimize_dns_and_flush_cache)

        self.btn_restart_tunnel = ttk.Button(btn_grid, text="🔄 KHỞI ĐỘNG LẠI TUNNEL", style="Link.TButton", command=self.restart_tunnel)
        self.btn_open_backup = ttk.Button(btn_grid, text="📂 Xem Thư Mục Backup", style="Link.TButton", command=self.open_backup_folder)
        self.btn_open_guide = ttk.Button(btn_grid, text="📖 Hướng Dẫn Cloudflare", style="Link.TButton", command=self.open_docs_guide)

        self.btn_pack_exe = ttk.Button(btn_grid, text="📦 ĐÓNG GÓI CÀI ĐẶT (EXE)", style="Pack.TButton", command=self.create_installer_exe)
        self.btn_pack_drive = ttk.Button(btn_grid, text="🗜️ NÉN CHO DRIVE (RAR/ZIP)", style="Archive.TButton", command=self.pack_project_for_drive)
        # Nút chuyển máy khác nút DRIVE ở chỗ nó KHÔNG loại trừ thư mục backups/
        self.btn_pack_move = ttk.Button(btn_grid, text="🚚 NÉN ĐỂ CHUYỂN MÁY (KÈM CSDL)", style="Archive.TButton", command=self.pack_project_for_migration)

        hang_nut = [
            [self.btn_start_all, self.btn_dev, self.btn_stop_all],
            [self.btn_build, self.btn_backup, self.btn_restore],
            [self.btn_doctor, self.btn_domain, self.btn_optimize_dns],
            [self.btn_restart_tunnel, self.btn_open_backup, self.btn_open_guide],
            [self.btn_pack_exe, self.btn_pack_drive, self.btn_pack_move],
        ]
        for r, hang in enumerate(hang_nut):
            for c, nut in enumerate(hang):
                nut.grid(row=r, column=c, sticky="ew", padx=3, pady=3)

        # Cột phải: Bảng trạng thái dịch vụ + phím tắt truy cập nhanh
        right_col = tk.Frame(top_grid, bg="#0f172a")
        right_col.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(8, 0))

        status_card = tk.Frame(right_col, bg="#1e293b", padx=14, pady=8, highlightthickness=1, highlightbackground="#334155")
        status_card.pack(fill=tk.X)

        tk.Label(status_card, text="📊 TRẠNG THÁI DỊCH VỤ", font=("Segoe UI", 10, "bold"), fg="#f1f5f9", bg="#1e293b").pack(anchor="w", pady=(0, 6))

        self.status_labels = {}
        services = [
            ("docker", "🐳 Docker Desktop Engine"),
            ("supabase", "🗄️ Supabase Local (DB & API :64321)"),
            ("nextjs", "⚡ Web Production (:3000)"),
            ("nextjs_dev", "🛠️ Web Development (:3001)"),
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

        # 2.2 PHÍM TẮT TRUY CẬP NHANH - nằm gọn trong cột phải để dành chiều dọc cho nhật ký
        links_card = tk.Frame(right_col, bg="#1e293b", padx=14, pady=8, highlightthickness=1, highlightbackground="#334155")
        links_card.pack(fill=tk.X, pady=(10, 0))

        tk.Label(links_card, text="🔗 TRUY CẬP NHANH TRÊN TRÌNH DUYỆT", font=("Segoe UI", 9, "bold"), fg="#94a3b8", bg="#1e293b").pack(anchor="w", pady=(0, 6))

        links_grid = tk.Frame(links_card, bg="#1e293b")
        links_grid.pack(fill=tk.X)
        for c in range(3):
            links_grid.columnconfigure(c, weight=1, uniform="link_cell")

        quick_links = [
            ("⚡ Web Prod (:3000)", "web_local"),
            ("🛠️ Web Dev (:3001)", "web_dev"),
            ("🗄️ Supabase Studio", "studio_local"),
            ("📧 Test Mailpit", "mail_local"),
            ("🌍 chanhthu.click", "domain_chanhthu"),
            ("🌍 sarita.click", "domain_sarita"),
        ]
        for i, (label, url_key) in enumerate(quick_links):
            ttk.Button(
                links_grid, text=label, style="Link.TButton",
                command=lambda k=url_key: webbrowser.open(URLS[k])
            ).grid(row=i // 3, column=i % 3, sticky="ew", padx=3, pady=2)

        # 2.3 KHUNG NHẬT KÝ (LOG VIEWER)
        logs_card = tk.Frame(main_container, bg="#1e293b", padx=14, pady=6, highlightthickness=1, highlightbackground="#334155")
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
            height=12,
            relief="flat",
            padx=8,
            pady=6
        )
        self.log_text.pack(fill=tk.BOTH, expand=True)

        self.log("ℹ️ Trình quản lý Server Modular WMS đã sẵn sàng.")
        self.log(f"📁 Thư mục dự án: {PROJECT_DIR}")
        self.log("⏰ Lịch tự động sao lưu dữ liệu CSDL: 12:20 hằng ngày.")

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

            nextjs_dev_ok = is_port_open(PORTS["nextjs_dev"])
            self.root.after(0, self._update_status_ui, "nextjs_dev", nextjs_dev_ok, "● HOẠT ĐỘNG", "○ TẮT")

            if hasattr(self, "btn_dev"):
                if nextjs_dev_ok:
                    self.root.after(0, lambda: self.btn_dev.configure(text="🛑 TẮT DEV (:3001)", style="Danger.TButton"))
                else:
                    self.root.after(0, lambda: self.btn_dev.configure(text="🛠️ BẬT DEV (:3001)", style="Dev.TButton"))

            tunnel_ok = (self.proc_tunnel is not None and self.proc_tunnel.poll() is None)
            self.root.after(0, self._update_status_ui, "tunnel", tunnel_ok, "● KẾT NỐI", "○ TẮT")

            # Tự động sao lưu dữ liệu CSDL vào đúng 12:20 hằng ngày
            now = time.localtime()
            today_str = time.strftime("%Y-%m-%d", now)
            if now.tm_hour == 12 and now.tm_min == 20:
                if self.last_auto_backup_date != today_str and not self.is_backing_up:
                    self.last_auto_backup_date = today_str
                    self.log("⏰ [LỊCH HẸN 12:20] Đã đến giờ tự động sao lưu dữ liệu CSDL...")
                    threading.Thread(target=self._backup_database_worker, kwargs={"is_auto": True}, daemon=True).start()

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

    def _run_supabase_dump(self, backup_file: Path) -> tuple[bool, str]:
        """Chạy Supabase CLI xuất toàn bộ dữ liệu (data-only) ra file .sql. Trả về (thành_công, thông_báo_lỗi)."""
        # Dọn file tạm telemetry để tránh lỗi FileSystem.rename của Supabase CLI trên Windows
        try:
            supabase_home = Path.home() / ".supabase"
            if supabase_home.exists():
                for tmp_f in supabase_home.glob("telemetry.json.tmp.*"):
                    try:
                        tmp_f.unlink(missing_ok=True)
                    except Exception:
                        pass
        except Exception:
            pass

        dump_env = os.environ.copy()
        dump_env["DO_NOT_TRACK"] = "1"
        dump_env["SUPABASE_TELEMETRY"] = "false"

        cmd = f'cmd.exe /c npx.cmd supabase db dump --local --data-only -f "{str(backup_file)}"'
        res = subprocess.run(
            cmd,
            cwd=str(PROJECT_DIR),
            shell=True,
            capture_output=True,
            text=True,
            env=dump_env,
            timeout=180
        )

        if res.returncode == 0 and backup_file.exists() and backup_file.stat().st_size > 0:
            return True, ""
        return False, (res.stderr or res.stdout or "Không xuất được file")

    def _psql_local(self, sql: str, timeout: int = 120) -> subprocess.CompletedProcess:
        """Chạy câu SQL trên PostgreSQL Local và trả kết quả về máy host."""
        return subprocess.run(
            ["docker", "exec", "-i", SUPABASE_DB_CONTAINER, "psql",
             "-U", "postgres", "-d", "postgres", "-t", "-A", "-F", "|"],
            input=sql,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout
        )

    def _list_db_tables(self) -> set:
        """Liệt kê toàn bộ bảng nghiệp vụ đang tồn tại trong CSDL Local (dạng schema.bang)."""
        schema_list = "','".join(RESTORE_SCHEMAS)
        sql = (
            "select n.nspname||'.'||c.relname from pg_class c "
            "join pg_namespace n on n.oid = c.relnamespace "
            f"where n.nspname in ('{schema_list}') and c.relkind in ('r','p');"
        )
        res = self._psql_local(sql)
        if res.returncode != 0:
            return set()
        return {ln.strip() for ln in (res.stdout or "").splitlines() if ln.strip()}

    @staticmethod
    def _parse_backup_tables(file_path: str) -> dict:
        """Đọc file backup, trả về {tên_bảng: số_dòng_mà_file_đáng_lẽ_sinh_ra}.

        pg_dump chế độ data-only viết mỗi bảng thành một câu INSERT nhiều dòng,
        mỗi dòng dữ liệu nằm trên một dòng bắt đầu bằng TAB.
        """
        pattern = re.compile(r'^INSERT INTO "([A-Za-z0-9_]+)"\."([A-Za-z0-9_]+)"')
        counts = {}
        current = None
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                m = pattern.match(line)
                if m:
                    current = f"{m.group(1)}.{m.group(2)}"
                    counts[current] = 0
                    if line.rstrip().endswith(");"):
                        counts[current] = 1
                        current = None
                    continue
                if current is None:
                    continue
                if line.startswith("\t"):
                    counts[current] += 1
                if line.rstrip().endswith(";"):
                    current = None
        return counts

    def _verify_restore(self, expected: dict, wipe_tables: list) -> tuple:
        """Đối chiếu số dòng thực tế trong CSDL với số dòng file backup đáng lẽ phải sinh ra.

        Trả về (danh_sách_lệch, tổng_dong_kỳ_vọng, tổng_dong_thực_tế).
        Danh sách rỗng nghĩa là phục hồi khớp tuyệt đối.
        """
        tables = sorted(set(expected) | set(wipe_tables))
        parts = [
            f"select '{t}' as tbl, count(*) as n from \"{t.split('.', 1)[0]}\".\"{t.split('.', 1)[1]}\""
            for t in tables
        ]
        res = self._psql_local(" union all ".join(parts) + ";", timeout=300)
        if res.returncode != 0:
            return [("? - không đếm được: " + (res.stderr or "").strip()[:120])], 0, 0

        actual = {}
        for line in (res.stdout or "").splitlines():
            if "|" not in line:
                continue
            tbl, _, n = line.strip().rpartition("|")
            try:
                actual[tbl] = int(n)
            except ValueError:
                continue

        mismatches = []
        for t in tables:
            want = expected.get(t, 0)
            got = actual.get(t)
            if got is None:
                mismatches.append(f"{t}: không đọc được số dòng")
            elif got != want:
                mismatches.append(f"{t}: kỳ vọng {want}, thực tế {got}")

        total_want = sum(expected.get(t, 0) for t in tables)
        total_got = sum(actual.get(t, 0) for t in tables)
        return mismatches, total_want, total_got

    def _backup_database_worker(self, is_auto: bool = False):
        log_prefix = "⏰ [TỰ ĐỘNG 12:20]" if is_auto else "💾"
        self.log(f"{log_prefix} ================= BẮT ĐẦU SAO LƯU DỮ LIỆU CSDL =================")
        try:
            backup_dir = self.get_backup_dir()
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            backup_file = backup_dir / f"backup_supabase_{timestamp}.sql"

            self.log(f"📦 Đang xuất dữ liệu từ Supabase Local ra: {backup_file.name}...")

            ok, err_msg = self._run_supabase_dump(backup_file)

            if ok:
                file_size_kb = round(backup_file.stat().st_size / 1024, 2)
                self.log(f"✅ {log_prefix} Sao lưu CSDL THÀNH CÔNG! Dung lượng: {file_size_kb} KB")
                self.log(f"📁 File đã lưu tại: {str(backup_file)}")
                if not is_auto:
                    self.root.after(0, lambda: messagebox.showinfo(
                        "Sao Lưu Thành Công",
                        f"Đã sao lưu toàn bộ dữ liệu CSDL thành công!\n\nFile: {backup_file.name} ({file_size_kb} KB)\nThư mục: {str(backup_dir)}"
                    ))
            else:
                err_msg = res.stderr or res.stdout or "Không xuất được file"
                self.log(f"❌ Lỗi khi sao lưu: {err_msg}")
                if not is_auto:
                    self.root.after(0, lambda: messagebox.showerror("Lỗi Sao Lưu", f"Không thể sao lưu dữ liệu:\n{err_msg}"))
        except Exception as e:
            self.log(f"❌ Ngoại lệ khi sao lưu: {e}")
            if not is_auto:
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
            title="Chọn file sao lưu CSDL (.sql) để phục hồi vào hệ thống",
            filetypes=[("SQL Files (*.sql)", "*.sql"), ("Tất Cả Các File (*.*)", "*.*")],
            initialdir=str(backup_dir)
        )
        if not file_path:
            return

        # Kiểm tra tiền đề TRƯỚC khi cho phép ghi: file này có gì, CSDL hiện tại có nhận được không
        try:
            backup_tables = self._parse_backup_tables(file_path)
        except Exception as e:
            messagebox.showerror("Lỗi Đọc File", f"Không đọc được file backup:\n{e}")
            return

        if not backup_tables:
            messagebox.showerror(
                "File Không Hợp Lệ",
                "Không tìm thấy câu INSERT dữ liệu nào trong file này.\n\nFile có thể rỗng, hoặc được tạo bởi công cụ khác không phải nút SAO LƯU."
            )
            return

        db_tables = self._list_db_tables()
        if not db_tables:
            messagebox.showerror("Lỗi Kết Nối", "Không đọc được danh sách bảng từ CSDL Supabase Local.")
            return

        missing = sorted(t for t in backup_tables if t not in db_tables)
        if missing:
            preview = "\n".join(missing[:10]) + ("\n..." if len(missing) > 10 else "")
            messagebox.showerror(
                "Không Tương Thích Với Cấu Trúc Hiện Tại",
                f"File backup này cần {len(missing)} bảng mà CSDL hiện tại không có:\n\n{preview}\n\n"
                "File được sao lưu từ một phiên bản cấu trúc khác.\n"
                "KHÔNG THỂ phục hồi bằng nút này — cần chạy migration đúng phiên bản trước."
            )
            return

        wipe_tables = sorted(db_tables - RESTORE_PROTECTED_TABLES)
        only_now = sorted(set(wipe_tables) - set(backup_tables))

        note = ""
        if only_now:
            note = (f"\n\n{len(only_now)} bảng KHÔNG có trong file backup nên sau khi phục hồi sẽ ở trạng thái rỗng\n"
                    f"(ở thời điểm sao lưu chúng chưa có dữ liệu). Nếu chúng đang có dữ liệu tạo sau đó, phần này sẽ mất:\n"
                    + ", ".join(only_now[:8]) + ("\n..." if len(only_now) > 8 else ""))

        confirm = messagebox.askyesno(
            "Xác Nhận Phục Hồi CSDL",
            f"File nguồn: {Path(file_path).name}\n"
            f"Số bảng sẽ được phục hồi: {len(backup_tables)}\n\n"
            f"⚠️ TOÀN BỘ dữ liệu hiện tại của {len(wipe_tables)} bảng sẽ bị XÓA trước khi nạp.\n"
            f"Hệ thống sẽ trở về đúng trạng thái lúc sao lưu. Mọi dữ liệu tạo sau đó sẽ mất.\n"
            f"Ứng dụng web sẽ tạm thời không truy vấn được trong lúc nạp."
            + note
            + "\n\n(Tự động sao lưu trạng thái hiện tại trước khi ghi để có thể hoàn tác.)"
        )
        if not confirm:
            self.log("⛔ Đã hủy: người dùng không xác nhận phục hồi CSDL.")
            return

        typed = messagebox.askstring(
            "Xác Nhận Lần Cuối",
            "Thao tác này XÓA toàn bộ dữ liệu hiện tại.\n\nGõ đúng chữ NAP để tiếp tục:",
            parent=self.root
        )
        if (typed or "").strip().upper() != "NAP":
            self.log("⛔ Đã hủy: không có xác nhận NAP.")
            return

        self.is_restoring = True
        self.btn_restore.configure(state="disabled")
        threading.Thread(target=self._restore_database_worker, args=(file_path, wipe_tables, backup_tables), daemon=True).start()

    def _restore_database_worker(self, file_path: str, wipe_tables: list, expected: dict):
        p = Path(file_path)
        self.log(f"📥 ================= BẮT ĐẦU PHỤC HỒI CSDL TỪ: {p.name} =================")
        err_file = None
        try:
            # BƯỚC 1 - An toàn: phải có bản sao lưu trạng thái hiện tại trước khi ghi đè
            safety_file = self.get_backup_dir() / f"pre_restore_{time.strftime('%Y%m%d_%H%M%S')}.sql"
            self.log(f"🛡️ Đang sao lưu dữ liệu hiện tại để phòng hoàn tác: {safety_file.name}...")
            ok, err_msg = self._run_supabase_dump(safety_file)
            if not ok:
                self.log(f"❌ KHÔNG THỂ sao lưu dữ liệu hiện tại: {err_msg}\n>>> Dừng lại, CSDL chưa bị thay đổi một dòng nào.")
                self.root.after(0, lambda: messagebox.showerror(
                    "Đã Hủy Phục Hồi",
                    f"Không sao lưu được dữ liệu hiện tại nên hệ thống KHÔNG ghi gì cả.\n\n{err_msg[:300]}"
                ))
                return
            self.log(f"✅ Đã giữ lại trạng thái hiện tại tại: {safety_file.name}")

            # BƯỚC 2 - Nạp: làm trống rồi ghi lại, TẤT CẢ TRONG MỘT TRANSACTION
            preamble = (
                "SET session_replication_role = replica;\n"
                "TRUNCATE TABLE "
                + ", ".join(f'"{s}"."{t}"' for s, t in (w.split(".", 1) for w in wipe_tables))
                + ";\n"
            )

            file_size_kb = round(p.stat().st_size / 1024, 2)
            self.log(f"📦 Kích thước file: {file_size_kb} KB. Đang nạp (transaction đơn, dừng ngay khi có lỗi)...")

            err_fd, err_path = tempfile.mkstemp(prefix="restore_err_", suffix=".txt")
            err_file = Path(err_path)
            started = time.time()
            with os.fdopen(err_fd, "wb") as err_stream, open(file_path, "rb") as sql_stream:
                proc = subprocess.Popen(
                    ["docker", "exec", "-i", SUPABASE_DB_CONTAINER, "psql",
                     "-U", "postgres", "-d", "postgres",
                     "-v", "ON_ERROR_STOP=1", "--single-transaction", "-q"],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.DEVNULL,
                    stderr=err_stream,
                )
                try:
                    proc.stdin.write(preamble.encode("utf-8"))
                    shutil.copyfileobj(sql_stream, proc.stdin, 1024 * 1024)
                except BrokenPipeError:
                    pass
                finally:
                    try:
                        proc.stdin.close()
                    except Exception:
                        pass
                try:
                    rc = proc.wait(timeout=900)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    raise RuntimeError("Quá trình nạp vượt quá 900 giây và đã bị dừng.")
            elapsed = round(time.time() - started, 1)

            err_out = err_file.read_text(encoding="utf-8", errors="replace")
            error_lines = [ln for ln in err_out.splitlines() if ln.startswith("ERROR:")]

            # BƯỚC 3 - Phán quyết dựa trên lỗi THỰC TẾ, không chỉ mã thoát
            if rc == 0 and not error_lines:
                self.log(f"✅ Nạp xong sau {elapsed}s. Đang ĐỐI CHIẾU SỐ DÒNG từng bảng với file backup...")
                mismatches, want_total, got_total = self._verify_restore(expected, wipe_tables)
                checked = len(set(expected) | set(wipe_tables))
                if not mismatches:
                    self.log(f"✅ PHỤC HỒI THÀNH CÔNG & KHỚP TUYỆT ĐỐI: {checked} bảng, {got_total} dòng, "
                             f"không bảng nào lệch so với file {p.name}.")
                    self.root.after(0, lambda: messagebox.showinfo(
                        "Phục Hồi Thành Công (đã kiểm chứng)",
                        f"Đã đối chiếu tự động {checked} bảng với file backup:\n"
                        f"Tổng số dòng khớp tuyệt đối: {got_total:,} dòng\n\n"
                        f"Không có bảng nào bị lệch. Thời gian: {elapsed}s\n\n"
                        f"Nếu đây KHÔNG phải dữ liệu bạn muốn, trạng thái trước khi nạp nằm ở:\n{safety_file.name}"
                    ))
                else:
                    preview = "\n".join(mismatches[:12]) + ("\n..." if len(mismatches) > 12 else "")
                    self.log(f"⚠️ Nạp xong nhưng LỆCH {len(mismatches)}/{checked} bảng. "
                             f"Kỳ vọng {want_total} dòng, thực tế {got_total}:\n{preview}")
                    self.root.after(0, lambda: messagebox.showwarning(
                        "Phục Hồi XONG nhưng SỐ LIỆU LỆCH",
                        f"{len(mismatches)}/{checked} bảng có số dòng KHÁC file backup:\n\n{preview}\n\n"
                        f"Tổng kỳ vọng: {want_total:,} dòng | Thực tế: {got_total:,} dòng\n\n"
                        f"Dữ liệu đã ghi thành công nhưng KHÔNG trùng bản sao lưu.\n"
                        f"Trạng thái TRƯỚC khi nạp vẫn còn ở: {safety_file.name}\n"
                        f"Nếu muốn hoàn tác, nạp lại chính file đó."
                    ))
            else:
                reason = error_lines[0] if error_lines else f"psql thoát với mã {rc}"
                self.log(f"❌ PHỤC HỒI THẤT BẠI sau {elapsed}s: {reason}\n>>> Toàn bộ thay đổi đã được ROLLBACK, CSDL vẫn nguyên như trước.")
                self.root.after(0, lambda: messagebox.showerror(
                    "Phục Hồi THẤT BẠI (đã hoàn tác)",
                    f"CSDL của bạn VẪN NGUYÊN trạng thái cũ vì giao dịch đã bị rollback.\n\nLỗi đầu tiên:\n{reason[:400]}\n\n"
                    f"Bản sao lưu dự phòng: {safety_file.name}"
                ))
        except Exception as e:
            self.log(f"❌ Ngoại lệ khi nạp CSDL: {e}")
            self.root.after(0, lambda: messagebox.showerror("Lỗi Nạp CSDL", f"Không thể nạp dữ liệu: {e}"))
        finally:
            if err_file is not None:
                try:
                    err_file.unlink(missing_ok=True)
                except Exception:
                    pass
            self.is_restoring = False
            self.root.after(0, lambda: self.btn_restore.configure(state="normal"))

    def create_installer_exe(self):
        """Đóng gói toàn bộ hệ thống thành 1 file cài đặt All-In-One (EXE) qua Inno Setup"""
        if self.is_creating_installer:
            return
        self.is_creating_installer = True
        self.btn_pack_exe.configure(state="disabled")
        threading.Thread(target=self._create_installer_worker, daemon=True).start()

    def _create_installer_worker(self):
        self.log("📦 ================= BẮT ĐẦU ĐÓNG GÓI BẢN CÀI ĐẶT ALL-IN-ONE (EXE) =================")
        iscc_paths = [
            Path(os.path.expanduser(r"~\AppData\Local\Programs\Inno Setup 6\ISCC.exe")),
            Path(r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe"),
            Path(r"C:\Program Files\Inno Setup 6\ISCC.exe"),
        ]
        iscc_exe = None
        for p in iscc_paths:
            if p.exists():
                iscc_exe = p
                break

        if not iscc_exe:
            self.log("❌ Lỗi: Không tìm thấy trình biên dịch Inno Setup 6 (ISCC.exe) trên máy!")
            self.root.after(0, lambda: messagebox.showerror(
                "Thiếu Inno Setup 6",
                "Không tìm thấy Inno Setup 6!\nVui lòng cài đặt Inno Setup 6 để đóng gói file cài đặt."
            ))
            self.is_creating_installer = False
            self.root.after(0, lambda: self.btn_pack_exe.configure(state="normal"))
            return

        iss_file = PROJECT_DIR / "installer_config.iss"
        if not iss_file.exists():
            self.log(f"❌ Lỗi: Không tìm thấy file cấu hình {iss_file.name}!")
            self.is_creating_installer = False
            self.root.after(0, lambda: self.btn_pack_exe.configure(state="normal"))
            return

        self.log(f"🔨 Đang biên dịch bộ cài đặt bằng Inno Setup ({iscc_exe.name})...")
        self.log("⏳ Quá trình nén toàn bộ mã nguồn + build + CSDL sẽ mất 1 - 3 phút, vui lòng chờ...")

        try:
            cmd = f'"{str(iscc_exe)}" "{str(iss_file)}"'
            proc = subprocess.Popen(
                cmd,
                cwd=str(PROJECT_DIR),
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            )
            for line in iter(proc.stdout.readline, ""):
                if line:
                    clean = line.strip()
                    if clean:
                        self.log(f"[InnoSetup] {clean}")
                if not self.running_loop:
                    break
            proc.wait()

            dist_installer_dir = PROJECT_DIR / "dist_installer"
            if proc.returncode == 0:
                self.log("✅ ĐÓNG GÓI BẢN CÀI ĐẶT THÀNH CÔNG 100%!")
                created_file = None
                if dist_installer_dir.exists():
                    files = list(dist_installer_dir.glob("*.exe"))
                    if files:
                        created_file = max(files, key=lambda f: f.stat().st_mtime)

                file_info = ""
                if created_file and created_file.exists():
                    size_mb = round(created_file.stat().st_size / (1024 * 1024), 2)
                    file_info = f"\nFile: {created_file.name} ({size_mb} MB)"
                    self.log(f"📁 Vị trí: {created_file} ({size_mb} MB)")

                if dist_installer_dir.exists() and sys.platform == "win32":
                    os.startfile(str(dist_installer_dir))

                self.root.after(0, lambda: messagebox.showinfo(
                    "Đóng Gói Thành Công",
                    f"Đã tạo file cài đặt All-In-One thành công!{file_info}\n\nThư mục: {str(dist_installer_dir)}"
                ))
            else:
                self.log(f"❌ Quá trình đóng gói thất bại với mã lỗi {proc.returncode}!")
        except Exception as e:
            self.log(f"❌ Ngoại lệ khi đóng gói: {e}")
        finally:
            self.is_creating_installer = False
            self.root.after(0, lambda: self.btn_pack_exe.configure(state="normal"))

    def pack_project_for_drive(self):
        """Nén toàn bộ thư mục dự án thành file RAR (hoặc ZIP) để đồng bộ Google Drive"""
        if self.is_archiving_project:
            return
        self.is_archiving_project = True
        self.btn_pack_drive.configure(state="disabled")
        threading.Thread(target=self._pack_project_for_drive_worker, daemon=True).start()

    def _pack_project_for_drive_worker(self):
        self.log("🗜️ ================= BẮT ĐẦU NÉN DỰ ÁN CHO GOOGLE DRIVE =================")
        try:
            backup_dir = self.get_backup_dir()
            timestamp = time.strftime("%Y%m%d_%H%M%S")

            winrar_paths = [
                Path(r"C:\Program Files\WinRAR\Rar.exe"),
                Path(r"C:\Program Files\WinRAR\WinRAR.exe"),
                Path(r"C:\Program Files (x86)\WinRAR\Rar.exe"),
            ]
            winrar_exe = None
            for p in winrar_paths:
                if p.exists():
                    winrar_exe = p
                    break

            if winrar_exe:
                out_file = backup_dir / f"ModularWMS_Full_{timestamp}.rar"
                self.log("⚡ Phát hiện WinRAR! Đang sử dụng chuẩn nén RAR5 (chỉ nén mã nguồn & node_modules, không nén thư mục build .next)...")
                self.log(f"📦 Đang tạo file nén: {out_file.name} (Vui lòng đợi trong giây lát)...")
                # Loại bỏ: backups, dist_installer, và toàn bộ thư mục build .next
                # Khi giải nén sang máy mới, chỉ cần mở Launcher lên bấm "Build Production" là xong!
                cmd = f'"{str(winrar_exe)}" a -r -s -m3 -ep1 -x"backups\\*" -x"dist_installer\\*" -x".next\\*" "{str(out_file)}" *'
            else:
                out_file = backup_dir / f"ModularWMS_Full_{timestamp}.zip"
                self.log("ℹ️ Đang sử dụng PowerShell để nén file ZIP...")
                self.log(f"📦 Đang tạo file nén: {out_file.name}...")
                ps_script = f"$dest = '{str(out_file)}'; Compress-Archive -Path (Get-ChildItem -Path '.' -Exclude 'backups','dist_installer','.next') -DestinationPath $dest -CompressionLevel Optimal"
                cmd = f'powershell.exe -NoProfile -Command "{ps_script}"'

            proc = subprocess.run(cmd, cwd=str(PROJECT_DIR), shell=True, capture_output=True, text=True, timeout=1800)

            if out_file.exists() and out_file.stat().st_size > 0:
                size_mb = round(out_file.stat().st_size / (1024 * 1024), 2)
                self.log(f"✅ Nén dự án THÀNH CÔNG! Dung lượng file: {size_mb} MB")
                self.log(f"📁 Đường dẫn: {str(out_file)}")
                if sys.platform == "win32":
                    os.startfile(str(backup_dir))

                self.root.after(0, lambda: messagebox.showinfo(
                    "Nén Thành Công (Google Drive)",
                    f"Đã nén toàn bộ thư mục dự án thành công!\n\nFile: {out_file.name} ({size_mb} MB)\nĐã sẵn sàng tải lên Google Drive!\nThư mục: {str(backup_dir)}"
                ))
            else:
                err_msg = proc.stderr or proc.stdout or "Không tạo được file nén"
                self.log(f"❌ Lỗi khi nén: {err_msg}")
                self.root.after(0, lambda: messagebox.showerror("Lỗi Nén Dự Án", f"Không thể nén dự án:\n{err_msg}"))
        except Exception as e:
            self.log(f"❌ Ngoại lệ khi nén: {e}")
            self.root.after(0, lambda: messagebox.showerror("Lỗi Ngoại Lệ", f"Lỗi: {e}"))
        finally:
            self.is_archiving_project = False
            self.root.after(0, lambda: self.btn_pack_drive.configure(state="normal"))

    def pack_project_for_migration(self):
        """Đóng gói CẢ thư mục dự án lẫn ảnh chụp CSDL để bê sang máy tính khác"""
        if self.is_archiving_project:
            return
        self.is_archiving_project = True
        self.btn_pack_drive.configure(state="disabled")
        self.btn_pack_move.configure(state="disabled")
        threading.Thread(target=self._pack_project_for_migration_worker, daemon=True).start()

    def _pg_image_tag(self) -> str:
        res = subprocess.run(
            ["docker", "inspect", SUPABASE_DB_CONTAINER, "--format", "{{.Config.Image}}"],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30,
        )
        return (res.stdout or "").strip() or "không đọc được"

    def _pack_project_for_migration_worker(self):
        self.log("🚚 ================= BẮT ĐẦU NÉN ĐỂ CHUYỂN MÁY (KÈM CSDL) =================")
        try:
            backup_dir = self.get_backup_dir()
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            dump_file = backup_dir / f"migration_dump_{timestamp}.sql"

            # BƯỚC 1 - Ảnh chụp CSDL. Thiếu nó thì gói nén chỉ là mã nguồn: kho trống rỗng.
            self.log(f"📦 [1/3] Đang xuất ảnh chụp CSDL ra: {dump_file.name} ...")
            ok, err_msg = self._run_supabase_dump(dump_file)
            if not ok:
                self.log(f"❌ KHÔNG xuất được ảnh CSDL: {err_msg}\n>>> Dừng lại, chưa tạo gói nén nào.")
                self.root.after(0, lambda: messagebox.showerror(
                    "Chưa tạo gói chuyển máy",
                    f"Không xuất được ảnh CSDL nên gói nén sẽ vô nghĩa (máy mới chỉ có mã nguồn, kho trống).\n\n"
                    f"Lỗi: {err_msg}\n\nKiểm tra Supabase Local đã chạy chưa rồi bấm lại."
                ))
                return

            expected = self._parse_backup_tables(str(dump_file))
            db_tables = len(expected)
            db_rows = sum(expected.values())
            self.log(f"✅ Ảnh CSDL OK: {db_tables} bảng có dữ liệu, {db_rows} dòng, {round(dump_file.stat().st_size/1024/1024, 1)} MB")

            # BƯỚC 2 - Gói nén: KHÔNG loại trừ backups/, nhưng loại archive cũ để tránh nén lồng nén
            winrar_exe = None
            for p in (Path(r"C:\Program Files\WinRAR\Rar.exe"),
                      Path(r"C:\Program Files\WinRAR\WinRAR.exe"),
                      Path(r"C:\Program Files (x86)\WinRAR\Rar.exe")):
                if p.exists():
                    winrar_exe = p
                    break

            checklist_file = backup_dir / "CHECKLIST_CHUYEN_MAY.txt"
            pg_image = self._pg_image_tag()

            if winrar_exe:
                out_file = backup_dir / f"ModularWMS_ChuyenMay_{timestamp}.rar"
                self.log("🗜️ [2/3] WinRAR: nén mã nguồn + node_modules + cả ảnh CSDL (bỏ .next, .rar/.zip cũ)...")
                cmd = (
                    f'"{str(winrar_exe)}" a -r -s -m3 -ep1 '
                    f'-x"backups\\*.rar" -x"backups\\*.zip" -x"backups\\.tmp.driveupload*" '
                    f'-x"dist_installer\\*" -x".next\\*" "{str(out_file)}" *'
                )
            else:
                out_file = backup_dir / f"ModularWMS_ChuyenMay_{timestamp}.zip"
                self.log("🗜️ [2/3] Không có WinRAR, dùng PowerShell ZIP (ảnh CSDL nằm ở gốc file zip)...")
                ps = (
                    "$dest = '" + str(out_file) + "'; "
                    "$root = @(Get-ChildItem -Force -Path '.' | Where-Object { $_.Name -notin @('backups','dist_installer','.next') }); "
                    "$data = @(Get-ChildItem -Path 'backups\\*' -Include '*.sql','CHECKLIST_CHUYEN_MAY.txt' -Force); "
                    "Compress-Archive -Path ($root + $data) -DestinationPath $dest -CompressionLevel Optimal"
                )
                cmd = f'powershell.exe -NoProfile -Command "{ps}"'

            # Checklist ghi TRƯỚC để nó được nén vào luôn
            checklist_file.write_text(
                build_migration_checklist_text(
                    out_file.name, dump_file.name, 0, db_tables, db_rows, pg_image
                ),
                encoding="utf-8-sig",
            )
            self.log(f"📝 Đã ghi {checklist_file.name} (số MB sẽ cập nhật sau khi nén xong)")

            proc = subprocess.run(cmd, cwd=str(PROJECT_DIR), shell=True, capture_output=True, text=True,
                                  encoding="utf-8", errors="replace", timeout=5400)

            if not (out_file.exists() and out_file.stat().st_size > 0):
                err_msg = (proc.stderr or proc.stdout or "Không tạo được file nén").strip()
                self.log(f"❌ Lỗi khi nén: {err_msg[:400]}")
                self.root.after(0, lambda: messagebox.showerror("Lỗi Nén Chuyển Máy", f"Không tạo được gói nén:\n{err_msg[:800]}"))
                return

            # Ghi lại checklist lần cuối với dung lượng thật
            size_mb = round(out_file.stat().st_size / (1024 * 1024), 2)
            checklist_file.write_text(
                build_migration_checklist_text(
                    out_file.name, dump_file.name, size_mb, db_tables, db_rows, pg_image
                ),
                encoding="utf-8-sig",
            )

            self.log(f"✅ GÓI CHUYỂN MÁY SẴN SÀNG: {out_file.name} ({size_mb} MB)")
            self.log(f"   Bên trong có: {dump_file.name} ({db_tables} bảng có dữ liệu / {db_rows} dòng) + CHECKLIST_CHUYEN_MAY.txt")
            self.log(f"📁 {str(out_file)}")
            if sys.platform == "win32":
                os.startfile(str(backup_dir))
            self.root.after(0, lambda: messagebox.showinfo(
                "Gói Chuyển Máy Đã Xong",
                f"{out_file.name}\nDung lượng: {size_mb} MB\n\n"
                f"ĐÃ NHÚNG BÊN TRONG:\n• {dump_file.name}  ({db_tables} bảng, {db_rows} dòng)\n"
                f"• CHECKLIST_CHUYEN_MAY.txt (7 bước chạy trên máy mới)\n\n"
                f"HAI BẪY PHẢI LÀM TRÊN MÁY MỚI (checklist nhắc lại):\n"
                f"1) Key Supabase Local gắn với máy cũ -> phải chạy `npx supabase status`\n"
                f"   rồi dán anon_key + service_role mới vào .env.local, nếu không sẽ 401.\n"
                f"2) .next không có trong gói -> bấm 'Build Production' một lần.\n\n"
                f"Chú ý: file nén chứa mật khẩu/refresh token. Giữ riêng tư, không commit."
            ))
        except Exception as e:
            self.log(f"❌ Ngoại lệ khi nén chuyển máy: {e}")
            self.root.after(0, lambda: messagebox.showerror("Lỗi Ngoại Lệ", f"Lỗi: {e}"))
        finally:
            self.is_archiving_project = False
            self.root.after(0, lambda: self.btn_pack_drive.configure(state="normal"))
            self.root.after(0, lambda: self.btn_pack_move.configure(state="normal"))

    def build_production(self):
        """Build lại bản production Next.js"""
        if self.is_building:
            return
        self.is_building = True
        self.btn_build.configure(state="disabled")
        threading.Thread(target=self._build_production_worker, daemon=True).start()

    def _build_production_worker(self):
        self.log("🔨 ================= BẮT ĐẦU BUILD PRODUCTION (npm run build) =================")

        # 1. Tự động kiểm tra và tắt bản Dev (:3001) nếu người dùng đang mở
        if is_port_open(PORTS["nextjs_dev"]) or (self.proc_nextjs_dev and self.proc_nextjs_dev.poll() is None):
            self.log("ℹ️ Phát hiện bản Dev (:3001) đang chạy. Đang tự động tắt Dev để tránh xung đột file lock...")
            try:
                if self.proc_nextjs_dev and self.proc_nextjs_dev.poll() is None:
                    subprocess.run(f"taskkill /F /PID {self.proc_nextjs_dev.pid} /T", shell=True, capture_output=True)
                    self.proc_nextjs_dev = None
                kill_process_on_port(PORTS["nextjs_dev"])
                time.sleep(1)
                self.log("✅ Đã tắt bản Dev (:3001) an toàn.")
            except Exception as e:
                self.log(f"⚠️ Lỗi tắt Dev: {e}")

        # 2. Tạm dừng bản Production (:3000) cũ để tránh xung đột file lock thư mục .next
        if is_port_open(PORTS["nextjs"]):
            self.log("ℹ️ Đang tạm dừng Web Production cổng 3000 cũ để tránh xung đột file lock...")
            try:
                if self.proc_nextjs and self.proc_nextjs.poll() is None:
                    subprocess.run(f"taskkill /F /PID {self.proc_nextjs.pid} /T", shell=True, capture_output=True)
                    self.proc_nextjs = None
                kill_process_on_port(PORTS["nextjs"])
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

    def toggle_dev_server(self):
        """Bật hoặc Tắt nhanh chế độ Dev Server (:3001) độc lập"""
        if is_port_open(PORTS["nextjs_dev"]):
            self.log("🛑 Đang tắt Next.js Dev Server (:3001)...")
            try:
                if self.proc_nextjs_dev and self.proc_nextjs_dev.poll() is None:
                    subprocess.run(f"taskkill /F /PID {self.proc_nextjs_dev.pid} /T", shell=True, capture_output=True)
                    self.proc_nextjs_dev = None
                kill_process_on_port(PORTS["nextjs_dev"])
                self.log("✅ Đã tắt Next.js Dev Server (:3001).")
            except Exception as e:
                self.log(f"⚠️ Lỗi tắt Dev Server: {e}")
        else:
            threading.Thread(target=self._start_dev_worker, daemon=True).start()

    def _start_dev_worker(self):
        self.log("🛠️ ================= BẮT ĐẦU KHỞI CHẠY DEV SERVER (:3001) =================")
        # Tự động kiểm tra Docker & Supabase để Dev có CSDL hoạt động
        if not (is_port_open(PORTS["supabase_api"]) and is_port_open(PORTS["supabase_studio"])):
            if not is_docker_ready():
                self.log("🐳 Docker chưa chạy. Vui lòng bật Docker Desktop hoặc dùng nút Chạy Hệ Thống!")
            else:
                self.log("📦 Supabase chưa chạy. Đang tự động bật Supabase Local...")
                try:
                    subprocess.run("cmd.exe /c npx.cmd supabase start", cwd=str(PROJECT_DIR), shell=True, capture_output=True, timeout=120)
                except Exception:
                    pass

        if is_port_open(PORTS["nextjs_dev"]):
            kill_process_on_port(PORTS["nextjs_dev"])
            time.sleep(1)

        try:
            cmd = "cmd.exe /c npm.cmd run dev"
            self.log("🛠️ Đang thực thi 'npm run dev' trên cổng 3001...")
            self.proc_nextjs_dev = subprocess.Popen(
                cmd,
                cwd=str(PROJECT_DIR),
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            )
            threading.Thread(target=self._stream_proc_logs, args=(self.proc_nextjs_dev, "[Next.js-Dev]"), daemon=True).start()

            for _ in range(25):
                if is_port_open(PORTS["nextjs_dev"]):
                    break
                time.sleep(1)

            if is_port_open(PORTS["nextjs_dev"]):
                self.log(f"✅ Next.js Dev đã online tại {URLS['web_dev']}!")
                webbrowser.open(URLS["web_dev"])
            else:
                self.log("⚠️ Next.js Dev đang khởi chạy ngầm...")
        except Exception as e:
            self.log(f"❌ Lỗi khởi động Dev: {e}")

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
        target_port = PORTS["nextjs"] if mode == "prod" else PORTS["nextjs_dev"]
        port_label = "3000 (Production)" if mode == "prod" else "3001 (Dev)"

        if is_port_open(target_port):
            self.log(f"ℹ️ Đang giải phóng cổng {port_label} cũ để áp dụng phiên bản mới...")
            try:
                kill_process_on_port(target_port)
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
                self.log("⚡ Đang khởi động Next.js Production Server cổng 3000 (npm run start)...")
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
                threading.Thread(target=self._stream_proc_logs, args=(self.proc_nextjs, "[Next.js-Prod]"), daemon=True).start()
            else:
                cmd_start = "cmd.exe /c npm.cmd run dev"
                self.log("🛠️ Đang khởi động Next.js Dev Server cổng 3001 (npm run dev)...")
                self.proc_nextjs_dev = subprocess.Popen(
                    cmd_start,
                    cwd=str(PROJECT_DIR),
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
                )
                threading.Thread(target=self._stream_proc_logs, args=(self.proc_nextjs_dev, "[Next.js-Dev]"), daemon=True).start()

            for _ in range(25):
                if is_port_open(target_port):
                    break
                time.sleep(1)

            if is_port_open(target_port):
                url_online = URLS["web_local"] if mode == "prod" else URLS["web_dev"]
                self.log(f"✅ Next.js Web App ({mode.upper()}) đã online tại {url_online}!")
            else:
                self.log(f"⚠️ Next.js ({mode.upper()}) đang khởi chạy ngầm...")
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
            self.log("🛑 Đang dừng Next.js Production (:3000)...")
            try:
                subprocess.run(f"taskkill /F /PID {self.proc_nextjs.pid} /T", shell=True, capture_output=True)
                self.proc_nextjs = None
                self.log("✅ Đã tắt Next.js Production.")
            except Exception as e:
                self.log(f"⚠️ Lỗi tắt Next.js Production: {e}")

        if self.proc_nextjs_dev and self.proc_nextjs_dev.poll() is None:
            self.log("🛑 Đang dừng Next.js Dev (:3001)...")
            try:
                subprocess.run(f"taskkill /F /PID {self.proc_nextjs_dev.pid} /T", shell=True, capture_output=True)
                self.proc_nextjs_dev = None
                self.log("✅ Đã tắt Next.js Dev.")
            except Exception as e:
                self.log(f"⚠️ Lỗi tắt Next.js Dev: {e}")

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

    def optimize_dns_and_flush_cache(self):
        """Tối ưu hóa DNS (1.1.1.1 / 1.0.0.1 / 8.8.8.8) và xóa sạch bộ đệm DNS Cache"""
        if getattr(self, "is_optimizing_dns", False):
            messagebox.showinfo("Đang Xử Lý", "Hệ thống đang tiến hành tối ưu DNS, vui lòng đợi trong giây lát...")
            return

        self.is_optimizing_dns = True
        if hasattr(self, "btn_optimize_dns"):
            self.btn_optimize_dns.configure(state="disabled")
        threading.Thread(target=self._optimize_dns_worker, daemon=True).start()

    def _optimize_dns_worker(self):
        try:
            self.log("🌐 ================= TỐI ƯU DNS & XOÁ BỘ NHỚ ĐỆM DNS =================")
            self.log("🧹 1️⃣ Đang làm sạch bộ nhớ đệm DNS hệ thống (Flush DNS Cache)...")

            # 1. Flush DNS cache
            subprocess.run(["powershell", "-NoProfile", "-Command", "Clear-DnsClientCache"], capture_output=True, text=True)
            subprocess.run("ipconfig /flushdns", shell=True, capture_output=True, text=True)
            self.log("✅ Đã làm sạch toàn bộ bộ nhớ đệm DNS Cache thành công!")

            # 2. Kiểm tra DNS hiện tại
            self.log("🔍 2️⃣ Đang kiểm tra cấu hình DNS của các card mạng đang hoạt động...")
            ps_check_cmd = "Get-DnsClientServerAddress -AddressFamily IPv4 | Select-Object -ExpandProperty ServerAddresses"
            res_dns = subprocess.run(["powershell", "-NoProfile", "-Command", ps_check_cmd], capture_output=True, text=True)
            current_dns = res_dns.stdout.strip().replace("\n", ", ")
            self.log(f"📋 DNS hiện tại: [{current_dns if current_dns else 'Chưa xác định'}]")

            # 3. Áp dụng DNS 1.1.1.1, 1.0.0.1, 8.8.8.8
            self.log("⚡ 3️⃣ Đang thiết lập DNS Cloudflare (1.1.1.1, 1.0.0.1) & Google (8.8.8.8)...")
            ps_set_cmd = (
                "Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.InterfaceDescription -notmatch 'Virtual|Hyper-V|vEthernet' } "
                "| ForEach-Object { Set-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -ServerAddresses ('1.1.1.1','1.0.0.1','8.8.8.8') }; "
                "Clear-DnsClientCache"
            )

            set_ok = False
            try:
                r_set = subprocess.run(["powershell", "-NoProfile", "-Command", ps_set_cmd], capture_output=True, text=True)
                if r_set.returncode == 0:
                    set_ok = True
            except Exception:
                pass

            if not set_ok:
                self.log("🔑 Đang yêu cầu quyền Administrator để cấu hình card mạng Windows...")
                try:
                    script_content = (
                        f"Write-Host 'Dang thiet lap DNS 1.1.1.1 / 1.0.0.1 / 8.8.8.8...' -ForegroundColor Cyan; "
                        f"{ps_set_cmd}; "
                        f"Write-Host '[THANH CONG] Da cap nhat DNS va xoa cache!' -ForegroundColor Green; "
                        f"Start-Sleep -Seconds 2"
                    )
                    ctypes.windll.shell32.ShellExecuteW(
                        None,
                        "runas",
                        "powershell.exe",
                        f"-NoProfile -Command \"{script_content}\"",
                        None,
                        1
                    )
                    time.sleep(2.5)
                    set_ok = True
                except Exception as ex:
                    self.log(f"⚠️ Yêu cầu quyền Admin: {ex}")

            # 4. Kiểm tra phân giải tên miền Cloudflare Tunnel
            self.log("🚀 4️⃣ Đang kiểm tra tốc độ phân giải tên miền Cloudflare Tunnel...")
            t0 = time.time()
            res_resolve = subprocess.run(
                ["powershell", "-NoProfile", "-Command", "Resolve-DnsName region1.v2.argotunnel.com"],
                capture_output=True, text=True, timeout=6
            )
            elapsed_ms = int((time.time() - t0) * 1000)

            if res_resolve.returncode == 0:
                self.log(f"✅ Tốc độ phân giải DNS cực nhanh ({elapsed_ms}ms)! Domain Tunnel đã sẵn sàng.")
            else:
                self.log("⚠️ Phân giải thử nghiệm mất nhiều thời gian, nhưng các DNS mới đã được lưu.")

            # 5. Khởi động lại Tunnel nếu đang chạy để áp dụng DNS mới
            if self.proc_tunnel and self.proc_tunnel.poll() is None:
                self._restart_tunnel_if_running("sau khi tối ưu DNS")

            self.log("🎉 Hoàn tất quá trình Tối ưu DNS & Xóa Cache!")
            self.root.after(0, lambda: messagebox.showinfo(
                "Tối Ưu DNS Thành Công",
                "Hệ thống đã thực hiện:\n\n"
                "1. Xóa sạch bộ nhớ đệm DNS hệ thống (Flush DNS Cache).\n"
                "2. Cấu hình DNS Cloudflare (1.1.1.1, 1.0.0.1) & Google (8.8.8.8).\n"
                "3. Kiểm tra phân giải tên miền Cloudflare Tunnel.\n\n"
                "Từ bây giờ Tunnel sẽ hoạt động ổn định, tránh triệt để lỗi i/o timeout do mạng nhà mạng!"
            ))
        except Exception as e:
            self.log(f"❌ Lỗi tối ưu DNS: {e}")
            self.root.after(0, lambda: messagebox.showerror("Lỗi", f"Không thể hoàn tất tối ưu DNS: {e}"))
        finally:
            self.is_optimizing_dns = False
            if hasattr(self, "btn_optimize_dns"):
                self.root.after(0, lambda: self.btn_optimize_dns.configure(state="normal"))

    def restart_tunnel(self):
        """Khởi động lại riêng Cloudflare Tunnel từ nút bấm trên giao diện"""
        if self.proc_tunnel and self.proc_tunnel.poll() is None:
            threading.Thread(target=lambda: self._restart_tunnel_if_running("người dùng yêu cầu"), daemon=True).start()
        else:
            self.log("🚇 Đang khởi chạy Cloudflare Tunnel...")
            def _start_tun():
                try:
                    ensure_tunnel_ready()
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
                    self.log("✅ Cloudflare Tunnel đã kết nối thành công!")
                except Exception as e:
                    self.log(f"❌ Lỗi khởi động Tunnel: {e}")
            threading.Thread(target=_start_tun, daemon=True).start()

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
            text="⚡ Cài Docker (winget)" if not (docker_installed or docker_running) else "✅ Đã Có Docker",
            style="Doctor.TButton" if not (docker_installed or docker_running) else "Success.TButton",
            state="normal" if not (docker_installed or docker_running) else "disabled",
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
        node_check_targets = [
            shutil.which("node"),
            r"C:\Program Files\nodejs\node.exe",
            r"C:\Program Files (x86)\nodejs\node.exe",
            os.path.expandvars(r"%APPDATA%\npm\node.cmd"),
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\node\node.exe"),
        ]
        detected_version = None
        for candidate in node_check_targets:
            if not candidate:
                continue
            cand_p = Path(candidate)
            if not cand_p.exists():
                continue
            try:
                n_res = subprocess.run(
                    [str(cand_p), "-v"],
                    capture_output=True,
                    text=True,
                    timeout=3,
                    creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
                )
                if n_res.returncode == 0 and n_res.stdout.strip():
                    detected_version = n_res.stdout.strip()
                    break
            except Exception:
                pass

        if not detected_version:
            try:
                n_res = subprocess.run(
                    "cmd.exe /c node.exe -v",
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=3,
                    creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
                )
                if n_res.returncode == 0 and n_res.stdout.strip():
                    detected_version = n_res.stdout.strip()
            except Exception:
                pass

        if detected_version:
            node_status = f"✅ Đã cài đặt ({detected_version})"
            node_color = "#22c55e"

        row2 = tk.Frame(items_box, bg="#1e293b", padx=12, pady=10, highlightthickness=1, highlightbackground="#334155")
        row2.pack(fill=tk.X, pady=(0, 8))
        tk.Label(row2, text="🌐 Node.js LTS (Bắt buộc cho Web App Next.js):", font=("Segoe UI", 9, "bold"), fg="#f8fafc", bg="#1e293b").pack(side=tk.LEFT)
        tk.Label(row2, text=node_status, font=("Segoe UI", 9, "bold"), fg=node_color, bg="#1e293b").pack(side=tk.LEFT, padx=10)

        btn_install_node = ttk.Button(
            row2,
            text="⚡ Cài Node.js (winget)" if node_color == "#ef4444" else "✅ Đã Có Node.js",
            style="Doctor.TButton" if node_color == "#ef4444" else "Success.TButton",
            state="normal" if node_color == "#ef4444" else "disabled",
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

        # 5. Cấu hình DNS Máy Tính
        dns_status = "Đang kiểm tra..."
        dns_color = "#94a3b8"
        try:
            ps_d = subprocess.run(["powershell", "-NoProfile", "-Command", "Get-DnsClientServerAddress -AddressFamily IPv4 | Select-Object -ExpandProperty ServerAddresses"], capture_output=True, text=True, timeout=2)
            if "1.1.1.1" in ps_d.stdout:
                dns_status = "✅ Tối ưu (Cloudflare 1.1.1.1)"
                dns_color = "#22c55e"
            else:
                dns_status = "⚠️ Đang dùng DNS thường (dễ bị timeout)"
                dns_color = "#eab308"
        except Exception:
            dns_status = "ℹ️ Đã tối ưu"
            dns_color = "#22c55e"

        row_dns = tk.Frame(items_box, bg="#1e293b", padx=12, pady=10, highlightthickness=1, highlightbackground="#334155")
        row_dns.pack(fill=tk.X, pady=(0, 8))
        tk.Label(row_dns, text="🌐 Cấu hình DNS Máy tính (Khuyên dùng 1.1.1.1):", font=("Segoe UI", 9, "bold"), fg="#f8fafc", bg="#1e293b").pack(side=tk.LEFT)
        tk.Label(row_dns, text=dns_status, font=("Segoe UI", 9, "bold"), fg=dns_color, bg="#1e293b").pack(side=tk.LEFT, padx=10)
        ttk.Button(
            row_dns,
            text="⚡ Tối Ưu DNS (1.1.1.1)",
            style="Doctor.TButton",
            command=self.optimize_dns_and_flush_cache
        ).pack(side=tk.RIGHT)

        # 6. Tiện ích tạo Shortcut Desktop
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
