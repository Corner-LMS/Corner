import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore, { collection, addDoc, serverTimestamp, doc, getDoc } from '@react-native-firebase/firestore';
import { offlineCacheService } from './offlineCache';

export interface DraftPost {
    id: string;
    type: 'discussion' | 'comment';
    title?: string; // Only for discussions
    content: string;
    courseId: string;
    discussionId?: string; // Only for comments
    parentId?: string; // For nested comments
    isAnonymous?: boolean;
    authorRole: string;
    instructorName?: string;
    createdAt: number;
    status: 'draft' | 'pending' | 'synced' | 'failed';
    retryCount: number;
    errorMessage?: string;
}

export interface SyncResult {
    success: boolean;
    syncedCount: number;
    failedCount: number;
    errors: string[];
}

class DraftManager {
    private readonly DRAFTS_KEY = 'offline_drafts';
    private readonly MAX_RETRY_COUNT = 3;

    // Save draft post
    async saveDraft(draft: Omit<DraftPost, 'id' | 'createdAt' | 'status' | 'retryCount'>): Promise<string> {
        try {
            const draftWithMeta: DraftPost = {
                ...draft,
                id: this.generateDraftId(),
                createdAt: Date.now(),
                status: 'draft',
                retryCount: 0
            };

            const existingDrafts = await this.getAllDrafts();
            const updatedDrafts = [...existingDrafts, draftWithMeta];

            await AsyncStorage.setItem(this.DRAFTS_KEY, JSON.stringify(updatedDrafts));

            return draftWithMeta.id;
        } catch (error) {
            console.error('Error saving draft:', error);
            throw error;
        }
    }

    // Get all drafts
    async getAllDrafts(): Promise<DraftPost[]> {
        try {
            const drafts = await AsyncStorage.getItem(this.DRAFTS_KEY);
            return drafts ? JSON.parse(drafts) : [];
        } catch (error) {
            console.error('Error getting drafts:', error);
            return [];
        }
    }

    // Get all drafts with status info for debugging
    async getAllDraftsWithStatus(): Promise<{
        drafts: DraftPost[];
        stats: {
            total: number;
            draft: number;
            pending: number;
            synced: number;
            failed: number;
            exceededRetry: number;
        };
    }> {
        try {
            const allDrafts = await this.getAllDrafts();
            const stats = {
                total: allDrafts.length,
                draft: allDrafts.filter(d => d.status === 'draft').length,
                pending: allDrafts.filter(d => d.status === 'pending').length,
                synced: allDrafts.filter(d => d.status === 'synced').length,
                failed: allDrafts.filter(d => d.status === 'failed').length,
                exceededRetry: allDrafts.filter(d => d.status === 'failed' && d.retryCount >= this.MAX_RETRY_COUNT).length,
            };

            return { drafts: allDrafts, stats };
        } catch (error) {
            console.error('Error getting drafts with status:', error);
            return {
                drafts: [],
                stats: {
                    total: 0,
                    draft: 0,
                    pending: 0,
                    synced: 0,
                    failed: 0,
                    exceededRetry: 0,
                }
            };
        }
    }

    // Get drafts by course
    async getDraftsByCourse(courseId: string): Promise<DraftPost[]> {
        try {
            const allDrafts = await this.getAllDrafts();
            return allDrafts.filter(draft => draft.courseId === courseId);
        } catch (error) {
            console.error('Error getting drafts by course:', error);
            return [];
        }
    }

    // Get drafts by discussion
    async getDraftsByDiscussion(discussionId: string): Promise<DraftPost[]> {
        try {
            const allDrafts = await this.getAllDrafts();
            return allDrafts.filter(draft => draft.discussionId === discussionId);
        } catch (error) {
            console.error('Error getting drafts by discussion:', error);
            return [];
        }
    }

    // Get pending drafts (ready to sync)
    async getPendingDrafts(): Promise<DraftPost[]> {
        try {
            const allDrafts = await this.getAllDrafts();
            return allDrafts.filter(draft =>
                (draft.status === 'draft' || draft.status === 'failed') &&
                draft.retryCount < this.MAX_RETRY_COUNT
            );
        } catch (error) {
            console.error('Error getting pending drafts:', error);
            return [];
        }
    }

    // Get drafts that have exceeded retry limit
    async getExceededRetryDrafts(): Promise<DraftPost[]> {
        try {
            const allDrafts = await this.getAllDrafts();
            return allDrafts.filter(draft =>
                draft.status === 'failed' && draft.retryCount >= this.MAX_RETRY_COUNT
            );
        } catch (error) {
            console.error('Error getting exceeded retry drafts:', error);
            return [];
        }
    }

    // Retry a failed draft (reset retry count)
    async retryDraft(draftId: string): Promise<void> {
        try {
            const allDrafts = await this.getAllDrafts();
            const updatedDrafts = allDrafts.map(draft => {
                if (draft.id === draftId) {
                    return {
                        ...draft,
                        status: 'draft' as const,
                        retryCount: 0,
                        errorMessage: undefined
                    };
                }
                return draft;
            });

            await AsyncStorage.setItem(this.DRAFTS_KEY, JSON.stringify(updatedDrafts));
        } catch (error) {
            console.error('Error retrying draft:', error);
        }
    }

    // Update draft status
    async updateDraftStatus(draftId: string, status: DraftPost['status'], errorMessage?: string): Promise<void> {
        try {
            const allDrafts = await this.getAllDrafts();
            const updatedDrafts = allDrafts.map(draft => {
                if (draft.id === draftId) {
                    return {
                        ...draft,
                        status,
                        errorMessage,
                        retryCount: status === 'failed' ? draft.retryCount + 1 : draft.retryCount
                    };
                }
                return draft;
            });

            await AsyncStorage.setItem(this.DRAFTS_KEY, JSON.stringify(updatedDrafts));
        } catch (error) {
            console.error('Error updating draft status:', error);
        }
    }

    // Delete draft
    async deleteDraft(draftId: string): Promise<void> {
        try {
            const allDrafts = await this.getAllDrafts();
            const filteredDrafts = allDrafts.filter(draft => draft.id !== draftId);

            await AsyncStorage.setItem(this.DRAFTS_KEY, JSON.stringify(filteredDrafts));
        } catch (error) {
            console.error('Error deleting draft:', error);
        }
    }

    // Sync single draft to Firebase
    async syncDraft(draft: DraftPost): Promise<boolean> {
        try {
            const user = auth().currentUser;
            if (!user) {
                throw new Error('User not authenticated');
            }

            await this.updateDraftStatus(draft.id, 'pending');

            if (draft.type === 'discussion') {
                await this.syncDiscussionDraft(draft, user.uid);
            } else if (draft.type === 'comment') {
                await this.syncCommentDraft(draft, user.uid);
            }

            await this.updateDraftStatus(draft.id, 'synced');

            // Remove synced draft after a delay to allow UI to show success
            setTimeout(() => {
                this.deleteDraft(draft.id);
            }, 2000);

            return true;
        } catch (error: any) {
            console.error(`Error syncing draft ${draft.id}:`, error);
            await this.updateDraftStatus(draft.id, 'failed', error.message);
            return false;
        }
    }

    // Sync discussion draft
    private async syncDiscussionDraft(draft: DraftPost, userId: string): Promise<void> {
        if (!draft.title) {
            throw new Error('Discussion title is required');
        }

        // Get author name based on role
        let authorName: string;
        if (draft.authorRole === 'teacher') {
            authorName = draft.instructorName || 'Teacher';
        } else {
            const userDoc = await firestore().collection('users').doc(userId).get();
            const userData = userDoc.data();
            authorName = userData?.name || 'Anonymous';
        }

        const postData: any = {
            title: draft.title,
            content: draft.content,
            createdAt: serverTimestamp(),
            authorRole: draft.authorRole,
            authorId: userId,
            replies: 0
        };

        // Handle anonymity for students
        if (draft.authorRole === 'student' && draft.isAnonymous) {
            postData.authorName = 'Anonymous Student';
            postData.isAnonymous = true;
        } else {
            postData.authorName = authorName;
            postData.isAnonymous = false;
        }

        await firestore().collection('courses').doc(draft.courseId).collection('discussions').add(postData);
    }

    // Sync comment draft
    private async syncCommentDraft(draft: DraftPost, userId: string): Promise<void> {
        if (!draft.discussionId) {
            throw new Error('Discussion ID is required for comments');
        }

        // Get author name based on role
        let authorName: string;
        if (draft.authorRole === 'teacher') {
            authorName = draft.instructorName || 'Teacher';
        } else {
            const userDoc = await firestore().collection('users').doc(userId).get();
            const userData = userDoc.data();
            authorName = userData?.name || 'Anonymous';
        }

        const commentData: any = {
            content: draft.content,
            createdAt: serverTimestamp(),
            authorRole: draft.authorRole,
            authorId: userId,
            depth: this.calculateCommentDepth(draft.parentId),
            parentId: draft.parentId || null
        };

        // Handle anonymity for students
        if (draft.authorRole === 'student' && draft.isAnonymous) {
            commentData.authorName = 'Anonymous Student';
            commentData.isAnonymous = true;
        } else {
            commentData.authorName = authorName;
            commentData.isAnonymous = false;
        }

        await firestore().collection('courses').doc(draft.courseId).collection('discussions').doc(draft.discussionId).collection('comments').add(commentData);
    }

    // Sync all pending drafts
    async syncAllDrafts(): Promise<SyncResult> {
        const pendingDrafts = await this.getPendingDrafts();
        const errors: string[] = [];
        let syncedCount = 0;
        let failedCount = 0;

        if (pendingDrafts.length === 0) {
            return {
                success: true,
                syncedCount: 0,
                failedCount: 0,
                errors: []
            };
        }

        for (const draft of pendingDrafts) {
            try {
                const success = await this.syncDraft(draft);
                if (success) {
                    syncedCount++;
                } else {
                    failedCount++;
                    const errorMsg = `Failed to sync ${draft.type}: ${draft.title || draft.content.substring(0, 50)}`;
                    errors.push(errorMsg);
                }
            } catch (error: any) {
                failedCount++;
                const errorMsg = `Error syncing ${draft.type}: ${error.message}`;
                errors.push(errorMsg);
            }
        }

        return {
            success: failedCount === 0,
            syncedCount,
            failedCount,
            errors
        };
    }

    // Force sync all drafts (including those that exceeded retry limit)
    async forceSyncAllDrafts(): Promise<SyncResult> {
        try {
            const allDrafts = await this.getAllDrafts();
            const failedDrafts = allDrafts.filter(draft =>
                draft.status === 'failed' && draft.retryCount >= this.MAX_RETRY_COUNT
            );

            // Reset retry count for drafts that exceeded limit
            for (const draft of failedDrafts) {
                await this.retryDraft(draft.id);
            }

            // Now sync all drafts
            return await this.syncAllDrafts();
        } catch (error) {
            console.error('Error in force sync:', error);
            return {
                success: false,
                syncedCount: 0,
                failedCount: 1,
                errors: [`Force sync error: ${error}`]
            };
        }
    }

    // Clear all drafts
    async clearAllDrafts(): Promise<void> {
        try {
            await AsyncStorage.removeItem(this.DRAFTS_KEY);
        } catch (error) {
            console.error('Error clearing drafts:', error);
        }
    }

    // Clear drafts for specific course
    async clearCourseDrafts(courseId: string): Promise<void> {
        try {
            const allDrafts = await this.getAllDrafts();
            const filteredDrafts = allDrafts.filter(draft => draft.courseId !== courseId);

            await AsyncStorage.setItem(this.DRAFTS_KEY, JSON.stringify(filteredDrafts));
        } catch (error) {
            console.error('Error clearing course drafts:', error);
        }
    }

    // Get draft statistics
    async getDraftStats(): Promise<{
        total: number;
        byStatus: Record<DraftPost['status'], number>;
        byType: Record<DraftPost['type'], number>;
    }> {
        try {
            const allDrafts = await this.getAllDrafts();

            const byStatus: Record<DraftPost['status'], number> = {
                draft: 0,
                pending: 0,
                synced: 0,
                failed: 0
            };

            const byType: Record<DraftPost['type'], number> = {
                discussion: 0,
                comment: 0
            };

            allDrafts.forEach(draft => {
                byStatus[draft.status]++;
                byType[draft.type]++;
            });

            return {
                total: allDrafts.length,
                byStatus,
                byType
            };
        } catch (error) {
            console.error('Error getting draft stats:', error);
            return {
                total: 0,
                byStatus: { draft: 0, pending: 0, synced: 0, failed: 0 },
                byType: { discussion: 0, comment: 0 }
            };
        }
    }

    // Helper methods
    private generateDraftId(): string {
        return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private calculateCommentDepth(parentId?: string): number {
        // In this simplified version, we'll use 0 for top-level comments
        // In a real implementation, you'd need to traverse the comment tree
        return parentId ? 1 : 0;
    }
}

export const draftManager = new DraftManager(); 