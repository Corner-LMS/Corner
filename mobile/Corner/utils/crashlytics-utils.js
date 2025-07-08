import crashlytics from '@react-native-firebase/crashlytics';

/**
 * Crashlytics utility functions for testing and debugging
 */

// Helper function to safely call Crashlytics with better error handling
const safeCrashlytics = async (operation) => {
    try {
        // Check if Crashlytics is available
        if (!crashlytics) {
            console.warn('❌ [Crashlytics] Crashlytics module not available');
            return null;
        }

        // Check if collection is enabled
        const enabled = await crashlytics().isCrashlyticsCollectionEnabled();
        console.log('🔍 [Crashlytics] Collection enabled:', enabled);

        if (!enabled) {
            console.warn('⚠️ [Crashlytics] Collection is disabled - logs will not be sent');
            // Still execute the operation for console logging
            return operation();
        }

        // Execute the operation
        const result = operation();
        console.log('✅ [Crashlytics] Operation completed successfully');
        return result;
    } catch (error) {
        console.error('❌ [Crashlytics] Operation failed:', error);
        return null;
    }
};

// Initialize Crashlytics with proper setup
export const initializeCrashlytics = async () => {
    try {
        console.log('🚀 [Crashlytics] Initializing...');

        // Check if Crashlytics is available
        if (!crashlytics) {
            console.error('❌ [Crashlytics] Module not available');
            return false;
        }

        // Enable collection by default
        await crashlytics().setCrashlyticsCollectionEnabled(true);

        // Set default attributes
        await crashlytics().setAttributes({
            appVersion: '1.0.0',
            platform: 'react-native',
            environment: __DEV__ ? 'development' : 'production'
        });

        // Log initialization
        await crashlytics().log('Crashlytics initialized successfully');

        console.log('✅ [Crashlytics] Initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ [Crashlytics] Initialization failed:', error);
        return false;
    }
};

// Test a non-fatal error with better logging
export const testNonFatalError = async (errorMessage = 'Test non-fatal error') => {
    console.log('🧪 [Crashlytics] Testing non-fatal error:', errorMessage);

    try {
        // Log to console first
        console.log('📝 [Crashlytics] Logging to Crashlytics...');

        // Log the test message
        await safeCrashlytics(() => crashlytics().log(`TESTING NON-FATAL ERROR: ${errorMessage}`));

        // Record the error
        await safeCrashlytics(() => crashlytics().recordError(new Error(errorMessage)));

        // Set a custom key for this test
        await safeCrashlytics(() => crashlytics().setAttributes({
            lastTestError: errorMessage,
            testTimestamp: new Date().toISOString()
        }));

        console.log('✅ [Crashlytics] Non-fatal error logged successfully');
        return true;
    } catch (error) {
        console.error('❌ [Crashlytics] Error logging non-fatal error:', error);
        return false;
    }
};

// Test a fatal crash
export const testFatalCrash = async () => {
    console.log('💥 [Crashlytics] About to test fatal crash...');

    try {
        await safeCrashlytics(() => crashlytics().log('About to test fatal crash'));
        await safeCrashlytics(() => crashlytics().recordError(new Error('Test fatal crash')));

        // Force a crash after a short delay to ensure logs are sent
        setTimeout(() => {
            console.log('💥 [Crashlytics] Forcing crash...');
            throw new Error('Test fatal crash - this will crash the app');
        }, 1000);
    } catch (error) {
        console.error('❌ [Crashlytics] Error in fatal crash test:', error);
        throw error;
    }
};

// Log custom events with better structure
export const logCustomEvent = async (eventName, parameters = {}) => {
    console.log('📊 [Crashlytics] Logging custom event:', eventName, parameters);

    try {
        // Log the event
        await safeCrashlytics(() => crashlytics().log(`Custom event: ${eventName}`));

        // Set attributes for the event
        await safeCrashlytics(() => crashlytics().setAttributes({
            eventName,
            timestamp: new Date().toISOString(),
            ...parameters
        }));

        console.log('✅ [Crashlytics] Custom event logged successfully:', eventName);
        return true;
    } catch (error) {
        console.error('❌ [Crashlytics] Error logging custom event:', error);
        return false;
    }
};

// Set user identifier with validation
export const setUserIdentifier = async (userId) => {
    console.log('👤 [Crashlytics] Setting user ID:', userId);

    try {
        if (!userId) {
            console.warn('⚠️ [Crashlytics] No user ID provided');
            return false;
        }

        await safeCrashlytics(() => crashlytics().setUserId(userId));
        console.log('✅ [Crashlytics] User ID set successfully:', userId);
        return true;
    } catch (error) {
        console.error('❌ [Crashlytics] Error setting user ID:', error);
        return false;
    }
};

// Set user attributes with validation
export const setUserAttributes = async (attributes) => {
    console.log('🏷️ [Crashlytics] Setting user attributes:', attributes);

    try {
        if (!attributes || typeof attributes !== 'object') {
            console.warn('⚠️ [Crashlytics] Invalid attributes provided');
            return false;
        }

        await safeCrashlytics(() => crashlytics().setAttributes(attributes));
        console.log('✅ [Crashlytics] User attributes set successfully');
        return true;
    } catch (error) {
        console.error('❌ [Crashlytics] Error setting user attributes:', error);
        return false;
    }
};

// Test JavaScript error with better error handling
export const testJavaScriptError = async () => {
    console.log('🔧 [Crashlytics] Testing JavaScript error...');

    try {
        await safeCrashlytics(() => crashlytics().log('Testing JavaScript error'));

        // Simulate a JavaScript error
        const undefinedVariable = undefined;
        undefinedVariable.someMethod(); // This will cause a TypeError
    } catch (error) {
        console.log('✅ [Crashlytics] JavaScript error caught:', error.message);
        await safeCrashlytics(() => crashlytics().recordError(error));
        return true;
    }
};

// Test async error with better structure
export const testAsyncError = async () => {
    console.log('⏱️ [Crashlytics] Testing async error...');

    try {
        await safeCrashlytics(() => crashlytics().log('Testing async error'));

        await new Promise((resolve, reject) => {
            setTimeout(() => {
                reject(new Error('Async test error'));
            }, 1000);
        });
    } catch (error) {
        console.log('✅ [Crashlytics] Async error caught:', error.message);
        await safeCrashlytics(() => crashlytics().recordError(error));
        return true;
    }
};

// Enable/disable Crashlytics collection with feedback
export const setCrashlyticsCollectionEnabled = async (enabled) => {
    console.log(`🔄 [Crashlytics] Setting collection ${enabled ? 'enabled' : 'disabled'}...`);

    try {
        await safeCrashlytics(() => crashlytics().setCrashlyticsCollectionEnabled(enabled));
        console.log(`✅ [Crashlytics] Collection ${enabled ? 'enabled' : 'disabled'} successfully`);
        return true;
    } catch (error) {
        console.error('❌ [Crashlytics] Error setting collection status:', error);
        return false;
    }
};

// Get Crashlytics collection status with detailed logging
export const isCrashlyticsCollectionEnabled = async () => {
    try {
        const enabled = await crashlytics().isCrashlyticsCollectionEnabled();
        console.log('🔍 [Crashlytics] Collection status:', enabled);
        return enabled;
    } catch (error) {
        console.error('❌ [Crashlytics] Error checking collection status:', error);
        return false;
    }
};

// Force send any pending reports
export const forceSendReports = async () => {
    console.log('📤 [Crashlytics] Force sending reports...');

    try {
        // This will force send any pending crash reports
        await crashlytics().sendUnsentReports();
        console.log('✅ [Crashlytics] Reports sent successfully');
        return true;
    } catch (error) {
        console.error('❌ [Crashlytics] Error sending reports:', error);
        return false;
    }
};

// Get detailed Crashlytics status
export const getCrashlyticsStatus = async () => {
    try {
        const collectionEnabled = await crashlytics().isCrashlyticsCollectionEnabled();

        console.log('📊 [Crashlytics] Status Report:');
        console.log('  - Collection enabled:', collectionEnabled);
        console.log('  - Module available:', !!crashlytics);
        console.log('  - Environment:', __DEV__ ? 'development' : 'production');

        return {
            collectionEnabled,
            moduleAvailable: !!crashlytics,
            environment: __DEV__ ? 'development' : 'production'
        };
    } catch (error) {
        console.error('❌ [Crashlytics] Error getting status:', error);
        return {
            collectionEnabled: false,
            moduleAvailable: false,
            error: error.message
        };
    }
}; 