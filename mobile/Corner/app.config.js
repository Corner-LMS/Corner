export default ({ config }) => ({
    ...config,
    name: process.env.APP_NAME || config.name,
    android: {
        ...config.android,
        adaptiveIcon: {
            ...config.android.adaptiveIcon,
            foregroundImage: './assets/images/adaptive-icon.png',
            backgroundColor: '#4f46e5'
        },
    },
    ios: {
        ...config.ios,
        icon: './assets/images/icon.png'
    }
});
