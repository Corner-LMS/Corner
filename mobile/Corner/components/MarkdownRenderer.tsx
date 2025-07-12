import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MarkdownRendererProps {
    content: string;
    style?: any;
}

export default function MarkdownRenderer({ content, style }: MarkdownRendererProps) {
    if (!content) return null;

    // Simple markdown parser for basic formatting
    const renderMarkdown = (text: string) => {
        // Split by lines to handle block elements
        const lines = text.split('\n');
        const elements: React.ReactNode[] = [];

        lines.forEach((line, index) => {
            if (!line.trim()) {
                elements.push(<View key={`empty-${index}`} style={styles.emptyLine} />);
                return;
            }

            // Headings
            if (line.startsWith('# ')) {
                elements.push(
                    <Text key={`h1-${index}`} style={styles.h1}>
                        {line.substring(2)}
                    </Text>
                );
                return;
            }

            if (line.startsWith('## ')) {
                elements.push(
                    <Text key={`h2-${index}`} style={styles.h2}>
                        {line.substring(3)}
                    </Text>
                );
                return;
            }

            // Blockquotes
            if (line.startsWith('> ')) {
                elements.push(
                    <View key={`quote-${index}`} style={styles.quoteContainer}>
                        <View style={styles.quoteBar} />
                        <Text style={styles.quoteText}>
                            {line.substring(2)}
                        </Text>
                    </View>
                );
                return;
            }

            // Lists
            if (line.startsWith('- ')) {
                elements.push(
                    <View key={`bullet-${index}`} style={styles.listItem}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.listText}>
                            {parseInlineMarkdown(line.substring(2))}
                        </Text>
                    </View>
                );
                return;
            }

            if (/^\d+\.\s/.test(line)) {
                const match = line.match(/^(\d+)\.\s(.+)/);
                if (match) {
                    elements.push(
                        <View key={`numbered-${index}`} style={styles.listItem}>
                            <Text style={styles.number}>{match[1]}.</Text>
                            <Text style={styles.listText}>
                                {parseInlineMarkdown(match[2])}
                            </Text>
                        </View>
                    );
                }
                return;
            }

            // Regular paragraph
            elements.push(
                <Text key={`p-${index}`} style={styles.paragraph}>
                    {parseInlineMarkdown(line)}
                </Text>
            );
        });

        return elements;
    };

    // Parse inline markdown (bold, italic, code, links)
    const parseInlineMarkdown = (text: string) => {
        if (!text) return text;

        // Process patterns in order of specificity to avoid conflicts
        const patterns = [
            // Bold: **text** (must come before italic to avoid conflicts)
            { regex: /\*\*(.*?)\*\*/g, style: styles.bold, name: 'bold' },
            // Underline: __text__
            { regex: /__(.*?)__/g, style: styles.underline, name: 'underline' },
            // Strikethrough: ~~text~~
            { regex: /~~(.*?)~~/g, style: styles.strikethrough, name: 'strikethrough' },
            // Code: `code`
            { regex: /`(.*?)`/g, style: styles.code, name: 'code' },
            // Links: [text](url)
            { regex: /\[(.*?)\]\((.*?)\)/g, style: styles.link, name: 'link' }
        ];

        // Find all matches across all patterns
        const matches: Array<{ start: number, end: number, content: string, style: any, name: string }> = [];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.regex.exec(text)) !== null) {
                // Check if this match overlaps with any existing match
                const newMatch = {
                    start: match.index,
                    end: match.index + match[0].length,
                    content: pattern.name === 'link' ? match[1] : match[1],
                    style: pattern.style,
                    name: pattern.name
                };

                // Only add if it doesn't overlap with existing matches
                const hasOverlap = matches.some(existing =>
                    (newMatch.start < existing.end && newMatch.end > existing.start)
                );

                if (!hasOverlap) {
                    matches.push(newMatch);
                }
            }
        });

        // Handle italic separately to avoid conflicts with bold
        let italicMatches: Array<{ start: number, end: number, content: string, style: any, name: string }> = [];
        const italicRegex = /\*(.*?)\*/g;
        let italicMatch;

        while ((italicMatch = italicRegex.exec(text)) !== null) {
            const newMatch = {
                start: italicMatch.index,
                end: italicMatch.index + italicMatch[0].length,
                content: italicMatch[1],
                style: styles.italic,
                name: 'italic'
            };

            // Check if this italic match conflicts with any existing matches
            const hasConflict = matches.some(existing =>
                (newMatch.start < existing.end && newMatch.end > existing.start)
            );

            // Also check if this is actually bold (double asterisks)
            const isBold = text.substring(Math.max(0, newMatch.start - 1), newMatch.end + 1).includes('**');

            if (!hasConflict && !isBold) {
                italicMatches.push(newMatch);
            }
        }

        // Combine all matches and sort
        const allMatches = [...matches, ...italicMatches].sort((a, b) => a.start - b.start);

        // Build the result by processing text segments
        let lastEnd = 0;
        const elements: React.ReactNode[] = [];
        let keyIndex = 0;

        allMatches.forEach(match => {
            // Add text before the match
            if (match.start > lastEnd) {
                const beforeText = text.substring(lastEnd, match.start);
                if (beforeText) {
                    elements.push(
                        <Text key={`text-${keyIndex++}`} style={styles.regular}>
                            {beforeText}
                        </Text>
                    );
                }
            }

            // Add the formatted text
            elements.push(
                <Text key={`${match.name}-${keyIndex++}`} style={match.style}>
                    {match.content}
                </Text>
            );

            lastEnd = match.end;
        });

        // Add remaining text after the last match
        if (lastEnd < text.length) {
            const remainingText = text.substring(lastEnd);
            if (remainingText) {
                elements.push(
                    <Text key={`text-${keyIndex++}`} style={styles.regular}>
                        {remainingText}
                    </Text>
                );
            }
        }

        return elements.length > 0 ? elements : text;
    };

    return (
        <View style={[styles.container, style]}>
            {renderMarkdown(content)}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    emptyLine: {
        height: 8,
    },
    h1: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 12,
        marginTop: 8,
        lineHeight: 32,
    },
    h2: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 10,
        marginTop: 6,
        lineHeight: 28,
    },
    paragraph: {
        fontSize: 16,
        color: '#475569',
        lineHeight: 24,
        marginBottom: 8,
    },
    quoteContainer: {
        flexDirection: 'row',
        marginVertical: 8,
        paddingLeft: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#4f46e5',
    },
    quoteBar: {
        width: 4,
        backgroundColor: '#4f46e5',
        marginRight: 12,
        borderRadius: 2,
    },
    quoteText: {
        fontSize: 16,
        color: '#64748b',
        fontStyle: 'italic',
        lineHeight: 24,
        flex: 1,
        paddingVertical: 8,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 4,
        paddingLeft: 8,
    },
    bullet: {
        fontSize: 16,
        color: '#4f46e5',
        marginRight: 8,
        marginTop: 2,
    },
    number: {
        fontSize: 16,
        color: '#4f46e5',
        fontWeight: '600',
        marginRight: 8,
        marginTop: 2,
        minWidth: 20,
    },
    listText: {
        fontSize: 16,
        color: '#475569',
        lineHeight: 24,
        flex: 1,
    },
    bold: {
        fontWeight: '700',
        color: '#1e293b',
    },
    italic: {
        fontStyle: 'italic',
        color: '#475569',
    },
    underline: {
        textDecorationLine: 'underline',
        color: '#475569',
    },
    strikethrough: {
        textDecorationLine: 'line-through',
        color: '#94a3b8',
    },
    code: {
        backgroundColor: '#f1f5f9',
        color: '#1e293b',
        fontFamily: 'monospace',
        fontSize: 14,
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    link: {
        color: '#4f46e5',
        textDecorationLine: 'underline',
    },
    regular: {
        color: '#475569',
    },
}); 