import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, Modal, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../config/ firebase-config.js';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';

interface CourseResource {
    id: string;
    title: string;
    type: 'link' | 'text';
    content: string; // URL for links, text content for text type
    description?: string;
    createdAt: any;
    createdBy: string;
}

type ResourceType = 'link' | 'text';

export default function CourseResourcesScreen() {
    const params = useLocalSearchParams();
    const { courseId, courseName, role } = params;

    const [resources, setResources] = useState<CourseResource[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedResourceType, setSelectedResourceType] = useState<ResourceType>('text');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [textContent, setTextContent] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (!courseId) return;

        const resourcesQuery = query(
            collection(db, 'courses', courseId as string, 'resources'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(resourcesQuery, (snapshot) => {
            const resourcesList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as CourseResource[];
            setResources(resourcesList);
        });

        return unsubscribe;
    }, [courseId]);

    const handleAddResource = async () => {
        if (!title.trim()) {
            Alert.alert('Error', 'Please enter a title for the resource.');
            return;
        }

        if (selectedResourceType === 'text' && !textContent.trim()) {
            Alert.alert('Error', 'Please enter the text content.');
            return;
        }

        if (selectedResourceType === 'link' && !linkUrl.trim()) {
            Alert.alert('Error', 'Please enter a valid URL.');
            return;
        }

        try {
            setIsUploading(true);

            let content = '';
            if (selectedResourceType === 'text') {
                content = textContent.trim();
            } else if (selectedResourceType === 'link') {
                content = linkUrl.trim();
            }

            await addDoc(collection(db, 'courses', courseId as string, 'resources'), {
                title: title.trim(),
                type: selectedResourceType,
                content,
                description: description.trim() || undefined,
                createdAt: serverTimestamp(),
                createdBy: 'teacher' // In a real app, you'd use the actual user ID
            });

            // Reset form
            setTitle('');
            setDescription('');
            setTextContent('');
            setLinkUrl('');
            setShowAddModal(false);

            Alert.alert('Success', 'Resource added successfully!');

        } catch (error) {
            console.error('Error adding resource:', error);
            Alert.alert('Error', 'Failed to add resource. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteResource = async (resourceId: string) => {
        Alert.alert(
            'Delete Resource',
            'Are you sure you want to delete this resource?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'courses', courseId as string, 'resources', resourceId));
                            Alert.alert('Success', 'Resource deleted successfully!');
                        } catch (error) {
                            console.error('Error deleting resource:', error);
                            Alert.alert('Error', 'Failed to delete resource.');
                        }
                    }
                }
            ]
        );
    };

    const getResourceIcon = (type: ResourceType) => {
        switch (type) {
            case 'link':
                return 'link';
            case 'text':
                return 'reader';
            default:
                return 'document';
        }
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
    };

    const renderResourceCard = (resource: CourseResource) => (
        <View key={resource.id} style={styles.resourceCard}>
            <View style={styles.resourceHeader}>
                <View style={styles.resourceInfo}>
                    <Ionicons
                        name={getResourceIcon(resource.type)}
                        size={24}
                        color="#81171b"
                        style={styles.resourceIcon}
                    />
                    <View style={styles.resourceDetails}>
                        <Text style={styles.resourceTitle}>{resource.title}</Text>
                        {resource.description && (
                            <Text style={styles.resourceDescription}>{resource.description}</Text>
                        )}
                        <View style={styles.resourceMeta}>
                            <Text style={styles.resourceType}>
                                {resource.type.toUpperCase()}
                            </Text>
                        </View>
                    </View>
                </View>
                {role === 'teacher' && (
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteResource(resource.id)}
                    >
                        <Ionicons name="trash" size={20} color="#ef4444" />
                    </TouchableOpacity>
                )}
            </View>

            {resource.type === 'text' && (
                <View style={styles.textContent}>
                    <Text style={styles.textContentText}>{resource.content}</Text>
                </View>
            )}

            {resource.type === 'link' && (
                <TouchableOpacity
                    style={styles.linkButton}
                    onPress={async () => {
                        try {
                            const url = resource.content.startsWith('http') ? resource.content : `https://${resource.content}`;
                            const canOpen = await Linking.canOpenURL(url);
                            if (canOpen) {
                                await Linking.openURL(url);
                            } else {
                                Alert.alert('Error', 'Cannot open this URL');
                            }
                        } catch (error) {
                            console.error('Error opening URL:', error);
                            Alert.alert('Error', 'Failed to open the link');
                        }
                    }}
                >
                    <Text style={styles.linkText}>Open Link</Text>
                    <Ionicons name="open-outline" size={16} color="#81171b" />
                </TouchableOpacity>
            )}
        </View>
    );

    if (role !== 'teacher') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Pressable style={styles.backButton} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#81171b" />
                    </Pressable>
                    <View style={styles.headerInfo}>
                        <Text style={styles.headerTitle}>Course Resources</Text>
                        <Text style={styles.headerSubtitle}>{courseName}</Text>
                    </View>
                </View>

                <ScrollView style={styles.content}>
                    {resources.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="folder-open-outline" size={64} color="#94a3b8" />
                            <Text style={styles.emptyStateText}>No resources available</Text>
                            <Text style={styles.emptyStateSubtext}>
                                Your instructor hasn't added any resources yet.
                            </Text>
                        </View>
                    ) : (
                        resources.map(renderResourceCard)
                    )}
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#81171b" />
                </Pressable>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>Course Resources</Text>
                    <Text style={styles.headerSubtitle}>{courseName}</Text>
                </View>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowAddModal(true)}
                >
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {resources.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="folder-open-outline" size={64} color="#94a3b8" />
                        <Text style={styles.emptyStateText}>No resources yet</Text>
                        <Text style={styles.emptyStateSubtext}>
                            Add your first course resource to help students learn better.
                        </Text>
                    </View>
                ) : (
                    resources.map(renderResourceCard)
                )}
            </ScrollView>

            {/* Add Resource Modal */}
            <Modal visible={showAddModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Resource</Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            {/* Resource Type Selection */}
                            <Text style={styles.sectionTitle}>Resource Type</Text>
                            <View style={styles.typeSelector}>
                                {(['link', 'text'] as ResourceType[]).map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.typeButton,
                                            selectedResourceType === type && styles.typeButtonActive
                                        ]}
                                        onPress={() => setSelectedResourceType(type)}
                                    >
                                        <Ionicons
                                            name={getResourceIcon(type)}
                                            size={20}
                                            color={selectedResourceType === type ? '#fff' : '#64748b'}
                                        />
                                        <Text style={[
                                            styles.typeButtonText,
                                            selectedResourceType === type && styles.typeButtonTextActive
                                        ]}>
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Title */}
                            <Text style={styles.inputLabel}>Title *</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Enter resource title"
                                value={title}
                                onChangeText={setTitle}
                                placeholderTextColor="#94a3b8"
                            />

                            {/* Description */}
                            <Text style={styles.inputLabel}>Description *</Text>
                            <TextInput
                                style={[styles.textInput, styles.textArea]}
                                placeholder="Brief description of the resource"
                                value={description}
                                onChangeText={setDescription}
                                multiline
                                numberOfLines={3}
                                placeholderTextColor="#94a3b8"
                            />

                            {/* Content based on type */}
                            {selectedResourceType === 'text' && (
                                <>
                                    <Text style={styles.inputLabel}>Content *</Text>
                                    <TextInput
                                        style={[styles.textInput, styles.textArea]}
                                        placeholder="Enter your text content, notes, or summary..."
                                        value={textContent}
                                        onChangeText={setTextContent}
                                        multiline
                                        numberOfLines={6}
                                        placeholderTextColor="#94a3b8"
                                    />
                                </>
                            )}

                            {selectedResourceType === 'link' && (
                                <>
                                    <Text style={styles.inputLabel}>URL *</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="https://example.com"
                                        value={linkUrl}
                                        onChangeText={setLinkUrl}
                                        keyboardType="url"
                                        autoCapitalize="none"
                                        placeholderTextColor="#94a3b8"
                                    />
                                </>
                            )}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setShowAddModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.saveButton, isUploading && styles.saveButtonDisabled]}
                                onPress={handleAddResource}
                                disabled={isUploading}
                            >
                                <Text style={styles.saveButtonText}>
                                    {isUploading ? 'Adding...' : 'Add Resource'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    backButton: {
        marginRight: 16,
        padding: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(129, 23, 27, 0.08)',
    },
    headerInfo: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        letterSpacing: -0.3,
    },
    headerSubtitle: {
        fontSize: 15,
        color: '#64748b',
        marginTop: 2,
        fontWeight: '500',
    },
    addButton: {
        backgroundColor: '#81171b',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#81171b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyStateText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#475569',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyStateSubtext: {
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 32,
    },
    resourceCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    resourceHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    resourceInfo: {
        flexDirection: 'row',
        flex: 1,
    },
    resourceIcon: {
        marginRight: 12,
        marginTop: 2,
    },
    resourceDetails: {
        flex: 1,
    },
    resourceTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 4,
    },
    resourceDescription: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 8,
        lineHeight: 20,
    },
    resourceMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    resourceType: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
    },
    deleteButton: {
        padding: 8,
        marginLeft: 12,
    },
    textContent: {
        marginTop: 12,
        padding: 16,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#81171b',
    },
    textContentText: {
        fontSize: 14,
        color: '#475569',
        lineHeight: 20,
    },
    linkButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingVertical: 8,
    },
    linkText: {
        fontSize: 14,
        color: '#81171b',
        fontWeight: '500',
        marginRight: 6,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
    },
    modalBody: {
        padding: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 12,
    },
    typeSelector: {
        flexDirection: 'row',
        marginBottom: 24,
        gap: 12,
    },
    typeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    typeButtonActive: {
        backgroundColor: '#81171b',
        borderColor: '#81171b',
    },
    typeButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#64748b',
        marginLeft: 6,
    },
    typeButtonTextActive: {
        color: '#fff',
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
        marginTop: 16,
    },
    textInput: {
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#1e293b',
        backgroundColor: '#f8fafc',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    modalFooter: {
        flexDirection: 'row',
        padding: 24,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748b',
    },
    saveButton: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 12,
        backgroundColor: '#81171b',
        alignItems: 'center',
    },
    saveButtonDisabled: {
        backgroundColor: '#94a3b8',
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
}); 