const fs = require('fs');
const path = require('path');

function decodeGoogleServicesJson() {
    const base64 = process.env.GOOGLE_SERVICES_JSON;
    if (!base64) {
        console.error('❌ GOOGLE_SERVICES_JSON is not defined.');
        process.exit(1);
    }

    const outputPath = path.resolve(__dirname, '../google-services.json');
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(outputPath, buffer);
    console.log('✅ google-services.json created at', outputPath);
}

decodeGoogleServicesJson();
