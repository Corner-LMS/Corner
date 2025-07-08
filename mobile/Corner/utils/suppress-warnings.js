/**
 * Utility to suppress React Native Firebase deprecation warnings
 * This is a temporary solution until the codebase is updated to use the new modular API
 */

// Store the original console.warn
const originalWarn = console.warn;

// Override console.warn to filter out Firebase deprecation warnings
console.warn = (...args) => {
    const message = args[0];

    // Check if this is a Firebase deprecation warning
    if (typeof message === 'string' &&
        message.includes('This method is deprecated') &&
        message.includes('React Native Firebase')) {
        return; // Suppress the warning
    }

    // Pass through all other warnings
    originalWarn.apply(console, args);
};

// Export a function to restore original console.warn if needed
export const restoreWarnings = () => {
    console.warn = originalWarn;
};

// Export a function to check if warnings are suppressed
export const areWarningsSuppressed = () => {
    return console.warn !== originalWarn;
}; 