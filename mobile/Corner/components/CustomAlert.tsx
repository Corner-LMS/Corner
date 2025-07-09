import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AlertAction {
    text: string;
    onPress: () => void;
    style?: 'default' | 'cancel' | 'destructive' | 'primary';
}

interface CustomAlertProps {
    visible: boolean;
    title: string;
    message: string;
    actions: AlertAction[];
    type?: 'info' | 'warning' | 'error' | 'success' | 'confirm';
    onDismiss?: () => void;
}

const { width } = Dimensions.get('window');

export default function CustomAlert({
    visible,
    title,
    message,
    actions,
    type = 'info',
    onDismiss
}: CustomAlertProps) {
    const getIconAndColor = () => {
        switch (type) {
            case 'warning':
                return { icon: 'warning', color: '#f59e0b' };
            case 'error':
                return { icon: 'alert-circle', color: '#ef4444' };
            case 'success':
                return { icon: 'checkmark-circle', color: '#10b981' };
            case 'confirm':
                return { icon: 'help-circle', color: '#3b82f6' };
            default:
                return { icon: 'information-circle', color: '#6b7280' };
        }
    };

    const getActionStyle = (actionStyle?: string) => {
        switch (actionStyle) {
            case 'destructive':
                return styles.destructiveButton;
            case 'primary':
                return styles.primaryButton;
            case 'cancel':
                return styles.cancelButton;
            default:
                return styles.defaultButton;
        }
    };

    const getActionTextStyle = (actionStyle?: string) => {
        switch (actionStyle) {
            case 'destructive':
                return styles.destructiveButtonText;
            case 'primary':
                return styles.primaryButtonText;
            case 'cancel':
                return styles.cancelButtonText;
            default:
                return styles.defaultButtonText;
        }
    };

    const { icon, color } = getIconAndColor();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onDismiss}
        >
            <View style={styles.overlay}>
                <View style={styles.alertContainer}>
                    <View style={styles.iconContainer}>
                        <Ionicons name={icon as any} size={32} color={color} />
                    </View>

                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>

                    <View style={styles.actionsContainer}>
                        {actions.map((action, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.actionButton,
                                    getActionStyle(action.style),
                                    actions.length === 1 && styles.singleActionButton
                                ]}
                                onPress={() => {
                                    action.onPress();
                                    if (onDismiss) onDismiss();
                                }}
                            >
                                <Text style={getActionTextStyle(action.style)}>
                                    {action.text}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    alertContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: Math.min(width - 40, 320),
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    iconContainer: {
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1f2937',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: -0.3,
    },
    message: {
        fontSize: 15,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
        fontWeight: '500',
    },
    actionsContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    actionButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
    },
    singleActionButton: {
        maxWidth: 120,
        alignSelf: 'center',
    },
    defaultButton: {
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    cancelButton: {
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    primaryButton: {
        backgroundColor: '#3b82f6',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    destructiveButton: {
        backgroundColor: '#ef4444',
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    defaultButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    cancelButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    primaryButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    destructiveButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
});

// Convenience functions for common alert types
export const showConfirmAlert = (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
) => {
    // This would be used with a state management solution
    // For now, return the props needed for the component
    return {
        visible: true,
        title,
        message,
        type: 'confirm' as const,
        actions: [
            {
                text: 'Cancel',
                onPress: onCancel || (() => { }),
                style: 'cancel' as const,
            },
            {
                text: 'Confirm',
                onPress: onConfirm,
                style: 'primary' as const,
            },
        ],
    };
};

export const showErrorAlert = (
    title: string,
    message: string,
    onDismiss?: () => void
) => {
    return {
        visible: true,
        title,
        message,
        type: 'error' as const,
        actions: [
            {
                text: 'OK',
                onPress: onDismiss || (() => { }),
                style: 'primary' as const,
            },
        ],
    };
};

export const showSuccessAlert = (
    title: string,
    message: string,
    onDismiss?: () => void
) => {
    return {
        visible: true,
        title,
        message,
        type: 'success' as const,
        actions: [
            {
                text: 'OK',
                onPress: onDismiss || (() => { }),
                style: 'primary' as const,
            },
        ],
    };
};

export const showWarningAlert = (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
) => {
    return {
        visible: true,
        title,
        message,
        type: 'warning' as const,
        actions: [
            {
                text: 'Cancel',
                onPress: onCancel || (() => { }),
                style: 'cancel' as const,
            },
            {
                text: 'Continue',
                onPress: onConfirm,
                style: 'destructive' as const,
            },
        ],
    };
}; 