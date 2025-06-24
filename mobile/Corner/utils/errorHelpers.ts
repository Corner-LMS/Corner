// Utility functions for handling authentication errors and user guidance

export interface ErrorGuidance {
    message: string;
    action?: string;
    actionText?: string;
    showAction?: boolean;
}

export function getErrorGuidance(errorMessage: string): ErrorGuidance {
    const message = errorMessage.toLowerCase();

    // Email verification errors
    if (message.includes('verify your email') || message.includes('email not verified')) {
        return {
            message: 'Please verify your email address before signing in.',
            action: 'resend',
            actionText: 'Resend Verification Email',
            showAction: true
        };
    }

    // Account not found
    if (message.includes('no account found') || message.includes('user not found')) {
        return {
            message: 'No account found with this email address.',
            action: 'signup',
            actionText: 'Create Account',
            showAction: true
        };
    }

    // Wrong password
    if (message.includes('incorrect password') || message.includes('wrong password') || message.includes('invalid password')) {
        return {
            message: 'Incorrect password. Please try again.',
            action: 'reset',
            actionText: 'Reset Password',
            showAction: true
        };
    }

    // Account already exists
    if (message.includes('already exists') || message.includes('email already in use')) {
        return {
            message: 'An account with this email already exists.',
            action: 'login',
            actionText: 'Sign In Instead',
            showAction: true
        };
    }

    // Weak password
    if (message.includes('weak password') || message.includes('password is too weak')) {
        return {
            message: 'Password is too weak. Please use at least 8 characters with numbers and special characters.',
            showAction: false
        };
    }

    // Invalid email
    if (message.includes('invalid email') || message.includes('valid email')) {
        return {
            message: 'Please enter a valid email address.',
            showAction: false
        };
    }

    // Network errors
    if (message.includes('network') || message.includes('connection')) {
        return {
            message: 'Network error. Please check your internet connection and try again.',
            showAction: false
        };
    }

    // Too many requests
    if (message.includes('too many') || message.includes('rate limit')) {
        return {
            message: 'Too many failed attempts. Please try again later.',
            showAction: false
        };
    }

    // Account disabled
    if (message.includes('disabled') || message.includes('suspended')) {
        return {
            message: 'This account has been disabled. Please contact support for assistance.',
            showAction: false
        };
    }

    // Default error
    return {
        message: 'An unexpected error occurred. Please try again.',
        showAction: false
    };
}

export function getPasswordStrengthMessage(password: string): string {
    if (password.length < 8) {
        return 'Password must be at least 8 characters long';
    }

    if (!/\d/.test(password)) {
        return 'Password must contain at least one number';
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        return 'Password must contain at least one special character';
    }

    return 'Password meets requirements';
}

export function getPasswordStrengthColor(password: string): string {
    if (password.length < 8) return '#ef4444'; // red
    if (!/\d/.test(password) || !/[!@#$%^&*(),.?":{}|<>]/.test(password)) return '#f59e0b'; // yellow
    return '#10b981'; // green
}

export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function getEmailValidationMessage(email: string): string {
    if (!email) return '';
    if (!validateEmail(email)) return 'Please enter a valid email address';
    return '';
} 