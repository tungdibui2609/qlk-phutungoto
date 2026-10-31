# Hướng dẫn tạo VPS Oracle Cloud Free Tier (bản dành cho người lần đầu)

> Viết ngày 30/10/2026, sau khi đi bấm thực tế trên tài khoản `tungnd2609 (root)`, region `ap-singapore-1`.
> Mọi chỗ có dấu ⚠️ là chỗ hôm nay đã thật sự vấp, không phải lý thuyết.
> Cách dùng: mở file này song song với trình duyệt, làm theo từng màn. Mỗi màn chỉ có **một** quyết định.

---

## Bảng điền nhanh (bản rút gọn — chỉ đọc cái này cũng đủ bấm)

| Màn | Chọn |
|---|---|
| Name | `wms-vps` (hoặc gì cũng được) |
| Image | **Canonical Ubuntu 24.04 Minimal aarch64**, build `2026.09.18-0` |
| Shape | **Virtual machine** (không phải Bare metal), **VM.Standard.A1.Flex**, **2 OCPU / 12 GB**, burstable **TẮT** |
| Security | mặc định, không bật Shielded |
| Networking | **Create new virtual cloud network** + **Create new public subnet**, subnet `10.0.0.0/24`, *VNIC name* bỏ trống |
| SSH keys | **Upload public key file (.pub)** → `C:\Users\tungd\Downloads\ssh-key-2026-10-30.key.pub` |
| Storage | mặc định hết (46.6 GB, in-transit encryption bật) |
| Placement / Fault domain | **để TRỐNG** |
| Estimated cost | boot volume ~$2.76 và **không có dòng Compute** = đúng, bấm Create |

Ba việc **cấm làm**: F5 giữa form · bấm Create khi chưa thấy file chìa trong `Downloads` · bấm nút *Upgrade*.

---

## 0. Đọc trước 2 phút: mình đang định làm gì, và vì sao

Hiện tại hệ thống đang chạy hoàn toàn trên máy tính Windows:

| Thành phần | Chỗ nó sống hôm nay | Cổng |
|---|---|---|
| Web app (Next.js) | máy tính | `3000` |
| Database + API (Supabase self-hosted, 9 container Docker, tên project `anywarehouse`) | máy tính | `64321` (API), `64322` (DB), `64324` (SMTP) |
| Server OCR quét tem (`scanner_ocr_server.js`) | máy tính | `8088` |
| Đường vào từ internet (Cloudflare Tunnel) | máy tính | — |

**Mục tiêu của VPS:** dời cả 3 thành phần trên sang một máy tính khác chạy 24/24 ngoài cloud, để máy tính Windows không phải bật thâu đêm nữa. Khi VPS hỏng thì bật máy tính lên dùng tiếp.

**Nguyên tắc vàng — khắc câu này vào đầu trước khi làm bất cứ gì:**

> ⚠️ **Tại mỗi thời điểm, CHỈ đúng MỘT nơi được ghi vào database.**

Lý do: Cloudflare Tunnel cho phép nhiều "connector" cùng đăng ký vào **một** tunnel, và Cloudflare **chia request ngẫu nhiên** giữa chúng. Nếu máy tính và VPS cùng chạy chung một tunnel, thì có lúc anh bấm lưu vào máy tính, có lúc lưu vào VPS — hai database âm thầm lệch nhau, **không báo lỗi gì cả**. Đây là kiểu hỏng khó sửa nhất.

Vì vậy:
- Giai đoạn test: VPS dùng **tunnel RIÊNG**, tên miền RIÊNG (`test.chanhthu.click`). Máy tính vẫn là prod, không đụng tới.
- Ngày chính thức chuyển (cutover): **tắt connector trên máy tính TRƯỚC**, rồi mới bật connector trên VPS.

---

## 1. Chuẩn bị trước khi mở console

Cần có:
1. Tài khoản Oracle Cloud đã xác minh (đã có: tenancy `tungnd2609 (root)`).
2. Thẻ ngân hàng đã liên kết (để xác minh danh tính — tài khoản Free **không** bị trừ tiền tự động, đã kiểm tra: Billing → Subscriptions = *Universal Credits*, **Total commitment value SGD 0.00**, không có cam kết chi tiêu).
3. **Một file chìa SSH** (`.pub`) — xem mục 3.4.

Việc nên làm đầu tiên, miễn phí, 2 phút (lưới an toàn tiền bạc):

**☰ (menu góc trên-trái) → Budgets → Create budget**
- Scope: tenancy / tất cả service
- Amount: **1 USD**
- Recipient: email của anh

Từ đây mọi phát sinh tiền đều tự gửi mail, không âm thầm.

---

## 2. Giá thật của "miễn phí" — để không hoảng khi thấy con số

Đã tra tài liệu Oracle và kiểm chứng bằng ảnh chụp ngày 30/10/2026:

- **Ampere A1 Always Free = 2 OCPU + 12 GB RAM** (tính theo giờ: 1.500 OCPU-hours + 9.000 GB-hours mỗi tháng → vừa đủ để chạy **2 OCPU / 12 GB suốt 24/7**).
  - ⚠️ Quên con số "4 OCPU / 24 GB" đi — đó là hạn mức **cũ**, đã bị Oracle giảm. Nếu anh đọc thấy hướng dẫn nào ghi 4/24 thì hướng dẫn đó đã lỗi thời. Chạy 4/24 vẫn được, nhưng phần vượt 2/12 **có tính tiền**.
- **200 GB block storage** free (tổng mọi ổ đĩa của tenancy, bao gồm ổ hệ thống).
- Ổ hệ thống (boot volume) tối thiểu **47 GB** → nằm gọn trong suất 200 GB, vẫn free.
- Console cho phép chọn tới **7 OCPU** trong hình chữ nhật chọn shape. ⚠️ **Đó là service limit, không phải hạn mức free.** Chọn vượt 2/12 là Oracle tính tiền theo giờ vào thẻ, không cảnh báo.

### ⚠️ Bẫy "View estimated cost": đừng đòi ra $0.00

Hộp chi phí dự kiến báo **giá niêm yết, KHÔNG trừ suất Always Free**. Ảnh chụp thật hôm 30/10:

```
Boot volume   $2.76 / month
Estimated total  $2.76 / month
```

Cách đọc **đúng**:
- **Không có dòng Compute** = dấu hiệu tốt. Nếu bị tính, dòng Compute sẽ hiện ≈ **$51.89/tháng**. Sự *vắng mặt* của nó chính là bằng chứng Oracle nhận diện máy của anh là free.
- Dòng boot volume > 0 là **bình thường**, đừng xoá máy vì thấy $2.76.
- Điều kiện để ổ đĩa vẫn free: **tổng mọi ổ của tenancy < 200 GB**. Nhớ điều này khi nào gắn thêm ổ chứa backup.

Cùng loại bẫy, luôn tránh:
- Hộp vàng *"Upgrade — pay only for what you use"* → **bỏ qua**, đừng bấm.
- *"Bare metal machine"* → **không free**. Luôn chọn **Virtual machine**.

---

## 3. Tạo instance: từng màn hình một

Đường đi: **☰ → Compute → Instances → Create instance**

### 3.1 Màn *Basic information*

| Ô | Chọn gì | Vì sao |
|---|---|---|
| Name | tự đặt, ví dụ `wms-vps` | — |
| Create instance in | **Compartment** (cái gốc) | đừng tạo compartment con |
| Image (operating system) | **Canonical Ubuntu 24.04 Minimal aarch64** | xem ⚠️ dưới |
| Shape | **VM.Standard.A1.Flex**, **Virtual machine** | Ampere = suất free |
| OCPU / Memory | **2 / 12** | đúng hạn mức free hiện tại |
| Enable burstable performance | **TẮT** | — |

⚠️ **Về image — chỗ này dễ chọn sai nhất:**
- Danh sách Ubuntu ở region Singapore **chỉ có bản ARM dạng "Minimal aarch64"**, không có bản ARM đầy đủ. Mọi dòng **không có chữ `aarch64`** là bản **x86** → chỉ chạy được shape 1 GB RAM (không đủ nuôi stack của mình). Nhìn chữ `aarch64` mà chọn.
- Build đã chốt: **`2026.09.18-0`** (mới nhất trong các bản 2026.09.18-0 / 2026.08.25-0 / 2026.06.29-0).
- Tránh 26.04 (quá mới, Docker/Supabase chưa kiểm chứng) và 22.04 (cũ, không có lý do quay về).
- Hệ luỵ của bản *Minimal*: nó **thiếu** gói `linux-modules-extra-$(uname -r)`, là thứ Docker cần để làm mạng container. Sau khi SSH vào được, việc đầu tiên là cài nó (ghi ở file hướng dẫn deploy, không phải ở đây).

⚠️ **Vì sao không chọn Windows Server** (anh có hỏi điểm này khi thấy ảnh Windows trong console):
image Windows của Oracle là **x86 + có phí bản quyền** → mất luôn suất Ampere free, chỉ còn shape 1 GB RAM không đủ chạy 9 container Supabase. Hơn nữa stack của mình (Docker, Supabase, cloudflared, Node) là Linux-first, và **WSL không chạy bên trong một máy ảo trên cloud**.
Quan trọng hơn: **anh sẽ không bao giờ phải nhìn vào màn hình Linux.** Vẫn mở `chanhthu.click` bằng Chrome y như hôm nay; mọi lệnh do tôi chạy giúp qua SSH từ Windows.

⚠️ **Burstable:** chỉ có nghĩa khi chọn *ít* OCPU hơn hạn mức. Đã lấy đủ 2/12 thì bật chỉ thêm dao động hiệu năng. Muốn đổi sau phải Stop/Start lại máy — mà Stop máy A1 có rủi ro mất chỗ vĩnh viễn — nên chốt ngay từ lúc tạo.

### 3.2 Màn *Security*

**Để nguyên mặc định.**
- *Shielded instance*: không bật. Image ARM hiển thị cột Shielded = "-", tức không hỗ trợ; cố bật chỉ tổ lỗi tạo máy.

### 3.3 Màn *Networking* — chỗ hay sai nhất

⚠️ Console **tự chọn sẵn** *"Select existing virtual cloud network"*. Tenancy mới **chưa có VCN nào**, nên ô *Virtual cloud network* xám và trống.
Dấu hiệu nhận biết mình vẫn đang ở chế độ sai: mục *Subnet IPv4 prefixes* hiện một **dropdown xám rỗng**.

Chọn đúng:
- ☑ **Create new virtual cloud network**
- *VCN IPv4 prefix*: giữ mặc định (dạng `10.0.0.0/16`)
- ☑ **Create new public subnet**
- *Subnet IPv4 prefixes*: đổi thành **`10.0.0.0/24`**
- *VNIC name*: **bỏ trống**
- ☑ **Automatically assign private IPv4 address** (mặc định đã bật)

⚠️ **Bẫy public IPv4:** trên tenancy mới, ô *"Assign a public IPv4 address"* thường **bị mờ, bấm không được**, dù đã chọn *Create new public subnet* — console vẫn gào *"You must select a public subnet to assign a public IPv4 address"*.
**Đây là bug hiển thị của console, không phải lỗi của anh, và không chặn việc tạo máy.** Xử lý:
1. Bấm bỏ / bấm lại radio subnet **một lần** thử.
2. Vẫn không ăn → **Next rồi Create luôn**, đừng dây dưa.
3. Gán sau khi máy tạo xong: **Instance → Settings → Manage VNIC → Assign a new public IPv4 address**.

⚠️ **TUYỆT ĐỐI không F5 / tải lại trang** để "sửa" lỗi hiển thị — mất sạch form, phải khai lại từ đầu.

Không có public IP thì máy không ra được internet, và tôi cũng không SSH được vào nó. Vì vậy bước gán sau (mục 3.6) là bắt buộc, không phải tùy chọn.

### 3.4 Màn *SSH keys* — màn không được phép làm ẩu

⚠️ **File chìa riêng tư (`.key` / `.pem`) chỉ tải được ĐÚNG MỘT LẦN, TRƯỚC khi bấm Create.** Oracle không cho xin lại. Mất chìa = mất máy, chỉ còn đường tạo instance mới.

Hai cách, ưu tiên cách B vì trên máy tính đã có chìa sẵn từ hôm 30/10:

**Cách A — Let me generate a key pair (mặc định):**
- Bấm **Download private key file**, giữ `Public key` nguyên mặc định.
- **Mở thư mục `Downloads`, xác nhận bằng MẮT thấy file `.key`** rồi mới đi tiếp. Chỉ khi thấy file mới bấm Create.

**Cách B — Upload public key file (.pub):** dùng lại chìa cũ, đỡ phải quản lý thêm file.
- Chọn *Upload public key file (.pub)* → trỏ vào `C:\Users\tungd\Downloads\ssh-key-2026-10-30.key.pub`.
- Chìa riêng tư tương ứng (`ssh-key-2026-10-30.key`, 1679 byte, và một bản trùng `ssh-key-2026-10-30 (1).key`) đang nằm nguyên trong `Downloads` — **copy nó ra một chỗ an toàn khác** (USB / Google Drive), vì mất nó là mất máy.

**Không** chọn *Paste public key* trừ khi có lý do — dễ dán thiếu ký tự.

### 3.5 Màn *Storage*

**Giữ nguyên mọi thứ.** Cụ thể:
- *Use in-transit encryption*: bật (miễn phí) — mặc định đã bật.
- *Custom boot volume size*: **tắt** → mặc định **46.6 GB**, đủ cho giai đoạn test.
  - Còn ~153 GB trong suất 200 GB → khi nào cần chứa backup/Docker volumes thì gắn **block volume riêng**, mount vào `/data`. Đừng nâng boot volume.
- Khi để nguyên mọi mặc định thì checkbox *"Delete the boot volume when the instance is terminated"* **không hiện ra** → nghĩa là mặc định **giữ ổ đĩa**. Chấp nhận được, vì đã có backup mỗi giờ.

Bấm **Create**. Chờ 1–3 phút, trạng thái chuyển *PROVISIONING* → **RUNNING**.

### 3.6 Sau khi máy RUNNING: lấy public IP

Vào instance, đọc **Public IPv4 address** ở cột Information. Nếu trống (do bug mục 3.3):
**Settings → Manage VNIC → Assign a new public IPv4 address** → chọn *Allocate and assign a new IPv4 address*.

Ghi lại IP này. Đây là địa chỉ duy nhất cần để SSH, và là thứ tôi sẽ dùng để tự làm toàn bộ phần còn lại — **anh không phải gõ lệnh nào**.

---

## 4. Khi bấm Create bị báo "Out of capacity"

Lỗi thật hôm 30/10:
> *Out of capacity for shape VM.Standard.A1.Flex in availability domain AD-1.*

Đây là vấn đề **chỗ trống vật lý của Oracle**, không phải lỗi thao tác của anh. Người dùng free đánh nhau giành chỗ này thật; có báo cáo đầu tháng 10/2026 người ta không tạo được máy trong nhiều tuần. Đừng hiểu là "Oracle cho free mà kỳ vậy" — hiểu là "hôm nay hết chỗ, làm lại lúc khác".

### ⚠️ Thứ tự thử, và hai cái bẫy giả

**Bẫy 1 — đổi Availability domain:** lời khuyên "chuyển sang AD-2/AD-3" **không dùng được** trên tenancy này. Thẻ *Placement → Availability domain* chỉ liệt kê **duy nhất** `IWuf:AP-SINGAPORE-1-AD-1`, bấm vào không xổ ra gì khác. Tenancy free mới ở Singapore chỉ được mở 1 khu.

**Bẫy 2 — Fault domain:** thấy dropdown `FAULT-DOMAIN-1/2/3` rất dễ tưởng "à, chưa chọn, chắc phải chọn". **Phải để TRỐNG.** Chính dòng lỗi Oracle dặn: *"If you specified a fault domain, try creating the instance without specifying a fault domain."* Chọn vào đó là tự bó hẹp chỗ trống.
- Phân biệt để khỏi nhầm: *Availability domain* = khác khu nhà (cái mình muốn đổi, nhưng không đổi được); *Fault domain* = các dãy tủ **trong cùng một khu** (không đụng vào).
- Trong hộp thoại Retry, nếu có checkbox *"Create instance without specifying a fault domain"* thì **tích vào**.

**Thử lại theo bậc:**
1. Hạ shape xuống **2 OCPU / 12 GB** (nếu đang 4/24) — Oracle xếp chỗ theo khối, hết nguyên khối 4 nhân nhưng thường còn lẻ. **12 GB dư sức nuôi cả stack** (24 GB chỉ là "lấy cho đủ suất free", chưa bao giờ là yêu cầu của dự án); chỉ chậm hơn chút lúc build.
2. Vẫn fail → **1 OCPU / 6 GB**.
3. Vẫn fail → **đừng bấm tay nữa.** Dựng script tự gửi yêu cầu tạo lại mỗi 10 phút để chiếm ngay khi Oracle nhả chỗ. Cần OCI CLI trên Windows, xem mục 5.
4. Hoặc chờ **giờ thấp điểm 4–7h sáng giờ Việt Nam** (Singapore hơn Việt Nam 1 giờ, nên cùng là rạng sáng; lúc ít người bấm tạo máy nhất).

### ⚠️ Dọn VCN rác

Mỗi lần Create **fail vẫn để lại một VCN**, mà free tier chỉ được **2 VCN mỗi region**. Sau vài lần fail mà gặp lỗi chữ *VCN* / *quota*:
**Networking → Virtual cloud networks** → xóa bớt các `vcn-<ngày>-<giờ>` trùng giờ đã fail, **giữ lại cái mới nhất** (cái của máy đang chạy, nếu đã có máy).

---

## 5. Nếu muốn script tự bấm "tạo máy" hộ (nâng cao — bỏ qua cũng được)

Dùng **OCI CLI** trên Windows gửi yêu cầu Create tự động mỗi 10 phút.

Hôm 30/10 đụng tường: **Create API key → `Error 400: LimitExceeded ... api-key-count`**, và đã kiểm tra `Downloads` không có `api_key*.pem` nào → chưa từng tạo được key.

Hướng xử lý, theo thứ tự:
1. **Kiểm tra danh sách API key cũ:** vào *Profile and Settings → My profile → API keys*. Có key nào chết từ trước thì **xoá** → giải phóng chỗ → tạo lại. (Nhưng nếu danh sách trống, nghĩa là hạn mức của tenancy free đang là 0, không phải do key cũ chiếm.)
2. **Dùng session-token auth thay cho API key** — không cần tạo key gì cả:
   ```
   oci session authenticate --region-id ap-singapore-1 --profile-name free-retry
   ```
   Lệnh này mở trình duyệt, đăng nhập Oracle, lấy token tạm. Script retry dùng `--profile free-retry`.
3. Không đi được cả hai → quay lại mục 4 bước 4 (chờ giờ thấp điểm, bấm tay).

**Việc này không gấp.** Hệ thống prod của anh vẫn chạy tốt trên máy tính ngay hôm nay. Script tự chiếm chỗ là việc chạy ngầm, không phải việc phải xong trong buổi.

---

## 6. Có máy rồi thì làm gì tiếp (tóm tắt, chi tiết ở file hướng dẫn deploy)

Không phải việc của tài liệu này, nhưng để anh thấy bức tranh trọn vẹn và biết mình đang ở đâu:

1. **Nền tảng trên VPS:** timezone `Asia/Ho_Chi_Minh` (⚠️ bắt buộc làm TRƯỚC khi chạy — chia ca và báo cáo aging tính theo giờ máy), cài gói `linux-modules-extra-$(uname -r)` còn thiếu, Docker, Node 22, git, cloudflared.
2. **Dựng stack:** `git clone` → `npx supabase start` (giữ nguyên project `anywarehouse`) → **chạy `npx supabase status` để lấy key anon/service_role MỚI** → khai `.env.local` → **rồi mới** `npm run build` → app chạy native Node + systemd.
   - ⚠️ **Không dùng `Dockerfile`/`docker-compose.yml` có sẵn trong repo**: Dockerfile copy `.next/standalone` nhưng `next.config.ts` không đặt `output: 'standalone'` → build Docker chết ở bước COPY. Đã kiểm chứng.
   - ⚠️ Key anon/service_role của Supabase local **sinh ngẫu nhiên theo từng máy**. Không dán key mới của VPS vào `.env.local` thì **toàn bộ API route 401**.
   - `NEXT_PUBLIC_*` bị bake lúc build (nhất là `NEXT_PUBLIC_VAPID_PUBLIC_KEY` cho push notification) → thứ tự bắt buộc: **chép `.env.local` xong rồi mới build**.
   - `supabase/config.toml` **không có `[auth] site_url`** → mặc định `http://localhost:3000`, link mail reset mật khẩu sẽ nhảy sai khi lên domain thật. Cần thêm `site_url` + `additional_redirect_urls` khi làm thật.
   - Tin tốt đã đo: `src/lib/supabaseUrl.ts` tự suy URL Supabase từ hostname trình duyệt (`https://api.<root-domain>`), server-side dùng `INTERNAL_SUPABASE_URL` mặc định `127.0.0.1:64321` → **đổi tên miền không phải build lại**, và app scanner/PWA trên điện thoại **không cần cập nhật** khi cutover vì vẫn giữ `chanhthu.click`.
3. **Tunnel test RIÊNG** cho `test.chanhthu.click` — khác với tunnel prod `9df90c7f-63cf-4ac9-87f1-f615c0292e4d`. Dữ liệu VPS chỉ là bản dump từ máy tính. Máy tính giữ nguyên prod suốt giai đoạn này.
4. **Backup:** VPS tự `pg_dump` **mỗi giờ**, giữ 14 ngày, đẩy lên Google Drive, và kéo bản mới nhất về máy tính.
5. **Hai cái nút** (đều là file `.bat` đúp chuột trên Windows):
   - `DEPLOY_VPS.bat` — push code + build + restart trên VPS.
   - Nút **"cứu nguy"** — kéo backup mới nhất về → nạp vào Supabase local → bật web máy tính → chuyển tunnel về máy tính.
6. **Cutover:** tắt connector trên máy tính trước, rồi mới cho VPS nhận tunnel prod. Cái giá đã thống nhất chấp nhận: mất tối đa ~1 giờ dữ liệu khi phải failover.
7. **Không** làm replication/standby tự động hai chiều ở giai đoạn này.

---

## 7. Bảng tra nhanh: thấy gì → làm gì

| Màn hình / thông báo | Hành động |
|---|---|
| Ô *Virtual cloud network* xám và trống | Đổi sang **Create new virtual cloud network** |
| *Subnet IPv4 prefixes* là dropdown xám rỗng | Vẫn ở chế độ sai — như trên |
| "Assign a public IPv4" mờ, bấm không được | Bỏ qua, Create, gán sau qua **Manage VNIC** |
| Muốn F5 cho đỡ lỗi | **Dừng. Đừng F5.** Mất sạch form |
| Chưa tải `.key` mà sắp bấm Create | **Dừng. Tải chìa trước.** Không xin lại được |
| *Out of capacity ... AD-1* | Hạ 2/12 → 1/6 → script/chờ giờ thấp điểm. **Fault domain để trống** |
| Lỗi chữ *VCN* / *quota* | Xóa VCN rác ở Networking (chỉ được 2) |
| Estimated cost $2.76, không có dòng Compute | **Đúng, cứ tạo.** Không có dòng Compute = máy được tính free |
| Estimated cost hiện dòng Compute ≈ $51.89 | **Dừng.** Đang bị tính tiền shape |
| *Error 400 LimitExceeded api-key-count* | Xoá key cũ ở My profile, hoặc dùng `oci session authenticate` |
| thấy hộp vàng *Upgrade* / *Bare metal machine* | Bỏ qua / luôn chọn **Virtual machine** |

---

## 8. Ghi chú an toàn

- File này **không chứa mật khẩu, key, token nào**. Thông tin đăng nhập test nằm ở `.env.test.local` (đã `.gitignore`), tuyệt đối không dán vào đây hay file nào trong repo.
- Trước mọi thao tác xoá/terminate: nhớ **Stop** có rủi ro mất chỗ vĩnh viễn với shape A1, và **Terminate** càng nên tránh. Ưu tiên giữ máy.
- Trước khi đụng database ở bước deploy: backup `pg_dump` từ máy tính đã, rồi mới làm.
