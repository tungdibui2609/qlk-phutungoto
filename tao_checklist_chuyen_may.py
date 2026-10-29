"""In ra CHECKLIST_CHUYEN_MAY.txt cho chuc nang "Nen de chuyen may".

Dung chung van ban va chung ham dem dong voi server_launcher.py de hai loi
(nut trong launcher / file .bat) khong the bao hai con so khac nhau.

Cach dung:
    python tao_checklist_chuyen_may.py <goi_nen> <anh_csdl> <image_pg> [duong_dan_txt]
"""

import sys
from pathlib import Path

from server_launcher import build_migration_checklist_text
from server_launcher import ServerManagerGUI


def main(argv):
    if len(argv) < 4:
        print(__doc__)
        return 2

    archive = Path(argv[1])
    dump = Path(argv[2])
    pg_image = argv[3].strip() or "khong doc duoc"
    out = Path(argv[4]) if len(argv) > 4 else dump.parent / "CHECKLIST_CHUYEN_MAY.txt"

    if not dump.exists():
        print(f"[LOI] Khong thay anh CSDL: {dump}")
        return 1

    expected = ServerManagerGUI._parse_backup_tables(str(dump))
    size_mb = round(archive.stat().st_size / (1024 * 1024), 2) if archive.exists() else 0

    out.write_text(
        build_migration_checklist_text(
            archive.name, dump.name, size_mb, len(expected), sum(expected.values()), pg_image
        ),
        encoding="utf-8-sig",
    )
    print(f"[OK] {out.name}: {len(expected)} bang co du lieu, {sum(expected.values())} dong, "
          f"goi {archive.name} ({size_mb} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
