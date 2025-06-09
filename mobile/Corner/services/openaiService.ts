import OpenAI from 'openai';
import { OPENAI_CONFIG, validateOpenAIConfig } from '../config/openai.config';

interface CourseContext {
    discussions: any[];
    announcements: any[];
    courseName: string;
    courseCode: string;
    instructorName: string;
}

interface ResourceRecommendation {
    title: string;
    type: 'discussion' | 'announcement' | 'link' | 'file';
    id?: string;
    description: string;
    relevanceScore: number;
}

class OpenAIService {
    private openai: OpenAI | null = null;
    private isConfigured: boolean = false;

    constructor() {
        this.initializeOpenAI();
    }

    private initializeOpenAI() {
        try {
            this.isConfigured = validateOpenAIConfig();

            if (this.isConfigured) {
                this.openai = new OpenAI({
                    apiKey: OPENAI_CONFIG.apiKey
                });
            }
        } catch (error) {
            console.error('Failed to initialize OpenAI:', error);
            this.isConfigured = false;
        }
    }

    async generateResponse(
        userMessage: string,
        courseContext: CourseContext,
        resources: ResourceRecommendation[]
    ): Promise<{ content: string; followUpQuestions: string[] }> {

        // Check if OpenAI is configured
        if (!this.isConfigured || !this.openai) {
            return this.getFallbackResponse(userMessage, courseContext, resources);
        }

        try {
            const systemPrompt = this.buildSystemPrompt(courseContext, resources);
            const userPrompt = this.buildUserPrompt(userMessage, resources);

            const completion = await this.openai.chat.completions.create({
                model: OPENAI_CONFIG.model,
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: userPrompt
                    }
                ],
                max_tokens: OPENAI_CONFIG.maxTokens,
                temperature: OPENAI_CONFIG.temperature,
            });

            const response = completion.choices[0]?.message?.content ||
                "I'm sorry, I couldn't generate a response. Please try asking your question differently.";

            // Generate follow-up questions based on the response
            const followUpQuestions = await this.generateFollowUpQuestions(userMessage, response, courseContext);

            return {
                content: response,
                followUpQuestions
            };

        } catch (error) {
            console.error('OpenAI API Error:', error);
            return this.getFallbackResponse(userMessage, courseContext, resources);
        }
    }

    private getFallbackResponse(
        userMessage: string,
        courseContext: CourseContext,
        resources: ResourceRecommendation[]
    ): { content: string; followUpQuestions: string[] } {

        const queryLower = userMessage.toLowerCase();
        let content = "";
        let followUpQuestions: string[] = [];

        // Provide basic course-aware responses without OpenAI
        if (queryLower.includes('course') && (queryLower.includes('about') || queryLower.includes('overview'))) {
            content = `This is ${courseContext.courseName} (${courseContext.courseCode}), taught by ${courseContext.instructorName}. We currently have ${courseContext.discussions.length} discussions and ${courseContext.announcements.length} announcements.`;
            followUpQuestions = [
                "What are the main topics discussed?",
                "Can you show me recent announcements?",
                "What resources are available?"
            ];
        } else if (queryLower.includes('announcement') && (queryLower.includes('recent') || queryLower.includes('latest'))) {
            const recentAnnouncements = courseContext.announcements.slice(0, 2);
            if (recentAnnouncements.length === 0) {
                content = "There are no recent announcements in this course.";
            } else {
                const titles = recentAnnouncements.map(a => a.title).join(' and ');
                content = `Recent announcements include: ${titles}. Check the announcements tab for full details.`;
            }
            followUpQuestions = [
                "Can you summarize these announcements?",
                "Are there any assignments mentioned?",
                "What's the most important information?"
            ];
        } else if (queryLower.includes('discussion')) {
            const recentDiscussions = courseContext.discussions.slice(0, 3);
            const topics = recentDiscussions.map(d => d.title).join(', ');
            content = `Recent discussion topics include: ${topics}. These discussions contain insights from your classmates and instructor.`;
            followUpQuestions = [
                "Can you show me the most active discussions?",
                "What are students saying about this?",
                "Which discussions should I read first?"
            ];
        } else if (resources.length > 0) {
            content = `I found some relevant course materials that might help with your question about "${userMessage}". Check the resources below for more information.`;
            followUpQuestions = [
                "Can you explain this topic further?",
                "Are there related discussions?",
                "What should I focus on studying?"
            ];
        } else {
            content = `I understand you're asking about "${userMessage}". While I don't have specific information on this exact topic, I can help you explore course discussions and announcements that might be related.`;
            followUpQuestions = [
                "Can you help me find course materials?",
                "What should I review for this topic?",
                "Are there recent announcements I should check?"
            ];
        }

        // Add note about AI configuration if not set up
        if (!this.isConfigured) {
            content += "\n\n(Note: For more detailed AI responses, please configure the OpenAI API key.)";
        }

        return { content, followUpQuestions };
    }

    private buildSystemPrompt(courseContext: CourseContext, resources: ResourceRecommendation[]): string {
        const basePrompt = `You are an AI course assistant embedded in a learning platform called Corner. Your role is to help students by answering questions based on course discussions, notes, announcements, and shared resources. You should always assume you're part of a specific course.

Context:
- Each course has a name and description
- Teachers may post announcements and notes
- Students may ask questions or participate in discussions
- Some resources may be attached: links, PDFs, external materials

Instructions:
- Answer questions accurately using course-related knowledge and other relevant knowledge
- Recommend relevant resources from the course, such as readings, PDFs, or links when possible or other relevant resources
- If the question is vague, ask clarifying or follow-up questions to help the student refine it
- If you cannot find enough context, suggest asking the teacher or checking course materials
- Always keep responses respectful, concise, and student-friendly`;

        // Add current course context
        const courseInfo = `

CURRENT COURSE CONTEXT:
Course: ${courseContext.courseName} (${courseContext.courseCode})
Instructor: ${courseContext.instructorName}
Total Discussions: ${courseContext.discussions.length}
Total Announcements: ${courseContext.announcements.length}`;

        // Add recent discussions context
        const recentDiscussions = courseContext.discussions.slice(0, 5);
        const discussionsContext = recentDiscussions.length > 0 ? `

RECENT DISCUSSIONS:
${recentDiscussions.map((d, i) => `${i + 1}. "${d.title}" - ${d.content.substring(0, 100)}...`).join('\n')}` : '';

        // Add recent announcements context
        const recentAnnouncements = courseContext.announcements.slice(0, 3);
        const announcementsContext = recentAnnouncements.length > 0 ? `

RECENT ANNOUNCEMENTS:
${recentAnnouncements.map((a, i) => `${i + 1}. "${a.title}" - ${a.content.substring(0, 100)}...`).join('\n')}` : '';

        // Add relevant resources found
        const resourcesContext = resources.length > 0 ? `

RELEVANT COURSE RESOURCES FOR THIS QUERY:
${resources.map((r, i) => `${i + 1}. [${r.type.toUpperCase()}] "${r.title}" - ${r.description}`).join('\n')}` : '';

        return basePrompt + courseInfo + discussionsContext + announcementsContext + resourcesContext;
    }

    private buildUserPrompt(userMessage: string, resources: ResourceRecommendation[]): string {
        let prompt = `Student Question: "${userMessage}"`;

        if (resources.length > 0) {
            prompt += `\n\nNote: I found ${resources.length} relevant course resource(s) that might help with this question. Please reference them in your response if applicable.`;
        }

        return prompt;
    }

    private async generateFollowUpQuestions(
        userMessage: string,
        aiResponse: string,
        courseContext: CourseContext
    ): Promise<string[]> {

        if (!this.isConfigured || !this.openai) {
            return this.getFallbackFollowUpQuestions(userMessage);
        }

        try {
            const completion = await this.openai.chat.completions.create({
                model: OPENAI_CONFIG.model,
                messages: [
                    {
                        role: "system",
                        content: `You are helping generate follow-up questions for a course assistant. Based on the student's original question and the AI response, suggest 2-3 relevant follow-up questions that would help the student learn more about the topic or explore related course content.

Course: ${courseContext.courseName}
Make the questions specific to the course context and encourage deeper learning.`
                    },
                    {
                        role: "user",
                        content: `Original Question: "${userMessage}"
AI Response: "${aiResponse}"

Generate 2-3 follow-up questions (return as a simple list, one per line):`
                    }
                ],
                max_tokens: 150,
                temperature: 0.8,
            });

            const response = completion.choices[0]?.message?.content || '';
            return response.split('\n')
                .filter(line => line.trim().length > 0)
                .map(line => line.replace(/^\d+\.\s*/, '').trim())
                .slice(0, 3);

        } catch (error) {
            console.error('Error generating follow-up questions:', error);
            return this.getFallbackFollowUpQuestions(userMessage);
        }
    }

    private getFallbackFollowUpQuestions(userMessage: string): string[] {
        const queryLower = userMessage.toLowerCase();

        if (queryLower.includes('assignment') || queryLower.includes('homework')) {
            return [
                "What are the specific requirements for this assignment?",
                "When is this assignment due?",
                "Are there any related discussions about this assignment?"
            ];
        } else if (queryLower.includes('discussion') || queryLower.includes('topic')) {
            return [
                "Can you show me more discussions on this topic?",
                "What do other students think about this?",
                "Are there any announcements related to this topic?"
            ];
        } else {
            return [
                "Can you elaborate on this topic?",
                "What course materials should I review?",
                "Are there related discussions I should read?"
            ];
        }
    }
}

export const openaiService = new OpenAIService(); 