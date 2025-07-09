const fs = require('fs');
const path = require('path');

function decodeGoogleServicesPlist() {
    const base64 = process.env.GOOGLE_SERVICES_PLIST_B64;

    if (!base64) {
        console.error('❌ GOOGLE_SERVICES_PLIST_B64 is not defined.');
        process.exit(1);
    }

    const outputPath = path.resolve(__dirname, '../GoogleService-Info.plist');
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(outputPath, buffer);
    console.log('✅ GoogleService-Info.plist created at:', outputPath);
}

decodeGoogleServicesPlist();
