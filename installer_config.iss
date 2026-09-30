; ====================================================================
;   MODULAR WMS - MASTER ALL-IN-ONE INSTALLER SCRIPT (INNO SETUP 6)
;   Đóng gói toàn bộ Source Code + Build Production + Database + Launcher
;   Tự động phát hiện & hỗ trợ cài đặt Docker, Node.js, Cloudflare Tunnel
; ====================================================================

#define MyAppName "Modular WMS - He Thong Quan Ly Kho"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Modular WMS Team"
#define MyAppExeName "ServerManager.exe"
#define SourceFolder "d:\chanh thu\web"

[Setup]
AppId={{E68A9F32-8419-4CB5-9E7E-B88E8A930F21}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName=C:\ModularWMS
DefaultGroupName={#MyAppName}
OutputDir={#SourceFolder}\dist_installer
OutputBaseFilename=Setup_ModularWMS_AllInOne_v1.0
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
DisableDirPage=no
DisableProgramGroupPage=no
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce

[Files]
; Sao chép toàn bộ mã nguồn, thư viện, bản build, cấu hình (Loại trừ cache dev và file rác)
Source: "{#SourceFolder}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: ".git\*,.agent\*,build\*,dist\*,dist_installer\*,*.log,scratch_*.js,.next\cache\*,.next\dev\*"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{group}\Sao Luu CSDL"; Filename: "{app}\SAO_LUU_DULIEU.bat"; WorkingDir: "{app}"
Name: "{group}\Nap CSDL (Restore)"; Filename: "{app}\NAP_DULIEU.bat"; WorkingDir: "{app}"
Name: "{group}\Gỡ Cài Đặt Modular WMS"; Filename: "{uninstallexe}"
Name: "{userdesktop}\Modular WMS Server"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Khởi động Modular WMS Server ngay bây giờ"; Flags: nowait postinstall skipifsilent

[Code]
// Hàm kiểm tra lệnh có tồn tại trong PATH hay không
function IsCommandAvailable(const Cmd: string): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('cmd.exe', '/c where.exe ' + Cmd, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

// Xử lý kiểm tra môi trường và cấu hình tự động sau khi cài đặt
procedure CurStepChanged(CurStep: TSetupStep);
var
  UserProfile: string;
  CloudflaredDir: string;
  ResultCode: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    // 1. Tự động đồng bộ file cấu hình Cloudflare Tunnel vào ~/.cloudflared của người dùng máy mới
    UserProfile := ExpandConstant('{userappdata}\..');
    CloudflaredDir := UserProfile + '\.cloudflared';
    if not DirExists(CloudflaredDir) then
      CreateDir(CloudflaredDir);

    if FileExists(ExpandConstant('{app}\tunnel_setup\9df90c7f-63cf-4ac9-87f1-f615c0292e4d.json')) then
      FileCopy(ExpandConstant('{app}\tunnel_setup\9df90c7f-63cf-4ac9-87f1-f615c0292e4d.json'), CloudflaredDir + '\9df90c7f-63cf-4ac9-87f1-f615c0292e4d.json', False);

    if FileExists(ExpandConstant('{app}\tunnel_setup\cert.pem')) then
      FileCopy(ExpandConstant('{app}\tunnel_setup\cert.pem'), CloudflaredDir + '\cert.pem', False);

    if FileExists(ExpandConstant('{app}\tunnel_setup\config.yml')) then
      FileCopy(ExpandConstant('{app}\tunnel_setup\config.yml'), CloudflaredDir + '\config.yml', False);

    // 2. Kiểm tra Docker Desktop
    if not IsCommandAvailable('docker') then
    begin
      if MsgBox('⚠️ Hệ thống phát hiện máy tính này CHƯA CÀI ĐẶT Docker Desktop.' + #13#10 + #13#10 +
                '(Docker là thành phần bắt buộc để chạy CSDL Supabase Local).' + #13#10 + #13#10 +
                'Bạn có muốn mở trình tự động cài đặt Docker Desktop ngay bây giờ không?',
                mbConfirmation, MB_YESNO) = IDYES then
      begin
        if not Exec('cmd.exe', '/c start "" winget install Docker.DockerDesktop --accept-source-agreements --accept-package-agreements', '', SW_SHOW, ewNoWait, ResultCode) then
        begin
          ShellExec('open', 'https://www.docker.com/products/docker-desktop/', '', '', SW_SHOWNORMAL, ewNoWait, ResultCode);
        end;
      end;
    end;

    // 3. Kiểm tra Node.js
    if not IsCommandAvailable('node') then
    begin
      if MsgBox('⚠️ Hệ thống phát hiện máy tính này CHƯA CÀI ĐẶT Node.js.' + #13#10 + #13#10 +
                '(Node.js là thành phần bắt buộc để chạy Web App Next.js).' + #13#10 + #13#10 +
                'Bạn có muốn mở trình tự động cài đặt Node.js LTS ngay bây giờ không?',
                mbConfirmation, MB_YESNO) = IDYES then
      begin
        if not Exec('cmd.exe', '/c start "" winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements', '', SW_SHOW, ewNoWait, ResultCode) then
        begin
          ShellExec('open', 'https://nodejs.org/', '', '', SW_SHOWNORMAL, ewNoWait, ResultCode);
        end;
      end;
    end;
  end;
end;
