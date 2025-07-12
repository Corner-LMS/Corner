import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MarkdownRenderer from './MarkdownRenderer';

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    style?: any;
    disabled?: boolean;
}

export default function RichTextEditor({
    value,
    onChange,
    placeholder = "Start typing...",
    style,
    disabled = false,
}: RichTextEditorProps) {
    const [plainText, setPlainText] = useState(value || '');
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const textInputRef = useRef<TextInput>(null);

    // Update plainText when value prop changes (for editing existing content)
    React.useEffect(() => {
        setPlainText(value || '');
    }, [value]);

    const handleTextChange = (text: string) => {
        setPlainText(text);
        // Pass the text as HTML for proper formatting
        onChange(text);
    };

    const applyFormatting = (format: string) => {
        const { start, end } = selection;
        if (start === end) {
            // No text selected, insert formatting template
            insertFormatting(format);
            return;
        }

        const selectedText = plainText.substring(start, end);
        let formattedText = '';

        switch (format) {
            case 'bold':
                formattedText = `**${selectedText}**`;
                break;
            case 'italic':
                formattedText = `*${selectedText}*`;
                break;
            case 'underline':
                formattedText = `__${selectedText}__`;
                break;
            case 'code':
                formattedText = `\`${selectedText}\``;
                break;
            case 'strikethrough':
                formattedText = `~~${selectedText}~~`;
                break;
            default:
                formattedText = selectedText;
        }

        const newText = plainText.substring(0, start) + formattedText + plainText.substring(end);
        setPlainText(newText);
        onChange(newText);
    };

    const insertFormatting = (format: string) => {
        const { start } = selection;
        let insertText = '';

        switch (format) {
            case 'bold':
                insertText = '**bold text**';
                break;
            case 'italic':
                insertText = '*italic text*';
                break;
            case 'underline':
                insertText = '__underlined text__';
                break;
            case 'code':
                insertText = '`code`';
                break;
            case 'strikethrough':
                insertText = '~~strikethrough text~~';
                break;
            case 'link':
                insertText = '[link text](url)';
                break;
            case 'list':
                insertText = '- list item';
                break;
            case 'numbered':
                insertText = '1. numbered item';
                break;
            case 'quote':
                insertText = '> quote text';
                break;
            default:
                insertText = '';
        }

        if (insertText) {
            const newText = plainText.substring(0, start) + insertText + plainText.substring(start);
            setPlainText(newText);
            onChange(newText);
        }
    };

    const togglePreviewMode = () => {
        setIsPreviewMode(!isPreviewMode);
    };

    return (
        <View style={[styles.container, style]}>
            {/* Toolbar */}
            <View style={styles.toolbar}>
                <View style={styles.toolbarRow}>
                    <TouchableOpacity
                        style={styles.toolbarButton}
                        onPress={() => applyFormatting('bold')}
                        disabled={disabled}
                    >
                        <Text style={styles.boldButton}>B</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.toolbarButton}
                        onPress={() => applyFormatting('italic')}
                        disabled={disabled}
                    >
                        <Text style={styles.formatButton}>I</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.toolbarButton}
                        onPress={() => applyFormatting('code')}
                        disabled={disabled}
                    >
                        <Text style={styles.codeButton}>{"</>"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.previewButton, isPreviewMode && styles.previewButtonActive]}
                        onPress={togglePreviewMode}
                        disabled={disabled}
                    >
                        <Ionicons
                            name={isPreviewMode ? "create" : "eye"}
                            size={14}
                            color={isPreviewMode ? "#fff" : "#4f46e5"}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content Area */}
            {isPreviewMode ? (
                <View style={styles.previewContainer}>
                    <MarkdownRenderer content={plainText} style={styles.previewContent} />
                </View>
            ) : (
                <TextInput
                    ref={textInputRef}
                    style={styles.editor}
                    value={plainText}
                    onChangeText={handleTextChange}
                    onSelectionChange={(event) => {
                        setSelection(event.nativeEvent.selection);
                    }}
                    onContentSizeChange={(event) => {
                        // This helps with dynamic height adjustment
                        const { height } = event.nativeEvent.contentSize;
                    }}
                    placeholder={placeholder}
                    placeholderTextColor="#666"
                    multiline
                    editable={!disabled}
                    textAlignVertical="top"
                    scrollEnabled={true}
                    returnKeyType="default"
                    blurOnSubmit={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    toolbar: {
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        padding: 8,
    },
    toolbarRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'nowrap',
    },
    toolbarButton: {
        padding: 8,
        marginRight: 4,
        borderRadius: 6,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        minWidth: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    editor: {
        minHeight: 100,
        maxHeight: 200, // Increased to allow more content and proper scrolling
        padding: 12,
        fontSize: 16,
        lineHeight: 24,
        color: '#1e293b',
        textAlignVertical: 'top',
        backgroundColor: '#fff',
    },
    previewContainer: {
        minHeight: 100,
        padding: 12,
        backgroundColor: '#fff',
    },
    previewContent: {
        flex: 1,
    },
    boldButton: {
        fontSize: 14,
        fontWeight: '700',
        color: '#4f46e5',
    },
    formatButton: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4f46e5',
    },
    codeButton: {
        fontSize: 10,
        fontWeight: '700',
        color: '#4f46e5',
    },
    previewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 6,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        minWidth: 36,
        height: 36,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    previewButtonActive: {
        backgroundColor: '#4f46e5',
        borderColor: '#4f46e5',
    },
    previewText: {
        fontSize: 10,
        color: '#4f46e5',
        marginLeft: 2,
        fontWeight: '600',
    },
    previewTextActive: {
        color: '#fff',
    },
}); 