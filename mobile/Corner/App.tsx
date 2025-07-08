// App.tsx (temporary for debugging)
import { registerRootComponent } from 'expo';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

function App() {
    useEffect(() => {
        console.log('🧪 [Preview Test] This is a preview build test log');
    }, []);

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text>Hello World - App booted!</Text>
        </View>
    );
}

registerRootComponent(App);
