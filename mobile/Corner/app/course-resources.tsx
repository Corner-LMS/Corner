import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, Modal, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../config/ firebase-config.js';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { offlineCacheService, CachedResource } from '../services/offlineCache';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

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
    const { isOnline, hasReconnected } = useNetworkStatus();

    const [resources, setResources] = useState<CourseResource[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedResourceType, setSelectedResourceType] = useState<ResourceType>('text');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [textContent, setTextContent] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isLoadingFromCache, setIsLoadingFromCache] = useState(false);

    // Initialize cache on component mount
    useEffect(() => {
        offlineCacheService.initializeCache();
    }, []);

    // Load cached data when offline or sync when reconnected
    useEffect(() => {
        if (!courseId) return;

        if (isOnline) {
            // Online: Use Firebase listeners and cache the data
            setupFirebaseListener();
        } else {
            // Offline: Load cached data
            loadCachedResources();
        }

        // Sync when reconnected
        if (hasReconnected && courseId) {
            syncResourcesAfterReconnection();
        }
    }, [courseId, isOnline, hasReconnected]);

    const setupFirebaseListener = () => {
        if (!courseId) return;

        const resourcesQuery = query(
            collection(db, 'courses', courseId as string, 'resources'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(resourcesQuery, async (snapshot) => {
            const resourcesList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as CourseResource[];

            setResources(resourcesList);

            // Cache the resources when online
            try {
                await offlineCacheService.cacheResources(
                    courseId as string,
                    resourcesList,
                    courseName as string
                );
            } catch (error) {
                console.error('Error caching resources:', error);
            }
        });

        return unsubscribe;
    };

    const loadCachedResources = async () => {
        if (!courseId) return;

        setIsLoadingFromCache(true);
        try {
            const cachedResources = await offlineCacheService.getCachedResources(courseId as string);
            setResources(cachedResources as CourseResource[]);

            if (cachedResources.length > 0) {
                console.log(`Loaded ${cachedResources.length} cached resources`);
            }
        } catch (error) {
            console.error('Error loading cached resources:', error);
        } finally {
            setIsLoadingFromCache(false);
        }
    };

    const syncResourcesAfterReconnection = async () => {
        if (!courseId || !courseName) return;

        try {
            console.log('Syncing resources after reconnection...');
            await offlineCacheService.syncResourcesFromFirebase(
                courseId as string,
                courseName as string
            );
            await offlineCacheService.updateLastSyncTime();
        } catch (error) {
            console.error('Error syncing resources after reconnection:', error);
        }
    };

    const handleAddResource = async () => {
        if (!isOnline) {
            Alert.alert('Offline', 'You need to be online to add new resources.');
            return;
        }

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
                        color="#4f46e5"
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
                    <Ionicons name="open-outline" size={16} color="#4f46e5" />
                </TouchableOpacity>
            )}
        </View>
    );

    if (role !== 'teacher') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Pressable style={styles.backButton} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#4f46e5" />
                    </Pressable>
                    <View style={styles.headerInfo}>
                        <Text style={styles.headerTitle}>Course Resources</Text>
                        <Text style={styles.headerSubtitle}>{courseName}</Text>
                    </View>
                </View>

                <ScrollView style={styles.content}>
                    {/* Offline/Cache Status Indicator */}
                    {(!isOnline || isLoadingFromCache) && (
                        <View style={styles.offlineIndicator}>
                            <Ionicons
                                name={!isOnline ? "cloud-offline" : "refresh"}
                                size={16}
                                color={!isOnline ? "#f59e0b" : "#4f46e5"}
                            />
                            <Text style={styles.offlineText}>
                                {!isOnline ? "Offline - Showing cached resources" : "Loading cached resources..."}
                            </Text>
                        </View>
                    )}

                    {resources.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="folder-open-outline" size={64} color="#94a3b8" />
                            <Text style={styles.emptyStateText}>
                                {!isOnline ? "No cached resources available" : "No resources available"}
                            </Text>
                            <Text style={styles.emptyStateSubtext}>
                                {!isOnline
                                    ? "Resources will be available when you go back online."
                                    : "Your instructor hasn't added any resources yet."
                                }
                            </Text>
                        </View>
                    ) : (
                        resources.map(resource => (
                            <View key={resource.id}>
                                {renderResourceCard(resource)}
                                {!isOnline && (
                                    <View style={styles.cachedIndicator}>
                                        <Ionicons name="download" size={12} color="#4f46e5" />
                                        <Text style={styles.cachedText}>Cached content</Text>
                                    </View>
                                )}
                            </View>
                        ))
                    )}
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#4f46e5" />
                </Pressable>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>Course Resources</Text>
                    <Text style={styles.headerSubtitle}>{courseName}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.addButton, !isOnline && styles.addButtonDisabled]}
                    onPress={() => setShowAddModal(true)}
                    disabled={!isOnline}
                >
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {/* Offline/Cache Status Indicator */}
                {(!isOnline || isLoadingFromCache) && (
                    <View style={styles.offlineIndicator}>
                        <Ionicons
                            name={!isOnline ? "cloud-offline" : "refresh"}
                            size={16}
                            color={!isOnline ? "#f59e0b" : "#4f46e5"}
                        />
                        <Text style={styles.offlineText}>
                            {!isOnline ? "Offline - Showing cached resources" : "Loading cached resources..."}
                        </Text>
                    </View>
                )}

                {resources.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="folder-open-outline" size={64} color="#94a3b8" />
                        <Text style={styles.emptyStateText}>
                            {!isOnline ? "No cached resources available" : "No resources yet"}
                        </Text>
                        <Text style={styles.emptyStateSubtext}>
                            {!isOnline
                                ? "Resources will be available when you go back online."
                                : "Add your first course resource to help students learn better."
                            }
                        </Text>
                    </View>
                ) : (
                    resources.map(resource => (
                        <View key={resource.id}>
                            {renderResourceCard(resource)}
                            {!isOnline && (
                                <View style={styles.cachedIndicator}>
                                    <Ionicons name="download" size={12} color="#4f46e5" />
                                    <Text style={styles.cachedText}>Cached content</Text>
                                </View>
                            )}
                        </View>
                    ))
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
        backgroundColor: '#f1f5f9',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(241, 245, 249, 0.8)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    backButton: {
        marginRight: 16,
        padding: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
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
        fontSize: 14,
        color: '#64748b',
        marginTop: 4,
        fontWeight: '500',
    },
    addButton: {
        backgroundColor: '#4f46e5',
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    addButtonDisabled: {
        backgroundColor: '#94a3b8',
        shadowColor: '#94a3b8',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
    },
    emptyStateText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#475569',
        marginTop: 20,
        marginBottom: 8,
    },
    emptyStateSubtext: {
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 32,
        fontWeight: '500',
    },
    resourceCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    resourceHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    resourceInfo: {
        flexDirection: 'row',
        flex: 1,
    },
    resourceIcon: {
        marginRight: 16,
        marginTop: 2,
    },
    resourceDetails: {
        flex: 1,
    },
    resourceTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 8,
        letterSpacing: -0.3,
        lineHeight: 24,
    },
    resourceDescription: {
        fontSize: 15,
        color: '#64748b',
        marginBottom: 12,
        lineHeight: 22,
        fontWeight: '500',
    },
    resourceMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    resourceType: {
        fontSize: 12,
        color: '#4f46e5',
        fontWeight: '700',
        letterSpacing: 0.5,
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    deleteButton: {
        padding: 8,
        marginLeft: 12,
        borderRadius: 8,
        backgroundColor: '#fef2f2',
    },
    textContent: {
        marginTop: 16,
        padding: 20,
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#4f46e5',
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    textContentText: {
        fontSize: 15,
        color: '#475569',
        lineHeight: 22,
        fontWeight: '500',
    },
    linkButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(79, 70, 229, 0.2)',
    },
    linkText: {
        fontSize: 15,
        color: '#4f46e5',
        fontWeight: '700',
        marginRight: 8,
        letterSpacing: 0.3,
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
        letterSpacing: -0.3,
    },
    modalBody: {
        padding: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 16,
        letterSpacing: -0.2,
    },
    typeSelector: {
        flexDirection: 'row',
        marginBottom: 32,
        gap: 16,
    },
    typeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    typeButtonActive: {
        backgroundColor: '#4f46e5',
        borderColor: '#4f46e5',
        shadowColor: '#4f46e5',
        shadowOpacity: 0.2,
    },
    typeButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#64748b',
        marginLeft: 8,
    },
    typeButtonTextActive: {
        color: '#fff',
        fontWeight: '700',
    },
    inputLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 12,
        marginTop: 20,
        letterSpacing: -0.1,
    },
    textInput: {
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        padding: 18,
        fontSize: 16,
        color: '#1e293b',
        backgroundColor: '#fff',
        fontWeight: '500',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    textArea: {
        height: 120,
        textAlignVertical: 'top',
        lineHeight: 24,
    },
    modalFooter: {
        flexDirection: 'row',
        padding: 24,
        gap: 16,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 18,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#64748b',
        letterSpacing: 0.3,
    },
    saveButton: {
        flex: 1,
        paddingVertical: 18,
        borderRadius: 16,
        backgroundColor: '#4f46e5',
        alignItems: 'center',
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonDisabled: {
        backgroundColor: '#94a3b8',
        shadowOpacity: 0.1,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.3,
    },
    offlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(241, 245, 249, 0.8)',
    },
    offlineText: {
        fontSize: 14,
        color: '#64748b',
        marginLeft: 8,
    },
    cachedIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: 'rgba(241, 245, 249, 0.8)',
    },
    cachedText: {
        fontSize: 14,
        color: '#64748b',
        marginLeft: 8,
    },
}); 