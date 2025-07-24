export default ({ config }) => ({
    ...config,
    name: process.env.APP_NAME || config.name,
    android: {
        ...config.android,
        googleServicesFile: process.env.GOOGLE_SERVICES_JSON_B64 ?? './google-services.json',
        adaptiveIcon: {
            ...config.android.adaptiveIcon,
            foregroundImage: './assets/images/adaptive-icon.png',
            backgroundColor: '#4f46e5'
        },
    },
    ios: {
        ...config.ios,
        googleServicesFile: process.env.GOOGLE_SERVICES_PLIST_B64 ?? './GoogleService-Info.plist',
        icon: './assets/images/icon.png'
    }
});
