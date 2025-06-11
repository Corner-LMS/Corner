import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { auth, db } from '../../config/ firebase-config';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

interface ProfileInitialsProps {
    size?: number;
    color: string;
    variant?: 'tab' | 'header';
}

export function ProfileInitials({ size = 24, color, variant = 'tab' }: ProfileInitialsProps) {
    const [initials, setInitials] = useState('?');

    useEffect(() => {
        if (!auth.currentUser) return;

        const unsubscribe = onSnapshot(
            doc(db, 'users', auth.currentUser.uid),
            (doc) => {
                if (doc.exists()) {
                    const userData = doc.data();
                    const name = userData.name || userData.email || 'User';

                    // Extract initials from name
                    const nameInitials = name
                        .split(' ')
                        .map((word: string) => word.charAt(0).toUpperCase())
                        .slice(0, 2)
                        .join('');

                    setInitials(nameInitials || name.charAt(0).toUpperCase());
                }
            },
            (error) => {
                console.error('Error fetching user data for initials:', error);
                setInitials('?');
            }
        );

        return () => unsubscribe();
    }, []);

    if (variant === 'header') {
        return (
            <View style={[
                styles.headerContainer,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                }
            ]}>
                <Text style={[
                    styles.headerInitialsText,
                    {
                        fontSize: size * 0.4,
                    }
                ]}>
                    {initials}
                </Text>
            </View>
        );
    }

    return (
        <View style={[
            styles.container,
            {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: color,
            }
        ]}>
            <Text style={[
                styles.initialsText,
                {
                    color: color,
                    fontSize: size * 0.4,
                }
            ]}>
                {initials}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        backgroundColor: 'transparent',
    },
    initialsText: {
        fontWeight: '600',
        textAlign: 'center',
    },
    headerContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerInitialsText: {
        color: '#fff',
        fontWeight: '700',
        textAlign: 'center',
    },
}); 