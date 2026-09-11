export const COMPANY_INFO = {
  name: "Hệ Thống Quản Lý Kho",
  shortName: "WMS",
  // Các thông tin khác có thể thêm vào sau nếu cần
};

export const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'tungdibui2609@gmail.com';

export const VAPID_CONFIG = {
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BIS8rwKrO4HnMfX48d4CYdX7IBGE7DpxSU6dDwNljpEoi8J7Me4CmOl0uiaiEHnhLcSDTBae9lDLuHTcbEXjxxA',
    privateKey: process.env.VAPID_PRIVATE_KEY || '6dywq15GsMMnZ67ffdPOQObVF92CxtunUAnY-TIfXMs',
    subject: process.env.VAPID_SUBJECT || 'mailto:contact@chanhthu.click',
};


