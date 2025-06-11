import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export interface NetworkStatus {
    isConnected: boolean;
    isInternetReachable: boolean | null;
    type: string | null;
    isOnline: boolean;
}

export function useNetworkStatus() {
    const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
        isConnected: true,
        isInternetReachable: null,
        type: null,
        isOnline: true
    });
    const [hasReconnected, setHasReconnected] = useState(false);

    useEffect(() => {
        let previousOnlineStatus = true;

        const unsubscribe = NetInfo.addEventListener(state => {
            const isOnline = state.isConnected === true && state.isInternetReachable === true;

            // Detect reconnection
            if (!previousOnlineStatus && isOnline) {
                setHasReconnected(true);
                // Reset after a short delay to allow components to react
                setTimeout(() => setHasReconnected(false), 1000);
            }

            previousOnlineStatus = isOnline;

            setNetworkStatus({
                isConnected: state.isConnected ?? false,
                isInternetReachable: state.isInternetReachable,
                type: state.type,
                isOnline
            });
        });

        // Get initial state
        NetInfo.fetch().then(state => {
            const isOnline = state.isConnected === true && state.isInternetReachable === true;
            setNetworkStatus({
                isConnected: state.isConnected ?? false,
                isInternetReachable: state.isInternetReachable,
                type: state.type,
                isOnline
            });
        });

        return () => unsubscribe();
    }, []);

    return {
        ...networkStatus,
        hasReconnected
    };
} 