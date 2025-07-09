const fs = require('fs');
const path = require('path');

function decodeFile(envVarName, outputFilename) {
    const encoded = process.env[envVarName];
    if (!encoded) {
        console.warn(`⚠️ ${envVarName} is not defined. Skipping ${outputFilename}`);
        return;
    }

    const outputPath = path.resolve(__dirname, `../${outputFilename}`);
    const buffer = Buffer.from(encoded, 'base64');

    try {
        fs.writeFileSync(outputPath, buffer);
        console.log(`✅ ${outputFilename} written successfully to ${outputPath}`);
    } catch (err) {
        console.error(`❌ Failed to write ${outputFilename}:`, err);
        process.exit(1);
    }
}

// === Firebase Files ===
decodeFile('GOOGLE_SERVICES_JSON_B64', 'google-services.json'); // Android
decodeFile('GOOGLE_SERVICES_PLIST_B64', 'GoogleService-Info.plist'); // iOS
// decodeFile('FIREBASE_ADMIN_SDK_B64', 'corner-70a1e-firebase-adminsdk-fbsvc-10c9a337c5.json'); // Optional
