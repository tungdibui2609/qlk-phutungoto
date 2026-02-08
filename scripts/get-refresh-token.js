
const { google } = require('googleapis');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
});

const CLIENT_ID = env.GOOGLE_CLIENT_ID || env.CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || env.CLIENT_SECRET;
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'; // Use this for local scripts if supported, or loopback

async function getRefreshToken() {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.error('Error: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not found in .env.local');
        process.exit(1);
    }

    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, 'https://developers.google.com/oauthplayground');

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive.file'],
        prompt: 'consent' // Force consent to ensure refresh token is returned
    });

    console.log('\n1. Mở liên kết này trong trình duyệt của bạn:\n');
    console.log(authUrl);
    console.log('\n2. Đăng nhập và chấp nhận quyền.');
    console.log('3. Bạn sẽ nhận được một mã (authorization code).');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.question('\n4. Dán mã authorization code vào đây: ', async (code) => {
        try {
            const { tokens } = await oauth2Client.getToken(code);
            console.log('\nThành công! Đây là Refresh Token của bạn:\n');
            console.log('------------------------------------------------------------');
            console.log(tokens.refresh_token);
            console.log('------------------------------------------------------------');
            console.log('\nHãy copy mã này và dán vào GOOGLE_REFRESH_TOKEN trong .env.local');
        } catch (error) {
            console.error('Lỗi khi lấy token:', error.message);
        } finally {
            rl.close();
        }
    });
}

getRefreshToken();
