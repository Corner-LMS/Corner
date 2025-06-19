import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

const SplashScreen = () => {
    return (
        <View style={styles.container}>
            <Image
                source={require('../assets/images/corner-splash-logo.png')}
                style={styles.logo}
                resizeMode="contain"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#4f46e5',
        width: '100%',
    },
    logo: {
        width: 200,
        height: 200,
    },
});

export default SplashScreen; 