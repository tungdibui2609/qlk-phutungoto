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

# Ngân sách chờ Docker Engine trả lời khi vừa bật máy. Docker Desktop lạnh có thể
# mất 1-2 phút (WSL2 khởi động VM), nên bản cũ chờ ~40 lần x 2s là quá hẹp và
# hay báo sai "chưa sẵn sàng" trong lúc nó sắp lên.
DOCKER_WAIT_SECONDS = 180
DOCKER_POLL_SECONDS = 3

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

# Số ảnh chụp CSDL giữ lại khi dùng nút "Dọn backup cũ".
# Mỗi bản ~70-140 MB, để tích tụ cả năm sẽ ngốn hàng chục GB trên máy.
BACKUP_KEEP_COUNT = 14


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


def wait_ports_open(ports, seconds: float = 30.0, interval: float = 1.0) -> list[int]:
    """Chờ tới khi các cổng cùng mở. Trả về danh sách cổng VẪN đóng (rỗng = tất cả đã mở)."""
    pending = set(int(p) for p in ports)
    deadline = time.time() + seconds
    while pending and time.time() < deadline:
        pending = {p for p in pending if not is_port_open(p)}
        if pending:
            time.sleep(interval)
    return sorted(pending)


def taskkill_tree(pid: int, timeout: float = 15.0) -> bool:
    """Dừng tiến trình chỉ định kèm cây con của NÓ.

    Dùng /PID chứ không /IM cloudflared.exe vì /IM giết mọi cloudflared của máy,
    kể cả tunnel của dịch vụ khác đang chạy song song.
    """
    try:
        res = subprocess.run(
            f"taskkill /F /PID {int(pid)} /T",
            shell=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
        return res.returncode == 0
    except Exception:
        return False


def kill_process_on_port(port: int) -> list[int]:
    """Tắt tiến trình đang NGHE trên đúng port này. Trả về danh sách PID đã bắn."""
    try:
        res = subprocess.run(
            "netstat -ano",
            shell=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=20,
        )
        out = res.stdout or ""
    except Exception:
        return []

    pids = set()
    for line in out.splitlines():
        parts = line.split()
        if len(parts) < 5 or not parts[0].upper().startswith("TCP"):
            continue
        # Đuôi ":3000" trước đây khớp cả ":30001"; nay so đúng cột port.
        if parts[3].upper() != "LISTENING" or parts[1].rsplit(":", 1)[-1] != str(port):
            continue
        if parts[-1] != "0":
            pids.add(parts[-1])

    killed = []
    for pid in pids:
        try:
            if taskkill_tree(int(pid)):
                killed.append(int(pid))
        except ValueError:
            continue
    return killed


def docker_engine_status(timeout: int = 8) -> tuple:
    """Hỏi Docker Engine bằng 'docker info' và trả (sẵn_sàng, lý_do).

    Dùng --format {{.ServerVersion}} vì 'docker info' thường in ra cả mục Client
    dù daemon đã chết, nên "stdout có nội dung" KHÔNG phải bằng chứng engine
    sống. Với --format, rc=0 chỉ khi chính engine trả lời, và stdout là version
    để báo cho người dùng biết đang chờ cái gì.
    """
    try:
        res = subprocess.run(
            ["docker", "info", "--format", "{{.ServerVersion}}"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        )
    except FileNotFoundError:
        return False, "không tìm thấy lệnh 'docker' trong PATH của launcher"
    except subprocess.TimeoutExpired:
        return False, f"engine không trả lời trong {timeout}s"
    except Exception as e:
        return False, f"không gọi được docker info: {e}"

    if res.returncode == 0:
        ver = (res.stdout or "").strip()
        return True, f"Docker Engine {ver}" if ver else "Docker Engine"

    err = " ".join((res.stderr or res.stdout or "").split())
    return False, (err[:180] or f"docker info exit code {res.returncode}")


def docker_desktop_app_running() -> bool:
    """Docker Desktop có đang chạy không (kể cả đang khởi động nội bộ).

    com.docker.backend.exe là tiến trình nền do Docker Desktop sinh ra; thấy nó
    nghĩa là app đã mở => không được Popen thêm lần nữa.
    """
    try:
        # Bộ lọc của tasklist viết là IMAGENAME (không phải "IMAGES"): sai một chữ
        # là nó báo "The search filter cannot be recognized" và hàm này trả False
        # oan, khiến launcher mở Docker Desktop lần hai dù app đang chạy.
        res = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq com.docker.backend.exe"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=15,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        )
        return "com.docker.backend" in (res.stdout or "")
    except Exception:
        return False


def is_docker_ready(timeout: int = 4) -> bool:
    ok, _ = docker_engine_status(timeout=timeout)
    return ok


def ensure_tunnel_ready() -> tuple[bool, str]:
    """Tự động sao chép credentials và config Tunnel vào ~/.cloudflared nếu chưa có.

    Trả về (đã ổn chưa, mô tả). Bản cũ nuốt mọi exception rồi để mặc định 'True',
    nên nút "Đồng Bộ Cấu Hình Ngay" báo Thành Công cả khi thư mục nguồn không tồn tại.
    """
    try:
        cf_dir = Path(os.path.expanduser(r"~\.cloudflared"))
        cf_dir.mkdir(parents=True, exist_ok=True)
        if not TUNNEL_SETUP_DIR.exists():
            return False, f"Không tìm thấy thư mục cấu hình Tunnel: {TUNNEL_SETUP_DIR}"
        copied, skipped, failed = [], 0, []
        for item in TUNNEL_SETUP_DIR.glob("*"):
            if item.is_file() and item.suffix != ".exe":
                dest = cf_dir / item.name
                if dest.exists():
                    skipped += 1
                    continue
                try:
                    shutil.copy2(item, dest)
                    copied.append(item.name)
                except Exception as e:
                    failed.append(f"{item.name}: {e}")
        if failed:
            return False, "Không sao chép được: " + "; ".join(failed)
        detail = f"Đã chép {len(copied)} file ({', '.join(copied)})" if copied else f"Đã đủ {skipped} file sẵn trong ~/.cloudflared"
        return True, detail
    except Exception as e:
        return False, str(e)


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


def _strip_disabled_marker(host_value: str) -> str:
    """Cắt phần chú thích khỏi giá trị hostname (dòng đã tắt mang dạng 'x  # ...')."""
    return host_value.split("#", 1)[0].strip().lower()


def _hostname_matches(line_clean: str, target: str) -> bool:
    """Dòng này có thuộc rule của đúng tên miền cần thao tác hay không?

    So khớp cả hostname con (www./api.) nhưng bắt buộc có dấu chấm chặn trước,
    nên 'thu.click' không nhầm vào 'chanhthu.click'.
    """
    if "hostname:" not in line_clean:
        return False
    raw = _strip_disabled_marker(line_clean.split("hostname:", 1)[1])
    return raw == target or raw.endswith("." + target)


def _is_service_line(line_clean: str) -> bool:
    return line_clean.startswith("- service:") or (
        line_clean.startswith("#") and "- service:" in line_clean
    )


def _comment_belongs_to_domain(line_clean: str, target: str) -> bool:
    """Chú thích có nhắc riêng đến tên miền này (đối chiếu từng domain token, không so chuỗi con)."""
    tokens = re.findall(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+", line_clean.lower())
    return any(t == target or t.endswith("." + target) for t in tokens)


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


def read_tunnel_domains() -> tuple[list[dict], str]:
    """Đọc tên miền + trạng thái Bật/Tắt kèm lỗi (nếu không đọc được file).

    Bản cũ trả sẵn 'chanhthu.click' + 'sarita.click' đang BẬT mỗi khi parse ra
    kết quả rỗng, nên một file config hỏng/yêu vẫn hiển thị như hệ thống bình
    thường và che mất sự cố thật.
    """
    targets = get_tunnel_config_targets()
    cfg_file = targets[0] if targets else (TUNNEL_SETUP_DIR / "config.yml")
    if not cfg_file.exists():
        return [], ""

    try:
        content = cfg_file.read_text(encoding="utf-8-sig")
    except Exception as e:
        return [], f"Không đọc được file cấu hình Tunnel '{cfg_file}': {e}"

    domain_map = {}
    for line in content.splitlines():
        line_clean = line.strip()
        if "hostname:" not in line_clean:
            continue
        raw_host = _strip_disabled_marker(line_clean.split("hostname:", 1)[1])
        base = extract_base_domain(raw_host)
        if not base or "." not in base:
            continue
        if base not in domain_map:
            domain_map[base] = {"has_active": False, "has_disabled": False}
        if "[DISABLED]" in line_clean or "[TAT]" in line_clean:
            domain_map[base]["has_disabled"] = True
        else:
            domain_map[base]["has_active"] = True

    result = [
        {"domain": d, "enabled": info["has_active"]}
        for d, info in sorted(domain_map.items())
    ]
    return result, ""


def get_all_domains_with_status() -> list[dict]:
    """
    Đọc tất cả tên miền trong config.yml cùng trạng thái Bật/Tắt (enabled).
    Trả về: [{'domain': 'chanhthu.click', 'enabled': True}, ...]
    """
    domains, _ = read_tunnel_domains()
    return domains


def _tunnel_yaml_usable(text: str) -> tuple[bool, str]:
    """Kiểm tra nhanh config sau sửa vẫn là YAML hợp lệ.

    Máy chưa có PyYAML thì coi như 'không kiểm chứng được' và trả về hợp lệ,
    không chặn thao tác của người dùng chỉ vì thiếu thư viện.
    """
    try:
        import yaml  # type: ignore
    except Exception:
        return True, ""
    try:
        data = yaml.safe_load(text)
    except Exception as e:
        return False, f"YAML không hợp lệ: {e}"
    if not isinstance(data, dict) or "ingress" not in data:
        return False, "Cấu hình sau khi sửa không còn khóa 'ingress' - file đã hỏng."
    ingress = data.get("ingress")
    if not isinstance(ingress, list):
        return False, "Khóa 'ingress' không còn là danh sách rule."
    return True, ""


def write_tunnel_config(p: Path, new_text: str) -> str:
    """Backup rồi ghi config.yml bằng phép đổi tên nguyên tử; tự khôi phục nếu file hỏng.

    write_text() trực tiếp để lại file cụt khi tiến trình bị giết giữa chừng, và
    cloudflared đọc ingress hỏng thì toàn bộ tên miền nhà máy bị 404.
    Trả về tên file backup; ném RuntimeError khi ghi thất bại (file cũ đã khôi phục).
    """
    stamp = time.strftime("%Y%m%d_%H%M%S")
    bak = p.with_name(f"{p.name}.bak_{stamp}")
    if p.exists():
        shutil.copy2(p, bak)

    tmp = p.with_name(f"{p.name}.new.tmp")
    try:
        tmp.write_text(new_text, encoding="utf-8", newline="\n")
        # Kiểm tra tính hợp lệ TRƯỚC khi replace: file gốc chưa hề bị động chạm.
        ok, why = _tunnel_yaml_usable(new_text)
        if not ok:
            raise RuntimeError(f"{why} Đã giữ nguyên file cũ.")
        os.replace(tmp, p)
    except Exception as e:
        try:
            if tmp.exists():
                tmp.unlink()
        except OSError:
            pass
        raise RuntimeError(str(e)) from e

    for old in sorted(p.parent.glob(f"{p.name}.bak_*"))[:-5]:
        try:
            old.unlink()
        except OSError:
            pass
    return bak.name


def get_configured_domains() -> list[str]:
    """Đọc danh sách các tên miền ĐANG BẬT (active) trong Cloudflare Tunnel"""
    doms = get_all_domains_with_status()
    active = [d["domain"] for d in doms if d["enabled"]]
    return active if active else ["chanhthu.click", "sarita.click"]


def _walk_ingress_lines(content: str, target: str):
    """Duyệt từng dòng config, gắn cờ 'dòng này thuộc rule của tên miền cần thao tác'.

    Đi theo đúng cấu trúc block YAML của ingress: một hostname mở block, block
    đóng khi gặp '- service:' (catch-all) hoặc dòng trống, nên các dòng
    'service:' nằm ngay dưới hostname luôn thuộc cùng một block.
    """
    in_target_rule = False
    for line in content.splitlines():
        line_clean = line.strip()
        if "hostname:" in line_clean:
            in_target_rule = _hostname_matches(line_clean, target)
        elif _is_service_line(line_clean) or not line_clean:
            in_target_rule = False
        yield line, line_clean, in_target_rule


def _rebuild_text(lines: list[str], content: str) -> str:
    return "\n".join(lines) + ("\n" if content.endswith("\n") else "")


# Cờ "lần thao tác tên miền vừa rồi CÓ ghi file". UI cần giá trị này để quyết định
# có khởi động lại Tunnel hay không - restart vô nghĩa vẫn làm đứt traffic đang chạy.
LAST_TUNNEL_CONFIG_CHANGED = False


def toggle_domain_status(target_domain: str, enable: bool) -> tuple[bool, str]:
    """Bật hoặc Tắt một tên miền trong cấu hình Cloudflare Tunnel"""
    global LAST_TUNNEL_CONFIG_CHANGED
    LAST_TUNNEL_CONFIG_CHANGED = False
    target_clean = target_domain.strip().lower()
    targets = get_tunnel_config_targets()
    if not targets:
        return False, "Không tìm thấy file cấu hình config.yml của Cloudflare Tunnel!"

    found_any = False
    backups: list[str] = []
    for p in targets:
        try:
            content = p.read_text(encoding="utf-8-sig")
        except Exception as e:
            return False, f"Lỗi đọc file {p}: {e}"

        new_lines = []
        changed = 0
        found = False
        for line, line_clean, in_target_rule in _walk_ingress_lines(content, target_clean):
            if in_target_rule:
                found = True
            original = line
            if in_target_rule and line_clean:
                if enable:
                    if "# [DISABLED] " in line:
                        line = line.replace("# [DISABLED] ", "")
                    elif "# [DISABLED]" in line:
                        line = line.replace("# [DISABLED]", "")
                elif "[DISABLED]" not in line:
                    stripped = line.lstrip()
                    indent = line[: len(line) - len(stripped)]
                    line = f"{indent}# [DISABLED] {stripped}"
            if line != original:
                changed += 1
            new_lines.append(line)

        if not found:
            continue
        found_any = True
        if changed == 0:
            # Đã đúng trạng thái mong muốn: không được ghi file chỉ để báo "thành công".
            continue

        new_content = _rebuild_text(new_lines, content)
        try:
            backups.append(write_tunnel_config(p, new_content))
            LAST_TUNNEL_CONFIG_CHANGED = True
        except Exception as e:
            return False, f"Lỗi cập nhật file {p}: {e}"

    state_str = "BẬT" if enable else "TẮT"
    other_str = "TẮT" if enable else "BẬT"
    if not found_any:
        return False, (
            f"Không tìm thấy rule hostname nào của '{target_clean}' trong config.yml "
            f"- hệ thống không sửa gì cả."
        )
    if not backups:
        return True, f"Tên miền '{target_clean}' đang {state_str} sẵn, cấu hình giữ nguyên."

    # Đọc lại file vừa ghi: chỉ báo thành công khi trạng thái thật sự đổi.
    doms, err = read_tunnel_domains()
    if err:
        return False, f"Đã ghi file nhưng không đọc lại được để kiểm tra: {err}\nBackup: {', '.join(backups)}"
    now = next((d["enabled"] for d in doms if d["domain"] == target_clean), None)
    if now != enable:
        return False, (
            f"Đã ghi file nhưng kiểm tra lại thấy '{target_clean}' vẫn đang {other_str} "
            f"(đúng ra phải {state_str}).\nBackup: {', '.join(backups)}"
        )
    return True, f"Đã {state_str} tên miền '{target_clean}' (đã kiểm tra lại trong file config.yml)."


def delete_domain_from_tunnel(target_domain: str) -> tuple[bool, str]:
    """Xóa hoàn toàn một tên miền khỏi cấu hình Cloudflare Tunnel"""
    global LAST_TUNNEL_CONFIG_CHANGED
    LAST_TUNNEL_CONFIG_CHANGED = False
    target_clean = target_domain.strip().lower()
    targets = get_tunnel_config_targets()
    if not targets:
        return False, "Không tìm thấy file cấu hình config.yml!"

    found_any = False
    backups: list[str] = []
    for p in targets:
        try:
            content = p.read_text(encoding="utf-8-sig")
        except Exception as e:
            return False, f"Lỗi đọc file {p}: {e}"

        new_lines = []
        removed = 0
        found = False
        for line, line_clean, in_target_rule in _walk_ingress_lines(content, target_clean):
            if in_target_rule:
                found = True
            # Chỉ bỏ chú thích nhắc ĐÚNG tên miền này; so chuỗi con từng làm
            # 'thu.click' kéo theo xóa cả ghi chú của 'chanhthu.click'.
            if line_clean.startswith("#") and "hostname:" not in line_clean \
                    and _comment_belongs_to_domain(line_clean, target_clean):
                removed += 1
                continue
            if in_target_rule:
                removed += 1
                continue
            new_lines.append(line)

        if not found:
            continue
        found_any = True
        if removed == 0:
            continue

        new_content = _rebuild_text(new_lines, content)
        try:
            backups.append(write_tunnel_config(p, new_content))
            LAST_TUNNEL_CONFIG_CHANGED = True
        except Exception as e:
            return False, f"Lỗi xóa tên miền trong {p}: {e}"

    if not found_any:
        return False, f"Không tìm thấy rule hostname nào của '{target_clean}' - không xóa gì cả."
    if not backups:
        return True, f"Tên miền '{target_clean}' không còn trong cấu hình, giữ nguyên file."

    doms, err = read_tunnel_domains()
    if err:
        return False, f"Đã xóa nhưng không đọc lại được để kiểm tra: {err}\nBackup: {', '.join(backups)}"
    if any(d["domain"] == target_clean for d in doms):
        return False, (
            f"Đã ghi file nhưng kiểm tra lại vẫn còn thấy '{target_clean}'.\n"
            f"Backup: {', '.join(backups)}"
        )
    return True, f"Đã xóa hoàn toàn tên miền '{target_clean}' (đã kiểm tra lại trong file config.yml)."



def _insert_domain_rules(content: str, domain: str) -> str:
    """Chèn block rule của tên miền mới NGAY TRƯỚC catch-all 404 cuối file.

    Ba lý do không dùng str.replace như bản cũ:
      - replace đổi MỌI lần xuất hiện, trong khi chỉ có rule chót được phép thành rule chót;
      - bản cũ so '"- service: http_status:404" in content' nhưng lại replace chuỗi có
        2 dấu cách đầu dòng, nên file dùng indent khác (0 hoặc 4 space) bị bỏ qua im lặng;
      - indent block mới phải khớp block cũ, nếu không YAML vỡ và mọi tên miền cùng 404.
    """
    new_rules = (
        f"# Tên miền bổ sung: {domain}\n"
        f"- hostname: {domain}\n"
        f"  service: http://localhost:3000\n"
        f"- hostname: www.{domain}\n"
        f"  service: http://localhost:3000\n"
        f"- hostname: api.{domain}\n"
        f"  service: http://localhost:{PORTS['supabase_api']}\n"
    )
    catch_all = re.compile(r"(?m)^([ \t]*)- service: http_status:404[ \t]*$")
    matches = list(catch_all.finditer(content))
    if not matches:
        # Không có catch-all: suy indent theo rule hostname đang có (nếu không,
        # block chèn ở cột 0 sẽ làm YAML vỡ vì file này thụt 2 space).
        first_item = re.search(r"(?m)^([ \t]*)- hostname:", content)
        indent = first_item.group(1) if first_item else ""
        block = "".join(f"{indent}{line}\n" for line in new_rules.rstrip("\n").split("\n"))
        block += f"{indent}- service: http_status:404\n"
        return content.rstrip("\n") + "\n\n" + block

    m = matches[-1]
    indent = m.group(1)
    block = "".join(f"{indent}{line}\n" for line in new_rules.rstrip("\n").split("\n"))
    return content[: m.start()] + block + content[m.start():]



def _local_mdns_warning(domain: str) -> str:
    """Lời dặn đi kèm tên miền đuôi .local (Chrome/Edge giữ .local cho mDNS)."""
    if not domain.endswith(".local"):
        return ""
    return ("\n\n⚠️ Chrome/Edge giữ đuôi .local cho mDNS nên sẽ KHÔNG mở được tên miền này. "
            "Hãy dùng .test hoặc tên miền thật.")


def add_domain_to_tunnel(new_domain: str):
    """Thêm tên miền mới vào config.yml của Cloudflare Tunnel hoặc kích hoạt lại nếu đang tắt"""
    global LAST_TUNNEL_CONFIG_CHANGED
    LAST_TUNNEL_CONFIG_CHANGED = False
    domain = new_domain.strip().lower()
    domain = domain.replace("https://", "").replace("http://", "").split("/")[0]
    domain = domain.split(":")[0]
    if domain.startswith("www."):
        domain = domain[4:]

    if not domain or "." not in domain or len(domain) < 4:
        return False, "Tên miền không hợp lệ! Ví dụ đúng: khohangmoi.com hoặc wms.tencongty.vn"
    if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+", domain):
        return False, (
            f"'{domain}' không phải tên miền hợp lệ (chỉ cho phép a-z, 0-9, dấu chấm và gạch ngang)."
        )

    # Kiểm tra xem tên miền đã có chưa
    existing_domains = get_all_domains_with_status()
    for item in existing_domains:
        if item["domain"] == domain:
            if not item["enabled"]:
                # Tên miền đã có nhưng đang tắt -> Bật lại
                ok, msg = toggle_domain_status(domain, True)
                if ok:
                    return True, msg
                return False, msg
            else:
                return False, f"Tên miền '{domain}' đã tồn tại và đang BẬT sẵn!"

    # Dùng chung danh sách target với các thao tác khác. Bản cũ tự dựng danh sách
    # đường dẫn riêng nên mọi công cụ test/chặn ghi đều bỏ sót file thật
    # ~/.cloudflared/config.yml - chính đường này đã làm hỏng config thật.
    targets = get_tunnel_config_targets()
    if not targets:
        return False, "Chưa tìm thấy file config.yml để ghi cấu hình!"

    backups: list[str] = []
    for p in targets:
        try:
            content = p.read_text(encoding="utf-8-sig")
        except Exception as e:
            return False, f"Lỗi đọc file {p}: {e}"

        new_content = _insert_domain_rules(content, domain)
        try:
            backups.append(write_tunnel_config(p, new_content))
            LAST_TUNNEL_CONFIG_CHANGED = True
        except Exception as e:
            return False, f"Lỗi ghi file {p}: {e}"

    doms, err = read_tunnel_domains()
    if err:
        return False, f"Đã ghi file nhưng không đọc lại được để kiểm tra: {err}\nBackup: {', '.join(backups)}"
    if not any(d["domain"] == domain for d in doms):
        return False, (
            f"Đã ghi file nhưng kiểm tra lại KHÔNG thấy rule của '{domain}' trong config.yml.\n"
            f"Backup: {', '.join(backups)}"
        )
    return True, (
        f"Đã thêm mới và kích hoạt tên miền '{domain}' "
        f"(đã kiểm tra lại trong file config.yml)!{_local_mdns_warning(domain)}"
    )



class ServerManagerGUI:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Modular WMS - Server Controller & Environment Suite")
        # Tự bám theo độ lớn màn hình: bảng nút đã gom gọn nên phần chiều dọc
        # thừa dồn hết cho khung nhật ký (trước đây bị 8 hàng nút chiếm gần hết).
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        win_w = max(1000, min(1260, sw - 24))
        # Trừ 70px cho thanh title + taskbar: thử đo thực tế trên màn 1280x720 cho
        # thấy với sh-100 khung nhật ký chỉ nhận được 196px (8 dòng). Số còn lại
        # được giao hết cho nhật ký vì lưới nút đã gom còn 5 hàng.
        win_h = max(600, min(900, sh - 70))
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
        self.is_toggling_dev = False
        self.is_comparing_backup = False
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
        logs_card = tk.Frame(main_container, bg="#1e293b", padx=14, pady=4, highlightthickness=1, highlightbackground="#334155")
        logs_card.pack(fill=tk.BOTH, expand=True)

        log_head = tk.Frame(logs_card, bg="#1e293b")
        log_head.pack(fill=tk.X, pady=(0, 2))
        tk.Label(log_head, text="📜 NHẬT KÝ HOẠT ĐỘNG (REALTIME LOGS)", font=("Segoe UI", 9, "bold"), fg="#94a3b8", bg="#1e293b").pack(side=tk.LEFT)
        ttk.Button(log_head, text="🧹 Xóa nhật ký", style="Link.TButton", command=self.clear_logs).pack(side=tk.RIGHT)
        # Hai nút này đặt ở hàng tiêu đề nhật ký (thay vì thêm hàng thứ 6 vào lưới
        # 3x5) để khung nhật ký giữ nguyên chiều cao - người dùng từng phàn nàn
        # là không đọc được gì vì nhật ký bị ép còn một dòng.
        ttk.Button(log_head, text="📤 Lưu nhật ký ra file", style="Link.TButton", command=self.export_logs).pack(side=tk.RIGHT, padx=(0, 6))
        ttk.Button(log_head, text="🔎 So sánh backup ↔ CSDL", style="Link.TButton", command=self.compare_backup_with_db).pack(side=tk.RIGHT, padx=(0, 6))
        ttk.Button(log_head, text="🧹 Dọn backup cũ", style="Link.TButton", command=self.prune_old_backups).pack(side=tk.RIGHT, padx=(0, 6))

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
        try:
            self.report_backup_hygiene()
        except Exception as e:
            self.log(f"ℹ️ Chưa kiểm tra được thư mục backup: {e}")

    def log(self, message: str):
        timestamp = time.strftime("%H:%M:%S")
        formatted = f"[{timestamp}] {message}\n"
        self.root.after(0, self._append_log_text, formatted)

    def _append_log_text(self, text: str):
        try:
            if not self.log_text.winfo_exists():
                return
        except tk.TclError:
            return
        self.log_text.insert(tk.END, text)
        self.log_text.see(tk.END)

    def clear_logs(self):
        self.log_text.delete("1.0", tk.END)

    def export_logs(self):
        """Lưu toàn bộ khung nhật ký ra file .txt để dán cho người khác cùng soi lỗi."""
        content = self.log_text.get("1.0", tk.END).rstrip()
        if not content.strip():
            messagebox.showinfo("Nhật ký đang trống", "Chưa có dòng nhật ký nào để lưu.")
            return
        initial = f"nhat_ky_launcher_{time.strftime('%Y%m%d_%H%M%S')}.txt"
        target = filedialog.asksaveasfilename(
            title="Lưu nhật ký ra file",
            defaultextension=".txt",
            initialfile=initial,
            filetypes=[("Text (*.txt)", "*.txt"), ("Tất cả (*.*)", "*.*")],
        )
        if not target:
            return
        try:
            header = (
                f"NHẬT KÝ TRÌNH QUẢN LÝ SERVER - {time.strftime('%Y-%m-%d %H:%M:%S')}\n"
                f"Máy: {os.environ.get('COMPUTERNAME', '?')} | Python {sys.version.split()[0]}\n"
                f"Dự án: {PROJECT_DIR}\n"
                + "=" * 70 + "\n\n"
            )
            # utf-8-sig: Notepad trên Windows cần BOM mới hiển thị đúng tiếng Việt có dấu
            Path(target).write_text(header + content + "\n", encoding="utf-8-sig")
        except Exception as e:
            messagebox.showerror("Không lưu được", f"Lỗi khi ghi file:\n{e}")
            return
        self.log(f"📤 Đã lưu nhật ký ({len(content.splitlines())} dòng) ra: {target}")
        messagebox.showinfo("Đã lưu nhật ký", f"Toàn bộ nhật ký đã được lưu ra:\n{target}")

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

    @staticmethod
    def _human_size(nbytes: float) -> str:
        if nbytes >= 1024 ** 3:
            return f"{nbytes / 1024 ** 3:.2f} GB"
        if nbytes >= 1024 ** 2:
            return f"{nbytes / 1024 ** 2:.1f} MB"
        return f"{nbytes / 1024:.0f} KB"

    def _backup_files(self) -> list:
        """Liệt kê các file ảnh chụp CSDL trong thư mục backup, mới nhất trước."""
        patterns = ("backup_supabase_*.sql", "migration_dump_*.sql")
        files = []
        for pat in patterns:
            files.extend(self.get_backup_dir().glob(pat))
        return sorted(files, key=lambda p: p.stat().st_mtime, reverse=True)

    def report_backup_hygiene(self) -> dict:
        """Báo cáo trung thực tình trạng thư mục backup: bản mới nhất cách bao lâu,
        chiếm bao nhiêu dung lượng. Không xóa hay ghi gì.
        """
        files = self._backup_files()
        total = sum(f.stat().st_size for f in files)
        info = {"count": len(files), "total_bytes": total, "age_days": None, "newest": None}
        if not files:
            self.log("🗂️ Thư mục backup HIỆN ĐANG TRỐNG: chưa có ảnh chụp CSDL nào.")
            self.log("🚨 Rủi ro: nếu CSDL hỏng lúc này sẽ KHÔNG có gì để phục hồi. Bấm 💾 SAO LƯU ngay.")
            return info

        newest = files[0]
        age_days = (time.time() - newest.stat().st_mtime) / 86400.0
        info["age_days"] = age_days
        info["newest"] = newest.name
        self.log(
            f"🗂️ Thư mục backup: {len(files)} ảnh chụp, tổng {self._human_size(total)} | "
            f"bản mới nhất {newest.name} cách {age_days * 24:.1f} giờ."
        )
        if age_days > 3:
            self.log(f"⚠️ Ảnh chụp mới nhất đã cũ hơn {int(age_days)} ngày. Nên bấm 💾 SAO LƯU trước khi đổi cấu trúc hoặc chuyển máy.")
        return info

    def prune_old_backups(self):
        """Dọn bớt ảnh chụp CSDL cũ, luôn giữ lại BACKUP_KEEP_COUNT bản mới nhất.

        Đây là thao tác XÓA VĨNH VIỄN file nên bắt buộc người dùng xác nhận từng
        danh sách cụ thể trong hộp thoại trước khi ghi.
        """
        files = self._backup_files()
        if len(files) <= BACKUP_KEEP_COUNT:
            messagebox.showinfo(
                "Không cần dọn",
                f"Thư mục backup đang có {len(files)} ảnh chụp.\n\n"
                f"Hệ thống chỉ gợi ý dọn khi vượt quá {BACKUP_KEEP_COUNT} bản, và luôn giữ lại {BACKUP_KEEP_COUNT} bản mới nhất."
            )
            return

        keep, doomed = files[:BACKUP_KEEP_COUNT], files[BACKUP_KEEP_COUNT:]
        doomed_bytes = sum(p.stat().st_size for p in doomed)
        preview = "\n".join(f"   • {p.name}" for p in doomed[:12])
        if len(doomed) > 12:
            preview += f"\n   • ... và {len(doomed) - 12} file khác"

        confirm = messagebox.askyesno(
            "Xác nhận dọn backup cũ",
            f"Sẽ XÓA VĨNH VIỄN {len(doomed)} file backup cũ ({self._human_size(doomed_bytes)}):\n\n{preview}\n\n"
            f"GIỮ LẠI {BACKUP_KEEP_COUNT} bản mới nhất:\n   • " + "\n   • ".join(p.name for p in keep[:5]) +
            ("\n   • ... " if len(keep) > 5 else "") +
            "\n\nXóa xong KHÔNG phục hồi lại được. Sao lưu đang mở trong Google Drive cũng bị ảnh hưởng.\n\nTiếp tục?"
        )
        if not confirm:
            self.log("⛔ Đã hủy dọn backup (không xóa file nào).")
            return

        removed, failed = 0, []
        for p in doomed:
            try:
                p.unlink()
                removed += 1
            except Exception as e:
                failed.append(f"{p.name}: {e}")
        self.log(f"🧹 Đã xóa {removed}/{len(doomed)} backup cũ, giải phóng {self._human_size(doomed_bytes)}.")
        for f_msg in failed:
            self.log(f"⚠️ Không xóa được {f_msg}")
        self.report_backup_hygiene()

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
            encoding="utf-8",
            errors="replace",
            env=dump_env,
            # ~139k dòng dữ liệu mất khoảng 9 phút qua supabase CLI; 180s trước đây
            # cắt ngang đúng lúc sắp xong rồi báo "không xuất được file".
            timeout=1800
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

    def _count_db_tables(self, tables: list, timeout: int = 300) -> tuple:
        """Đếm số dòng thực tế của từng bảng trong CSDL Local. Trả về (dict, lỗi)."""
        if not tables:
            return {}, ""
        parts = [
            f"select '{t}' as tbl, count(*) as n from \"{t.split('.', 1)[0]}\".\"{t.split('.', 1)[1]}\""
            for t in tables
        ]
        res = self._psql_local(" union all ".join(parts) + ";", timeout=timeout)
        if res.returncode != 0:
            return {}, (res.stderr or res.stdout or "psql trả lỗi").strip()[:200]

        actual = {}
        for line in (res.stdout or "").splitlines():
            if "|" not in line:
                continue
            tbl, _, n = line.strip().rpartition("|")
            try:
                actual[tbl] = int(n)
            except ValueError:
                continue
        return actual, ""

    def _verify_restore(self, expected: dict, wipe_tables: list) -> tuple:
        """Đối chiếu số dòng thực tế trong CSDL với số dòng file backup đáng lẽ phải sinh ra.

        Trả về (danh_sách_lệch, tổng_dong_kỳ_vọng, tổng_dong_thực_tế).
        Danh sách rỗng nghĩa là phục hồi khớp tuyệt đối.
        """
        tables = sorted(set(expected) | set(wipe_tables))
        actual, err = self._count_db_tables(tables)
        if err:
            return [("? - không đếm được: " + err)], 0, 0

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

    def compare_backup_with_db(self):
        """Đối chiếu một file backup với CSDL hiện tại theo kiểu DRY-RUN.

        Chỉ ĐỌC: không TRUNCATE, không INSERT, không sửa config. Mục đích là trả
        lời câu hỏi "nạp file này vào thì hệ thống sẽ thay đổi những gì?" trước
        khi bấm nút NẠP / PHỤC HỒI CSDL (vốn XÓA toàn bộ dữ liệu hiện tại).
        """
        if self.is_comparing_backup:
            messagebox.showinfo("Đang đối chiếu", "Lần đối chiếu trước vẫn đang chạy. Đợi hoàn tất rồi thử lại.")
            return
        if not is_port_open(PORTS["supabase_db"]):
            messagebox.showwarning(
                "CSDL chưa chạy",
                f"Supabase Local (cổng {PORTS['supabase_db']}) chưa chạy nên không đếm được số dòng hiện tại.\n\n"
                "Bấm 🚀 CHẠY HỆ THỐNG trước, đợi Supabase lên rồi đối chiếu lại."
            )
            return
        file_path = filedialog.askopenfilename(
            title="Chọn file backup để ĐỐI CHIẾU (chỉ đọc, KHÔNG nạp vào CSDL)",
            filetypes=[("SQL Files (*.sql)", "*.sql"), ("Tất Cả Các File (*.*)", "*.*")],
            initialdir=str(self.get_backup_dir())
        )
        if not file_path:
            return
        self.is_comparing_backup = True
        threading.Thread(target=self._compare_backup_worker, args=(file_path,), daemon=True).start()

    def _compare_backup_worker(self, file_path: str):
        sep = "=" * 66
        try:
            p = Path(file_path)
            self.log(f"🔎 {sep}\n🔎 BẮT ĐẦU ĐỐI CHIẾU FILE BACKUP VỚI CSDL (CHỈ ĐỌC, KHÔNG GHI)\n🔎 {sep}")
            self.log(f"📄 File: {p.name} | {self._human_size(p.stat().st_size)} | "
                     f"lúc sao lưu: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(p.stat().st_mtime))}")

            self.log("📖 Đang đọc từng câu INSERT trong file để đếm số dòng đã sao lưu...")
            try:
                expected = self._parse_backup_tables(file_path)
            except Exception as e:
                self.log(f"❌ Không đọc được file backup: {e}")
                self.root.after(0, lambda: messagebox.showerror("Lỗi Đọc File", f"Không đọc được file backup:\n{e}"))
                return

            if not expected:
                self.log("❌ File không chứa câu INSERT dữ liệu nào - có thể là file rỗng hoặc dump DDL thuần.")
                self.root.after(0, lambda: messagebox.showerror(
                    "File Không Hợp Lệ",
                    "Không tìm thấy câu INSERT dữ liệu nào trong file này.\n\nĐây không phải file do nút 💾 SAO LƯU tạo ra."
                ))
                return

            db_tables = self._list_db_tables()
            if not db_tables:
                self.log("❌ Không liệt kê được danh sách bảng từ CSDL Supabase Local.")
                self.root.after(0, lambda: messagebox.showerror(
                    "Lỗi Kết Nối", "Không đọc được danh sách bảng từ CSDL. Supabase Local đã chạy chưa?"
                ))
                return

            self.log(f"📊 File có INSERT cho {len(expected)} bảng ({sum(expected.values())} dòng). "
                     f"CSDL hiện tại có {len(db_tables)} bảng nghiệp vụ.")

            # 1) Bảng file cần mà CSDL không có => nút NẠP sẽ thất bại ngay từ bước kiểm tra
            missing_in_db = sorted(t for t in expected if t not in db_tables)
            if missing_in_db:
                self.log(f"🚫 CSDL HIỆN TẠI THIẾU {len(missing_in_db)} bảng mà file backup cần nạp:")
                for t in missing_in_db[:15]:
                    self.log(f"      • {t}")
                if len(missing_in_db) > 15:
                    self.log(f"      • ... và {len(missing_in_db) - 15} bảng khác")
                self.log("   ⇒ File này xuất từ cấu trúc khác. Nút NẠP sẽ TỪ CHỐI; cần chạy migration đúng phiên bản.")

            # 2) Bảng CSDL có mà file không có => khi nạp sẽ bị XÓA và để trống
            wipe_tables = sorted(db_tables - RESTORE_PROTECTED_TABLES)
            only_now = sorted(set(wipe_tables) - set(expected))

            to_count = sorted(set(expected) | set(wipe_tables))
            self.log(f"🧮 Đang đếm số dòng thực tế của {len(to_count)} bảng trong CSDL...")
            actual, err = self._count_db_tables(to_count)
            if err:
                self.log(f"❌ Không đếm được số dòng trong CSDL: {err}")
                self.root.after(0, lambda: messagebox.showerror("Lỗi Truy Vấn", f"Không đếm được số dòng CSDL:\n{err}"))
                return

            total_now = sum(actual.values())
            total_file = sum(expected.values())
            self.log(f"🗄️ CSDL hiện tại: {total_now} dòng nghiệp vụ | File backup: {total_file} dòng "
                     f"(chênh {total_now - total_file:+d}).")

            diff_rows, same = [], 0
            for t in to_count:
                want = expected.get(t, 0)
                got = actual.get(t)
                if got is None:
                    diff_rows.append((t, want, None))
                    continue
                if got == want:
                    same += 1
                else:
                    diff_rows.append((t, want, got))

            diff_rows.sort(key=lambda r: abs((r[2] if r[2] is not None else 0) - r[1]), reverse=True)

            will_be_emptied = [r for r in diff_rows if r[0] in set(only_now) and (r[2] or 0) > 0]

            self.log(f"✅ {same}/{len(to_count)} bảng trùng khớp tuyệt đối giữa file và CSDL.")
            if diff_rows:
                self.log(f"⚖️ {len(diff_rows)} bảng LỆCH nhau (file → CSDL hiện tại):")
                for t, want, got in diff_rows[:25]:
                    if got is None:
                        self.log(f"      • {t}: file {want} dòng, CSDL không đọc được số dòng")
                    else:
                        self.log(f"      • {t}: file {want} → CSDL {got} ({got - want:+d})")
                if len(diff_rows) > 25:
                    self.log(f"      • ... và {len(diff_rows) - 25} bảng khác (xem hết trong file nhật ký nếu cần)")
            if will_be_emptied:
                self.log(f"☠️ {len(will_be_emptied)} bảng CÓ DỮ LIỆU nhưng KHÔNG có trong file → nạp xong sẽ thành bảng rỗng:")
                for t, want, got in will_be_emptied[:15]:
                    self.log(f"      • {t}: đang có {got} dòng → sẽ còn 0")

            if missing_in_db:
                verdict = "KHÔNG THỂ nạp: CSDL thiếu bảng mà file cần."
            elif not diff_rows:
                verdict = "CSDL hiện tại ĐÚNG BẰNG trạng thái lúc sao lưu. Nạp file này sẽ không thay đổi gì."
            elif will_be_emptied:
                verdict = (f"Nạp file này sẽ XÓA dữ liệu đang có ở {len(will_be_emptied)} bảng "
                           f"và làm lệch {len(diff_rows)} bảng so với hiện tại.")
            else:
                verdict = f"Nạp file này sẽ làm lệch {len(diff_rows)} bảng so với CSDL hiện tại."
            self.log(f"🔚 KẾT LUẬN: {verdict}")
            self.log("🔎 Đây là chế độ CHỈ ĐỌC - CSDL chưa bị sửa đổi gì.\n🔎 " + sep)

            preview = "\n".join(
                f"• {t}: file {w} → CSDL {g if g is not None else '?'}"
                for t, w, g in diff_rows[:12]
            )
            if len(diff_rows) > 12:
                preview += f"\n• ... và {len(diff_rows) - 12} bảng lệch khác"
            if not diff_rows:
                preview = "Không có bảng nào lệch."

            self.root.after(0, lambda: messagebox.showinfo(
                "Kết quả đối chiếu (chưa nạp gì)",
                f"File: {p.name}\n{self._human_size(p.stat().st_size)}\n\n"
                f"Trùng khớp: {same}/{len(to_count)} bảng\n"
                f"Lệch: {len(diff_rows)} bảng\n"
                f"Thiếu bảng trong CSDL: {len(missing_in_db)}\n\n"
                f"{preview}\n\n──────────────\n{verdict}\n\n"
                f"(Chi tiết đầy đủ đã in trong khung nhật ký. Bấm 📤 Lưu nhật ký ra file nếu cần giữ lại.)"
            ))
        except Exception as e:
            self.log(f"❌ Ngoại lệ khi đối chiếu: {e}")
            self.root.after(0, lambda: messagebox.showerror("Lỗi Đối Chiếu", f"Không đối chiếu được:\n{e}"))
        finally:
            self.is_comparing_backup = False

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
                try:
                    self.report_backup_hygiene()
                    files = self._backup_files()
                    if len(files) > BACKUP_KEEP_COUNT:
                        self.log(f"💡 Đã tích tụ {len(files)} bản (> {BACKUP_KEEP_COUNT}). "
                                 f"Bấm 🧹 Dọn backup cũ ở tiêu đề nhật ký để giải phóng dung lượng (luôn giữ {BACKUP_KEEP_COUNT} bản mới nhất).")
                except Exception as hy_err:
                    self.log(f"ℹ️ Không thống kê được thư mục backup: {hy_err}")
                if not is_auto:
                    self.root.after(0, lambda: messagebox.showinfo(
                        "Sao Lưu Thành Công",
                        f"Đã sao lưu toàn bộ dữ liệu CSDL thành công!\n\nFile: {backup_file.name} ({file_size_kb} KB)\nThư mục: {str(backup_dir)}"
                    ))
            else:
                # _run_supabase_dump đã trả về lý do; trước đây dòng này ghi
                # "res.stderr" (biến đã bị xoá khi refactor) nên mọi lỗi sao lưu
                # đều biến thành NameError thay vì thông báo thật.
                self.log(f"❌ Lỗi khi sao lưu: {(err_msg or 'Không xuất được file').strip()[:500]}")
                self.log("🧪 Gợi ý: kiểm tra Supabase Local (cổng 64322) đang chạy, rồi thử lại.")
                if not is_auto:
                    self.root.after(0, lambda: messagebox.showerror("Lỗi Sao Lưu", f"Không thể sao lưu dữ liệu:\n{(err_msg or 'Không xuất được file').strip()[:900]}"))
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
            started_at = time.time()
            proc = subprocess.Popen(
                cmd,
                cwd=str(PROJECT_DIR),
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
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
            # ISCC trả 0 cả khi không sinh được .exe (bị antivirus giữ file), nên
            # bằng chứng bắt buộc là file exe MỚI sinh sau lúc bắt đầu build.
            created_file = None
            if dist_installer_dir.exists():
                fresh = [f for f in dist_installer_dir.glob("*.exe")
                         if f.stat().st_mtime >= started_at - 2]
                if fresh:
                    created_file = max(fresh, key=lambda f: f.stat().st_mtime)

            if proc.returncode == 0 and created_file:
                self.log("✅ ĐÓNG GÓI BẢN CÀI ĐẶT THÀNH CÔNG 100%!")
                size_mb = round(created_file.stat().st_size / (1024 * 1024), 2)
                file_info = f"\nFile: {created_file.name} ({size_mb} MB)"
                self.log(f"📁 Vị trí: {created_file} ({size_mb} MB)")

                if dist_installer_dir.exists() and sys.platform == "win32":
                    os.startfile(str(dist_installer_dir))

                self.root.after(0, lambda: messagebox.showinfo(
                    "Đóng Gói Thành Công",
                    f"Đã tạo file cài đặt All-In-One thành công!{file_info}\n\nThư mục: {str(dist_installer_dir)}"
                ))
            elif proc.returncode == 0:
                self.log("❌ Inno Setup báo mã 0 nhưng KHÔNG có file .exe nào mới trong dist_installer.")
                self.root.after(0, lambda: messagebox.showerror(
                    "Đóng Gói Không Tạo Ra File",
                    f"ISCC chạy xong (mã 0) nhưng không tìm thấy .exe mới trong:\n{dist_installer_dir}\n\n"
                    "Thường do antivirus giữ file hoặc thiếu quyền ghi - kiểm tra thư mục này."
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
                    taskkill_tree(self.proc_nextjs_dev.pid)
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
                    taskkill_tree(self.proc_nextjs.pid)
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
                encoding="utf-8",
                errors="replace",
                # Dự án có ~1.700 module; trên máy yếu build thật có thể vượt 5 phút,
                # timeout 300s trước đây cắt ngang giữa chừng rồi báo "ngoại lệ".
                timeout=1800
            )
            build_id = PROJECT_DIR / ".next" / "BUILD_ID"
            # returncode 0 mà không ra BUILD_ID = build dở dang, đừng hứa hão.
            if res.returncode == 0 and build_id.exists():
                self.log(f"✅ Build Production THÀNH CÔNG! Bản build mới: {build_id.read_text(encoding='utf-8').strip()}")
                self.log("🚀 Đang tự động chạy lại Web App với phiên bản vừa Build...")
                self.root.after(0, self.start_all_services)
            else:
                err_text = res.stderr or res.stdout or "Lỗi build"
                if res.returncode == 0:
                    err_text = f"npm exit 0 nhưng không tìm thấy .next/BUILD_ID - bản build không hoàn tất.\n{err_text}"
                self.log(f"❌ Kết quả Build thất bại:\n{err_text[-3000:]}")

        except Exception as e:
            self.log(f"❌ Ngoại lệ khi Build: {e}")
        finally:
            self.is_building = False
            self.root.after(0, lambda: self.btn_build.configure(state="normal"))

    def toggle_dev_server(self):
        """Bật hoặc Tắt nhanh chế độ Dev Server (:3001) độc lập"""
        if getattr(self, "is_toggling_dev", False):
            self.log("⏳ Dev Server đang trong quá trình bật/tắt, vui lòng đợi...")
            return
        self.is_toggling_dev = True
        self.btn_dev.configure(state="disabled")
        threading.Thread(target=self._toggle_dev_server_step, daemon=True).start()

    def _toggle_dev_server_step(self):
        try:
            self._dev_server_step()
        finally:
            self.is_toggling_dev = False
            self.root.after(0, lambda: self.btn_dev.configure(state="normal"))

    def _dev_server_step(self):
        if is_port_open(PORTS["nextjs_dev"]):
            self.log("🛑 Đang tắt Next.js Dev Server (:3001)...")
            if self.proc_nextjs_dev and self.proc_nextjs_dev.poll() is None:
                taskkill_tree(self.proc_nextjs_dev.pid)
                self.proc_nextjs_dev = None
            killed = kill_process_on_port(PORTS["nextjs_dev"])
            if wait_ports_open([PORTS["nextjs_dev"]], seconds=8):
                self.log(f"❌ Cổng 3001 vẫn còn mở (đã dừng {len(killed)} tiến trình) - Dev Server chưa tắt hẳn.")
            else:
                self.log("✅ Đã tắt Next.js Dev Server (:3001).")
        else:
            threading.Thread(target=self._start_dev_worker, daemon=True).start()

    def _start_dev_worker(self):
        self.log("🛠️ ================= BẮT ĐẦU KHỞI CHẠY DEV SERVER (:3001) =================")
        # Tự động kiểm tra Docker & Supabase để Dev có CSDL hoạt động
        if not (is_port_open(PORTS["supabase_api"]) and is_port_open(PORTS["supabase_studio"])):
            ok, why = docker_engine_status()
            if not ok:
                self.log(f"🐳 Docker Engine chưa trả lời ({why}). Vui lòng bật Docker Desktop hoặc dùng nút Chạy Hệ Thống!")
            else:
                self.log("📦 Supabase chưa chạy. Đang tự động bật Supabase Local...")
                try:
                    subprocess.run(
                        "cmd.exe /c npx.cmd supabase start",
                        cwd=str(PROJECT_DIR), shell=True, capture_output=True,
                        text=True, encoding="utf-8", errors="replace", timeout=900
                    )
                except Exception as e:
                    self.log(f"⚠️ Không tự bật được Supabase: {e}")
                if wait_ports_open([PORTS["supabase_api"], PORTS["supabase_studio"]], seconds=20):
                    self.log("⚠️ Supabase chưa mở cổng - Dev server sẽ báo lỗi kết nối CSDL.")

        if is_port_open(PORTS["nextjs_dev"]):
            kill_process_on_port(PORTS["nextjs_dev"])
            time.sleep(1)

        try:
            self.log("🛠️ Đang thực thi 'npm run dev' trên cổng 3001...")
            self.proc_nextjs_dev = self._spawn_logged(
                "cmd.exe /c npm.cmd run dev", "[Next.js-Dev]", cwd=PROJECT_DIR
            )

            if not wait_ports_open([PORTS["nextjs_dev"]], seconds=40):
                self.log(f"✅ Next.js Dev đã online tại {URLS['web_dev']}!")
                webbrowser.open(URLS["web_dev"])
            elif self.proc_nextjs_dev.poll() is not None:
                self.log(f"❌ Dev server tự thoát với mã {self.proc_nextjs_dev.returncode} - xem log phía trên.")
                self.proc_nextjs_dev = None
            else:
                self.log("⚠️ Dev server đã bật nhưng cổng 3001 chưa mở sau 40s (Next.js có thể đang compile).")
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
        # try/finally ở đây là bắt buộc: trước đây mọi ngoai le (build fail, hết
        # timeout, lỗi đĩa...) thoát thẳng ra ngoài làm cờ is_starting_all kẹt lại
        # vĩnh viễn, hai nút "Chạy Hệ Thống" và "Chuyển Chế Độ" chết theo.
        try:
            self._start_all_steps()
        except Exception as e:
            self.log(f"❌ Lỗi bất ngờ khi khởi động: {e}")
        finally:
            self._finish_start_all()

    def _wait_docker_engine(self) -> tuple:
        """Đảm bảo Docker Engine trả lời; tự mở Docker Desktop nếu cần.

        Trả (ok, ly_do). Tách thành hàm riêng để probe được kịch bản "engine lên
        chập chờn" mà không phải dựng cả GUI.
        """
        ready, why = docker_engine_status()
        if ready:
            return True, why

        if docker_desktop_app_running():
            self.log("🐳 Docker Desktop ĐANG MỞ nhưng engine chưa trả lời (nó còn khởi động nội bộ).")
            self.log("   ⇒ Chỉ chờ thêm, không mở ứng dụng lần hai.")
        else:
            self.log("🐳 Engine chưa trả lời và Docker Desktop chưa mở → đang tự khởi động ứng dụng...")
            opened = False
            for p in DOCKER_PATHS:
                if p.exists():
                    subprocess.Popen([str(p)])
                    opened = True
                    self.log(f"   Đã mở: {p.name}")
                    break
            if not opened:
                self.log("   ⚠️ Không thấy Docker Desktop.exe ở các đường dẫn quen thuộc, thử lệnh 'docker-desktop'.")
                subprocess.Popen(["start", "", "docker-desktop"], shell=True)

        self.log(f"⏳ Đang đợi Docker Engine trả lời (tối đa {DOCKER_WAIT_SECONDS}s)... nguyên nhân gần nhất: {why}")
        # Ngân sách tính theo đồng hồ treo và KẾT QUẢ ĐƯỢC CHỐT (latch). Bản cũ viết
        # "while not is_docker_ready(): ..." rồi SAU vòng lặp lại gọi
        # is_docker_ready() MỘT LẦN NỮA để quyết định — nên khi engine đang lên chập
        # chờn, vòng lặp thoát ra vì một lần OK nhưng câu kiểm tra ngay sau đó lại
        # fail, và launcher báo "Docker chưa sẵn sàng" dù Docker thật đã chạy.
        deadline = time.time() + DOCKER_WAIT_SECONDS
        last_beat = time.time()
        while not ready and time.time() < deadline:
            time.sleep(DOCKER_POLL_SECONDS)
            ready, why = docker_engine_status()
            now = time.time()
            if not ready and now - last_beat >= 15:
                last_beat = now
                self.log(f"   ... vẫn còn chờ ({max(0, int(deadline - now))}s nữa): {why}")
        return ready, why

    def _start_all_steps(self):
        mode = self.run_mode.get()
        mode_name = "⚡ PRODUCTION (TỐI ƯU CAO)" if mode == "prod" else "🛠️ DEVELOPMENT (LẬP TRÌNH)"
        self.log(f"🚀 ================= BẮT ĐẦU KHỞI ĐỘNG HỆ THỐNG [{mode_name}] =================")
        results: list[tuple[str, bool, str]] = []

        # 1. DOCKER
        self.log("1️⃣ [Docker] Đang kiểm tra Docker Desktop Engine...")
        ready, why = self._wait_docker_engine()
        if not ready:
            self.log(f"❌ Docker Engine vẫn chưa trả lời sau {DOCKER_WAIT_SECONDS}s.")
            self.log(f"   Nguyên nhân cuối cùng từ 'docker info': {why}")
            self.log("   ➜ Mở sẵn Docker Desktop bằng tay, đợi badge chuyển xanh, rồi bấm lại nút này.")
            self.log("   ➜ Có thể bấm 🩺 BÁC SĨ MÔI TRƯỜNG để kiểm tra chi tiết cài đặt.")
            results.append(("Docker", False, why[:90]))
            self._log_start_summary(results, mode)
            return

        self.log(f"✅ {why} đã sẵn sàng 100%.")
        results.append(("Docker", True, ""))

        # 2. SUPABASE LOCAL
        self.log("2️⃣ [Supabase] Đang kiểm tra CSDL Supabase Local...")
        db_ports = [PORTS["supabase_api"], PORTS["supabase_studio"]]
        if is_port_open(PORTS["supabase_api"]) and is_port_open(PORTS["supabase_studio"]):
            self.log("✅ Supabase Local đã đang chạy sẵn.")
            results.append(("Supabase", True, "đã chạy sẵn"))
        else:
            self.log("📦 Đang khởi động các container Supabase (Postgres, Studio, Auth)...")
            detail = ""
            try:
                # 120s không đủ cho lần kéo ảnh đầu tiên trên máy mới (mất 5-10 phút).
                res = subprocess.run(
                    "cmd.exe /c npx.cmd supabase start",
                    cwd=str(PROJECT_DIR),
                    shell=True,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=900
                )
                detail = (res.stderr or res.stdout or "").strip()[-500:]
            except subprocess.TimeoutExpired:
                detail = "'supabase start' chạy quá 15 phút nên đã bị dừng (thường do kéo ảnh Docker lần đầu)."
            except Exception as e:
                detail = str(e)

            # returncode 0 chưa chắc dịch vụ đã nghe cổng; chỉ cổng mở là bằng chứng.
            still_closed = wait_ports_open(db_ports, seconds=30)
            if not still_closed:
                self.log("✅ Supabase Local đã khởi động thành công (cổng 64321 + 64323 đã mở).")
                results.append(("Supabase", True, ""))
            else:
                self.log(f"❌ Supabase VẪN chưa mở cổng {still_closed}. Nội dung lỗi:\n{detail}")
                results.append(("Supabase", False, f"đóng cổng {still_closed}"))

        # 3. NEXT.JS WEB APP
        self.log(f"3️⃣ [Next.js] Đang khởi chạy Web App ({mode_name})...")
        target_port = PORTS["nextjs"] if mode == "prod" else PORTS["nextjs_dev"]
        port_label = "3000 (Production)" if mode == "prod" else "3001 (Dev)"

        if is_port_open(target_port):
            self.log(f"ℹ️ Đang giải phóng cổng {port_label} cũ để áp dụng phiên bản mới...")
            killed = kill_process_on_port(target_port)
            time.sleep(1.5)
            if is_port_open(target_port):
                self.log(f"⚠️ Cổng {port_label} vẫn còn mở sau khi đã dừng {len(killed)} tiến trình "
                         f"- có thể một dịch vụ khác đang chiếm cổng.")

        build_failed = False
        try:
            if mode == "prod":
                dot_next = PROJECT_DIR / ".next"
                if not dot_next.exists():
                    self.log("🔨 Chưa tìm thấy bản build. Đang tự động build lần đầu (npm run build)...")
                    try:
                        res_build = subprocess.run(
                            "cmd.exe /c npm.cmd run build",
                            cwd=str(PROJECT_DIR),
                            shell=True,
                            capture_output=True,
                            text=True,
                            encoding="utf-8",
                            errors="replace",
                            timeout=1200
                        )
                        build_ok = res_build.returncode == 0 and (dot_next / "BUILD_ID").exists()
                        if not build_ok:
                            build_failed = True
                            self.log("❌ Build thất bại, KHÔNG khởi động server production.\n"
                                     + (res_build.stderr or res_build.stdout or "")[-800:])
                    except subprocess.TimeoutExpired:
                        build_failed = True
                        self.log("❌ Build quá 20 phút và đã bị dừng.Chạy 'npm run build' thủ công để xem lỗi.")
                    except Exception as e:
                        build_failed = True
                        self.log(f"❌ Lỗi khi build: {e}")

                if build_failed:
                    results.append(("Next.js", False, "build lỗi"))
                    self._log_start_summary(results, mode)
                    return

                self.log("⚡ Đang khởi động Next.js Production Server cổng 3000 (npm run start)...")
                self.proc_nextjs = self._spawn_logged(
                    "cmd.exe /c npm.cmd run start", "[Next.js-Prod]", cwd=PROJECT_DIR
                )
            else:
                self.log("🛠️ Đang khởi động Next.js Dev Server cổng 3001 (npm run dev)...")
                self.proc_nextjs_dev = self._spawn_logged(
                    "cmd.exe /c npm.cmd run dev", "[Next.js-Dev]", cwd=PROJECT_DIR
                )

            srv = self.proc_nextjs if mode == "prod" else self.proc_nextjs_dev
            still_closed = wait_ports_open([target_port], seconds=40)
            if not still_closed:
                url_online = URLS["web_local"] if mode == "prod" else URLS["web_dev"]
                self.log(f"✅ Next.js Web App ({mode.upper()}) đã online tại {url_online}!")
                results.append(("Next.js", True, f"cổng {target_port}"))
            elif srv.poll() is not None:
                self.log(f"❌ Next.js ({mode.upper()}) đã tự thoát với mã {srv.returncode} - xem log phía trên.")
                results.append(("Next.js", False, f"tiến trình chết (code {srv.returncode})"))
            else:
                self.log(f"⚠️ Next.js ({mode.upper()}) đã bật nhưng cổng {port_label} chưa mở sau 40s - "
                         f"tiến trình vẫn sống, có thể cần thêm thời gian.")
                results.append(("Next.js", False, f"cổng {port_label} chưa mở"))
        except Exception as e:
            self.log(f"❌ Lỗi khởi động Next.js: {e}")
            results.append(("Next.js", False, str(e)[:80]))

        # 4. CLOUDFLARE TUNNEL
        self.log("4️⃣ [Tunnel] Đang kiểm tra Cloudflare Tunnel...")
        results.append(("Tunnel", self._ensure_tunnel_running("khởi động cùng hệ thống"), ""))

        self._log_start_summary(results, mode)

    def _log_start_summary(self, results: list[tuple[str, bool, str]], mode: str):
        """In tóm tắt trung thực: chỉ gọi là 'sẵn sàng' khi không có bước nào hỏng."""
        self.log("──────────── TÓM TẮT KHỞI ĐỘNG ────────────")
        for name, ok, note in results:
            mark = "✅" if ok else "❌"
            self.log(f"   {mark} {name}" + (f" - {note}" if note else ""))

        bad = [r for r in results if not r[1]]
        if bad:
            self.log(f"⚠️ {len(bad)}/{len(results)} bước CHƯA đạt: {', '.join(r[0] for r in bad)}. "
                     f"Hệ thống chưa chắc đã dùng được - xem chi tiết ở log phía trên.")
            return

        mode_name = "PRODUCTION" if mode == "prod" else "DEVELOPMENT"
        self.log(f"🎉 ================= HỆ THỐNG {mode_name} ĐÃ SẴN SÀNG =================")
        self.log(f"🌐 Truy cập nội bộ: {URLS['web_local'] if mode == 'prod' else URLS['web_dev']}")
        doms, _ = read_tunnel_domains()
        live = [d["domain"] for d in doms if d["enabled"]]
        self.log(f"🌍 Tên miền công khai đang bật trong config Tunnel: {', '.join(live) if live else '(chưa cấu hình)'}")
        self.log(f"🗄️ Quản trị Database Studio: {URLS['studio_local']}")

    def _ensure_tunnel_running(self, reason: str = "") -> bool:
        """Bật cloudflared nếu chưa sống và xác nhận nó còn sống sau vài giây."""
        if self.proc_tunnel is not None and self.proc_tunnel.poll() is None:
            self.log("✅ Cloudflare Tunnel đã đang chạy.")
            return True
        ok_sync, sync_msg = ensure_tunnel_ready()
        if not ok_sync:
            self.log(f"⚠️ Đồng bộ cấu hình Tunnel vào ~/.cloudflared chưa ổn: {sync_msg}")
        try:
            cf_bin = get_cloudflared_bin()
            self.proc_tunnel = self._spawn_logged(f'"{cf_bin}" tunnel run {TUNNEL_ID}', "[Tunnel]")
        except Exception as e:
            self.log(f"❌ Không启动 được Tunnel: {e}")
            return False

        # 'Popen' trả về tức là tiến trình ĐÃ SINH, chưa phải ĐÃ KẾT NỐI.
        for _ in range(6):
            time.sleep(1)
            if self.proc_tunnel.poll() is not None:
                break
        if self.proc_tunnel.poll() is None:
            self.log("✅ Tunnel đang chạy (mã tiến trình "
                     f"{self.proc_tunnel.pid}) - dòng '[Tunnel]' phía trên cho biết đã kết nối Cloudflare hay chưa.")
            return True
        self.log(f"❌ Tunnel chết ngay sau khi khởi động (mã {self.proc_tunnel.returncode}) - "
                 f"thường do config.yml lỗi hoặc chưa đăng ký tunnel. Lý do: {reason}")
        self.proc_tunnel = None
        return False

        self._finish_start_all()

    def _finish_start_all(self):
        self.is_starting_all = False
        self.root.after(0, lambda: self.btn_start_all.configure(state="normal"))
        if hasattr(self, "btn_switch_mode"):
            self.root.after(0, lambda: self.btn_switch_mode.configure(state="normal"))

    def _spawn_logged(self, cmd: str, prefix: str, cwd: Path | None = None) -> subprocess.Popen:
        """Chạy một tiến trình nền, stream toàn bộ output vào khung nhật ký.

        encoding/errors là bắt buộc: npm và Next.js in ra tiếng Việt có dấu lẫn ký
        tự phá mã. Thiếu hai tham số này, readline ném UnicodeDecodeError và except
        nuốt luôn -> dịch vụ vẫn chạy nhưng khung nhật ký câm hoàn toàn.
        """
        proc = subprocess.Popen(
            cmd,
            cwd=str(cwd) if cwd else None,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        )
        threading.Thread(target=self._stream_proc_logs, args=(proc, prefix), daemon=True).start()
        return proc

    def _stream_proc_logs(self, process: subprocess.Popen, prefix: str):
        try:
            for line in iter(process.stdout.readline, ""):
                clean_line = line.strip()
                if clean_line:
                    self.log(f"{prefix} {clean_line}")
                if not self.running_loop:
                    break
        except Exception as e:
            self.log(f"{prefix} ⚠️ Mất dòng log của dịch vụ này: {e}")

    def stop_all_services(self):
        if self.is_stopping_all:
            return
        self.is_stopping_all = True
        self.btn_stop_all.configure(state="disabled")
        threading.Thread(target=self._stop_all_worker, daemon=True).start()

    def _stop_all_worker(self):
        # try/finally: nếu một bước bắn lỗi, cờ is_stopping_all trước đây kẹt lại
        # và nút Dừng Hệ Thống không bao giờ bấm được nữa trong phiên đó.
        try:
            self._stop_all_steps()
        except Exception as e:
            self.log(f"❌ Lỗi bất ngờ khi dừng hệ thống: {e}")
        finally:
            self.is_stopping_all = False
            self.root.after(0, lambda: self.btn_stop_all.configure(state="normal"))

    def _stop_all_steps(self):
        self.log("🛑 ================= ĐANG DỪNG TOÀN BỘ HỆ THỐNG =================")
        not_closed: list[str] = []

        if self.proc_tunnel and self.proc_tunnel.poll() is None:
            self.log("🛑 Đang đóng Cloudflare Tunnel...")
            # taskkill theo PID+cây con của CHÍNH tunnel launcher chạy, không dùng
            # /IM cloudflared.exe: kiểu đó giết luôn cả cloudflared của phần mềm khác.
            if taskkill_tree(self.proc_tunnel.pid):
                self.log("✅ Đã tắt Cloudflare Tunnel.")
            else:
                self.log("⚠️ taskkill không thành công với Tunnel (có thể tiến trình đã tự tắt).")
            self.proc_tunnel = None

        for label, attr, port in (
            ("Next.js Production (:3000)", "proc_nextjs", PORTS["nextjs"]),
            ("Next.js Dev (:3001)", "proc_nextjs_dev", PORTS["nextjs_dev"]),
        ):
            proc = getattr(self, attr)
            if proc and proc.poll() is None:
                self.log(f"🛑 Đang dừng {label}...")
                taskkill_tree(proc.pid)
                setattr(self, attr, None)
                if wait_ports_open([port], seconds=8):
                    not_closed.append(f"{label} vẫn còn cổng {port}")
                    self.log(f"⚠️ {label}: cổng {port} vẫn mở - đang thử dừng theo cổng...")
                    kill_process_on_port(port)
                    if wait_ports_open([port], seconds=5):
                        self.log(f"❌ {label}: KHÔNG đóng được cổng {port}.")
                    else:
                        self.log(f"✅ {label}: đã đóng cổng {port}.")
                else:
                    self.log(f"✅ Đã tắt {label}.")

        self.log("🛑 Đang dừng các container Supabase Local...")
        try:
            subprocess.run(
                "cmd.exe /c npx.cmd supabase stop",
                cwd=str(PROJECT_DIR), shell=True, capture_output=True,
                text=True, encoding="utf-8", errors="replace", timeout=90
            )
        except Exception as e:
            self.log(f"⚠️ Lỗi dừng Supabase: {e}")
        db_open = wait_ports_open([PORTS["supabase_api"], PORTS["supabase_studio"]], seconds=15)
        if db_open:
            not_closed.append(f"Supabase vẫn còn cổng {db_open}")
            self.log(f"⚠️ Supabase vẫn còn mở cổng {db_open} (container có thể chưa dừng hẳn).")
        else:
            self.log("✅ Đã dừng Supabase Local.")

        if not_closed:
            self.log("🏁 ĐÃ DỪNG NHƯNG CHƯA SẠCH: " + " | ".join(not_closed))
        else:
            self.log("🏁 Toàn bộ dịch vụ đã được tắt và các cổng đã đóng.")

    def _restart_tunnel_if_running(self, reason: str = ""):
        """Tự động reload / restart Tunnel nếu đang chạy để áp dụng cấu hình mới"""
        if self.proc_tunnel and self.proc_tunnel.poll() is None:
            self.log(f"🔄 Đang khởi động lại Cloudflare Tunnel ({reason})...")
            taskkill_tree(self.proc_tunnel.pid)
            self.proc_tunnel = None
            time.sleep(1)
        self._ensure_tunnel_running(reason)

    def optimize_dns_and_flush_cache(self):
        """Tối ưu hóa DNS (1.1.1.1 / 1.0.0.1 / 8.8.8.8) và xóa sạch bộ đệm DNS Cache"""
        if getattr(self, "is_optimizing_dns", False):
            messagebox.showinfo("Đang Xử Lý", "Hệ thống đang tiến hành tối ưu DNS, vui lòng đợi trong giây lát...")
            return

        # Lệnh bên dưới ghi DNS lên MỌI card mạng đang Up của máy, không riêng card
        # dùng cho Tunnel. Đây là thay đổi vượt ra ngoài dự án nên phải xin xác nhận
        # và cho người dùng biết cách hoàn tác trong StructuredInstaller.
        confirm = messagebox.askyesno(
            "Xác Nhận Đổi DNS Toàn Máy",
            "Chức năng này sẽ đặt DNS = 1.1.1.1, 1.0.0.1, 8.8.8.8 cho TOÀN BỘ card mạng "
            "đang bật trên máy tính này (kể cả card mạng nội bộ nhà máy).\n\n"
            "Nếu mạng nội bộ của bạn dùng DNS riêng để tra tên máy chủ trong kho, đổi xong "
            "có thể KHÔNG truy cập được máy chủ đó nữa.\n\n"
            "Cách hoàn tác: Control Panel → Network Connections → thuộc tính IPv4 → "
            "'Obtain DNS server address automatically'.\n\n"
            "Bạn có muốn tiếp tục?"
        )
        if not confirm:
            self.log("ℹ️ Đã hủy: không thay đổi DNS của máy.")
            return

        self.is_optimizing_dns = True
        if hasattr(self, "btn_optimize_dns"):
            self.btn_optimize_dns.configure(state="disabled")
        threading.Thread(target=self._optimize_dns_worker, daemon=True).start()

    def _run_ps(self, command: str, timeout: float = 25.0) -> subprocess.CompletedProcess:
        """Chạy PowerShell với encoding an toàn và timeout; không bao giờ treo luồng UI."""
        return subprocess.run(
            ["powershell", "-NoProfile", "-Command", command],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )

    def _read_dns_config(self) -> dict[str, list[str]]:
        """Đọc DNS đang cấu hình trên từng card mạng IPv4: {index: ['1.1.1.1', ...]}"""
        ps = ("Get-DnsClientServerAddress -AddressFamily IPv4 | "
              "Where-Object { $_.ServerAddresses } | "
              "ForEach-Object { \"$($_.InterfaceIndex)|$(($_.ServerAddresses) -join ',')\" }")
        try:
            res = self._run_ps(ps, timeout=20)
            out = {}
            for line in (res.stdout or "").splitlines():
                line = line.strip()
                if "|" in line:
                    idx, servers = line.split("|", 1)
                    out[idx.strip()] = [s.strip() for s in servers.split(",") if s.strip()]
            return out
        except Exception:
            return {}

    def _optimize_dns_worker(self):
        WANTED = ["1.1.1.1", "1.0.0.1", "8.8.8.8"]
        try:
            self.log("🌐 ================= TỐI ƯU DNS & XOÁ BỘ NHỚ ĐỆM DNS =================")
            self.log("🧹 1️⃣ Đang làm sạch bộ nhớ đệm DNS hệ thống (Flush DNS Cache)...")

            # 1. Flush DNS cache
            flush_errors = []
            for label, cmd in (
                ("Clear-DnsClientCache", lambda: self._run_ps("Clear-DnsClientCache")),
                ("ipconfig /flushdns", lambda: subprocess.run(
                    "ipconfig /flushdns", shell=True, capture_output=True,
                    text=True, encoding="utf-8", errors="replace", timeout=20)),
            ):
                try:
                    res = cmd()
                    if res.returncode != 0:
                        flush_errors.append(f"{label} (mã {res.returncode})")
                except Exception as e:
                    flush_errors.append(f"{label}: {e}")
            if flush_errors:
                self.log("⚠️ Flush DNS chưa sạch: " + "; ".join(flush_errors))
            else:
                self.log("✅ Đã làm sạch toàn bộ bộ nhớ đệm DNS Cache.")

            # 2. Kiểm tra DNS hiện tại
            self.log("🔍 2️⃣ Đang kiểm tra cấu hình DNS của các card mạng đang hoạt động...")
            before = self._read_dns_config()
            flat = ", ".join(sorted({s for v in before.values() for s in v}))
            self.log(f"📋 DNS hiện tại: [{flat if flat else 'Chưa xác định'}]")

            # 3. Áp dụng DNS 1.1.1.1, 1.0.0.1, 8.8.8.8
            self.log("⚡ 3️⃣ Đang thiết lập DNS Cloudflare (1.1.1.1, 1.0.0.1) & Google (8.8.8.8)...")
            ps_set_cmd = (
                "Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.InterfaceDescription -notmatch 'Virtual|Hyper-V|vEthernet' } "
                "| ForEach-Object { Set-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -ServerAddresses ('1.1.1.1','1.0.0.1','8.8.8.8') }; "
                "Clear-DnsClientCache"
            )

            set_ok = False
            try:
                r_set = self._run_ps(ps_set_cmd, timeout=40)
                if r_set.returncode == 0:
                    set_ok = True
                else:
                    self.log("🔑 Quyền hiện tại không đủ để đổi DNS, đang xin Administrator...")
            except Exception as e:
                self.log(f"⚠️ Thử lần đầu không chạy được: {e}")

            if not set_ok:
                try:
                    script_content = (
                        f"Write-Host 'Dang thiet lap DNS 1.1.1.1 / 1.0.0.1 / 8.8.8.8...' -ForegroundColor Cyan; "
                        f"{ps_set_cmd}; "
                        f"Start-Sleep -Seconds 2"
                    )
                    # ShellExecuteW trả về >32 khi thực sự spawn được tiến trình nâng quyền.
                    # Bản cũ bỏ qua giá trị này nên người dùng bấm "No" trên hộp UAC
                    # vẫn nhận thông báo "cài thành công".
                    ret = ctypes.windll.shell32.ShellExecuteW(
                        None,
                        "runas",
                        "powershell.exe",
                        f"-NoProfile -Command \"{script_content}\"",
                        None,
                        1
                    )
                    if int(ret) > 32:
                        self.log("🖥️ Đã mở cửa sổ PowerShell quyền Admin, vui lòng xem và chờ cửa sổ đó chạy xong.")
                        time.sleep(4)
                        set_ok = True
                    else:
                        self.log(f"❌ Người dùng đã hủy hộp UAC hoặc không mở được PowerShell nâng quyền (mã {ret}).")
                except Exception as ex:
                    self.log(f"❌ Yêu cầu quyền Admin thất bại: {ex}")

            # 4. Kiểm tra phân giải tên miền Cloudflare Tunnel
            self.log("🚀 4️⃣ Đang kiểm tra tốc độ phân giải tên miền Cloudflare Tunnel...")
            resolve_ok = False
            elapsed_ms = 0
            try:
                t0 = time.time()
                res_resolve = self._run_ps("Resolve-DnsName region1.v2.argotunnel.com", timeout=15)
                elapsed_ms = int((time.time() - t0) * 1000)
                resolve_ok = res_resolve.returncode == 0
            except Exception as e:
                self.log(f"⚠️ Không kiểm tra được phân giải DNS: {e}")

            # 5. Đọc LẠI DNS sau khi đổi: đây là bằng chứng duy nhất có giá trị.
            after = self._read_dns_config()
            applied = [idx for idx, servers in after.items() if servers == WANTED or servers[:3] == WANTED]
            self.log(f"📋 DNS sau khi đổi: [{', '.join(sorted({s for v in after.values() for s in v})) or 'Chưa xác định'}]")

            if applied:
                self.log(f"✅ Đã áp dụng DNS mới cho {len(applied)} card mạng (xác minh bằng đọc lại).")
            else:
                self.log("❌ Đọc lại card mạng KHÔNG thấy bộ DNS 1.1.1.1/1.0.0.1/8.8.8.8 - "
                         "có thể bạn chưa cấp quyền Admin hoặc card mạng là Virtual.")

            if resolve_ok:
                self.log(f"✅ Phân giải argotunnel.com mất {elapsed_ms}ms.")
            else:
                self.log("⚠️ Phân giải thử nghiệm thất bại/chậm - kiểm tra lại kết nối mạng.")

            # 6. Khởi động lại Tunnel nếu đang chạy để áp dụng DNS mới
            if applied and self.proc_tunnel and self.proc_tunnel.poll() is None:
                self._restart_tunnel_if_running("sau khi tối ưu DNS")

            if applied and resolve_ok:
                self.root.after(0, lambda: messagebox.showinfo(
                    "Tối Ưu DNS Hoàn Tất",
                    "Đã xác minh:\n\n"
                    f"• {len(applied)} card mạng đang dùng DNS 1.1.1.1 / 1.0.0.1 / 8.8.8.8.\n"
                    f"• Phân giải region1.v2.argotunnel.com OK trong {elapsed_ms}ms.\n"
                    "• Bộ nhớ đệm DNS đã được xóa."
                ))
            else:
                self.root.after(0, lambda: messagebox.showwarning(
                    "Tối Ưu DNS Chưa Xác Minh Được",
                    "Hệ thống đã chạy lệnh nhưng ĐỌC LẠI không thấy DNS mới được áp dụng.\n\n"
                    "Nguyên nhân thường gặp: hộp UAC bị hủy, PowerShell nâng quyền chưa chạy xong, "
                    "hoặc card mạng bị loại vì là adapter ảo.\n\n"
                    "Chi tiết ở khung nhật ký. Bạn có thể đặt DNS thủ công trong thuộc tính IPv4 của card mạng."
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
        threading.Thread(target=lambda: self._restart_tunnel_if_running("người dùng yêu cầu"), daemon=True).start()

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
        def sync_tunnel_config_now():
            ok_sync, detail = ensure_tunnel_ready()
            if ok_sync:
                messagebox.showinfo("Đã Đồng Bộ", f"{detail}\n\nVị trí: {Path(os.path.expanduser('~/.cloudflared'))}")
            else:
                messagebox.showerror("Đồng Bộ Thất Bại", detail)

        ttk.Button(
            row4,
            text="🔄 Đồng Bộ Cấu Hình Ngay",
            style="Link.TButton",
            command=sync_tunnel_config_now
        ).pack(side=tk.RIGHT)

        # 5. Cấu hình DNS Máy Tính
        dns_status = "Đang kiểm tra..."
        dns_color = "#94a3b8"
        try:
            # PowerShell khởi động lạnh có thể mất hơn 2s; timeout sát -> báo nhầm.
            # Không đặt lớn hơn vì đoạn này chạy trên luồng UI (cửa sổ sẽ đơ).
            ps_d = self._run_ps(
                "Get-DnsClientServerAddress -AddressFamily IPv4 | Select-Object -ExpandProperty ServerAddresses",
                timeout=6
            )
            if "1.1.1.1" in (ps_d.stdout or ""):
                dns_status = "✅ Tối ưu (Cloudflare 1.1.1.1)"
                dns_color = "#22c55e"
            else:
                dns_status = "⚠️ Đang dùng DNS thường (dễ bị timeout)"
                dns_color = "#eab308"
        except Exception as e:
            # Không đọc được thì phải nói "không đọc được", không tô xanh "đã tối ưu".
            dns_status = f"❓ Không kiểm tra được DNS ({str(e)[:60]})"
            dns_color = "#94a3b8"

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

    def _doc_log(self, text: str):
        """Ghi dòng tiến trình vào log của Bác Sĩ, bỏ qua an toàn nếu cửa sổ đã bị đóng.

        Trước đây worker giữ tham chiếu widget của cửa sổ đã destroy và gọi insert
        trong root.after -> TclError âm ỉ (và làm mất phần còn lại của log).
        """
        def _append():
            widget = getattr(self, "_doc_text", None)
            if widget is None:
                return
            try:
                if widget.winfo_exists():
                    widget.insert(tk.END, text)
                    widget.see(tk.END)
            except tk.TclError:
                pass

        self.root.after(0, _append)

    def _install_via_winget(self, app_name: str, package_id: str):
        """Chạy lệnh winget cài đặt tự động ngầm"""
        self._doc_log(f"\n[BẮT ĐẦU] Đang tải & cài đặt {app_name} ({package_id}) qua winget...\n")

        def worker():
            cmd = f'winget install --id {package_id} -e --accept-source-agreements --accept-package-agreements'
            try:
                proc = subprocess.Popen(
                    cmd,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
                )
            except Exception as e:
                self._doc_log(f"❌ Không chạy được winget: {e}\n")
                self.root.after(0, lambda: messagebox.showerror(
                    "Thiếu winget",
                    f"Máy này chưa có winget (App Installer) nên không tự cài {app_name} được.\n"
                    "Hãy tải thủ công từ trang chủ phần mềm đó."
                ))
                return

            def watchdog():
                time.sleep(900)
                if proc.poll() is None:
                    proc.kill()
                    self._doc_log("\n❌ winget chạy quá 15 phút nên đã bị dừng.\n")

            threading.Thread(target=watchdog, daemon=True).start()

            for line in iter(proc.stdout.readline, ""):
                if line.strip():
                    self._doc_log(line)
            proc.wait()

            if proc.returncode != 0:
                self._doc_log(f"\n❌ winget trả về mã {proc.returncode}.\n")
                self.root.after(0, lambda: messagebox.showerror(
                    "Cài Đặt Thất Bại",
                    f"Cài {app_name} không thành công (mã {proc.returncode}).\n"
                    "Thường gặp: mạng chặn winget, cần quyền Admin, hoặc package id đã đổi."
                ))
                return

            # exit 0 mới chỉ là "winget chạy xong"; phải hỏi lại winget đã có package chưa.
            installed = False
            try:
                res = subprocess.run(
                    f'winget list --id {package_id} -e',
                    shell=True, capture_output=True, text=True,
                    encoding="utf-8", errors="replace", timeout=90,
                    creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
                )
                installed = res.returncode == 0
            except Exception:
                installed = False

            self._doc_log("\n✅ Đã xác minh package có mặt trong danh mục winget.\n" if installed
                          else "\n⚠️ winget báo xong nhưng kiểm tra lại KHÔNG thấy package - có thể cần khởi động lại máy.\n")
            self.root.after(0, lambda: messagebox.showinfo(
                "Cài Đặt Hoàn Tất" if installed else "Cần Kiểm Tra Lại",
                f"Đã cài {app_name} và xác nhận qua 'winget list'.\n\n"
                if installed else
                f"winget báo chạy xong nhưng xác minh lại không thấy {app_name}.\n"
                "Khởi động lại máy (hoặc mở lại cửa sổ dòng lệnh) rồi bấm kiểm tra lại trong Bác Sĩ Môi Trường."
            ))

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
            d_list, cfg_err = read_tunnel_domains()

            active_cnt = sum(1 for d in d_list if d["enabled"])
            disabled_cnt = len(d_list) - active_cnt
            lbl_list_title.config(
                text=f"🌍 QUẢN LÝ TRẠNG THÁI TÊN MIỀN ({active_cnt} Đang Bật | {disabled_cnt} Đang Tắt)"
            )

            if cfg_err:
                # Trước đây lỗi đọc file bị che bằng danh sách tên miền mẫu,
                # nên config hỏng vẫn hiện ra như "đang bật tốt".
                err_lbl = tk.Label(
                    domains_box,
                    text=f"⛠️ {cfg_err}\n\nKhông hiển thị được trạng thái tên miền thật. "
                         f"File đã có backup dạng config.yml.bak_* - phục hồi từ đó nếu cần.",
                    font=("Segoe UI", 10, "bold"),
                    fg="#f87171",
                    bg="#0f172a",
                    justify=tk.LEFT,
                    pady=16
                )
                err_lbl.pack(fill=tk.X)
                return

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
                refresh_domain_list()
                return

            self.log(f"🌐 {msg}")
            if LAST_TUNNEL_CONFIG_CHANGED:
                self._restart_tunnel_if_running(f"{action_text} tên miền {domain}")
            else:
                self.log("ℹ️ Cấu hình không thay đổi nên giữ nguyên Tunnel đang chạy (tránh đứt traffic).")
            refresh_domain_list()
            messagebox.showinfo(
                f"Đã {action_text} Tên Miền",
                f"{msg}\n\nCấu hình Tunnel đã được cập nhật tự động."
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
                refresh_domain_list()
                return

            self.log(f"🗑️ {msg}")
            if LAST_TUNNEL_CONFIG_CHANGED:
                self._restart_tunnel_if_running(f"Xóa tên miền {domain}")
            refresh_domain_list()
            messagebox.showinfo("Đã Xóa Tên Miền", msg)

        def handle_add():
            domain = ent_domain.get().strip()
            if not domain:
                messagebox.showwarning("Thông Báo", "Vui lòng nhập tên miền cần thêm!")
                return
            ok, res = add_domain_to_tunnel(domain)
            if not ok:
                messagebox.showerror("Lỗi", res)
                refresh_domain_list()
                return

            self.log(f"🌐 {res}")
            if LAST_TUNNEL_CONFIG_CHANGED:
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
