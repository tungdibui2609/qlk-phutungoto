import os
import subprocess

desktop_dir = os.path.join(os.path.expanduser('~'), 'Desktop')
shortcut_path = os.path.join(desktop_dir, 'Modular WMS Server.lnk')
target_bat = r"d:\chanh thu\web\CHAY_SERVER.bat"
working_dir = r"d:\chanh thu\web"

vbs_content = f'''Set oWS = WScript.CreateObject("WScript.Shell")
Set oLink = oWS.CreateShortcut("{shortcut_path}")
oLink.TargetPath = "{target_bat}"
oLink.WorkingDirectory = "{working_dir}"
oLink.Description = "Khoi dong Modular WMS Server 1-Click"
oLink.Save
'''

vbs_file = os.path.join(working_dir, "_temp_shortcut.vbs")
with open(vbs_file, "w", encoding="utf-8") as f:
    f.write(vbs_content)

subprocess.run(["cscript", "//nologo", vbs_file], check=True)
if os.path.exists(vbs_file):
    os.remove(vbs_file)

print(f"Created shortcut at: {shortcut_path}")
