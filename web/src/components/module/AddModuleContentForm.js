// AddContentForm.js
import { useState } from 'react';
import TextContentForm from './TextContentForm';
import FileUploadForm from './FileUploadForm';
import LinkForm from './LinkForm';
export default function AddContentForm({ moduleId, onSuccess }) {
    const [contentType, setContentType] = useState('text');

    return (
        <div className="p-4 bg-gray-50 border-b">
            <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Content Type</label>
                <select
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value)}
                    className="w-full p-2 border rounded"
                >
                    <option value="text">Text Content</option>
                    <option value="document">File Upload</option>
                    <option value="video">Video</option>
                    <option value="link">External Link</option>
                </select>
            </div>

            {contentType === 'text' && (
                <TextContentForm
                    moduleId={moduleId}
                    onSuccess={onSuccess}
                />
            )}

            {(contentType === 'document' || contentType === 'video') && (
                <FileUploadForm
                    moduleId={moduleId}
                    type={contentType}
                    onSuccess={onSuccess}
                />
            )}

            {contentType === 'link' && (
                <LinkForm
                    moduleId={moduleId}
                    onSuccess={onSuccess}
                />
            )}
        </div>
    );
}