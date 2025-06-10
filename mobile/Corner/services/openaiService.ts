import OpenAI from 'openai';
import { OPENAI_CONFIG, validateOpenAIConfig } from '../config/openai.config';

interface CourseContext {
    discussions: any[];
    announcements: any[];
    resources: any[];
    courseName: string;
    courseCode: string;
    instructorName: string;
}

interface ResourceRecommendation {
    title: string;
    type: 'discussion' | 'announcement' | 'link' | 'text';
    id?: string;
    description: string;
    relevanceScore: number;
}

type UserRole = 'teacher' | 'student';

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
        resources: ResourceRecommendation[],
        userRole: UserRole = 'student'
    ): Promise<{ content: string; followUpQuestions: string[] }> {

        // Check if OpenAI is configured
        if (!this.isConfigured || !this.openai) {
            return this.getFallbackResponse(userMessage, courseContext, resources, userRole);
        }

        try {
            const systemPrompt = this.buildSystemPrompt(courseContext, resources, userRole);
            const userPrompt = this.buildUserPrompt(userMessage, resources, userRole);

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
            const followUpQuestions = await this.generateFollowUpQuestions(userMessage, response, courseContext, userRole);

            return {
                content: response,
                followUpQuestions
            };

        } catch (error) {
            console.error('OpenAI API Error:', error);
            return this.getFallbackResponse(userMessage, courseContext, resources, userRole);
        }
    }

    private getFallbackResponse(
        userMessage: string,
        courseContext: CourseContext,
        resources: ResourceRecommendation[],
        userRole: UserRole
    ): { content: string; followUpQuestions: string[] } {

        const queryLower = userMessage.toLowerCase();
        let content = "";
        let followUpQuestions: string[] = [];

        if (userRole === 'teacher') {
            // Teacher-specific fallback responses
            if (queryLower.includes('student') && (queryLower.includes('confused') || queryLower.includes('challenge'))) {
                const recentDiscussions = courseContext.discussions.slice(0, 3);
                const topics = recentDiscussions.map(d => d.title).join(', ');
                content = `Based on recent discussions (${topics}), students seem to be engaging with these topics. You might want to check the discussion details to see specific questions or concerns.`;
                followUpQuestions = [
                    "What specific discussion needs follow-up?",
                    "Should I draft an announcement to clarify?",
                    "What resources can help with these topics?"
                ];
            } else if (queryLower.includes('announcement') || queryLower.includes('draft')) {
                content = `I can help you draft announcements based on course activity. We have ${courseContext.discussions.length} discussions and ${courseContext.announcements.length} previous announcements to reference.`;
                followUpQuestions = [
                    "What topic should the announcement cover?",
                    "Should I reference recent discussions?",
                    "What tone should the announcement have?"
                ];
            } else if (queryLower.includes('summary') || queryLower.includes('trends')) {
                content = `Course Summary: ${courseContext.courseName} has ${courseContext.discussions.length} active discussions and ${courseContext.announcements.length} announcements. This gives you insights into student engagement patterns.`;
                followUpQuestions = [
                    "Which discussions need your attention?",
                    "What patterns do you see in student questions?",
                    "Should we create additional resources?"
                ];
            } else {
                content = `As your co-instructor assistant for ${courseContext.courseName}, I can help you analyze student engagement, draft announcements, or suggest improvements. What would you like to focus on?`;
                followUpQuestions = [
                    "What are students confused about this week?",
                    "Help me draft an announcement",
                    "What should I explain better in class?"
                ];
            }
        } else {
            // Student-specific fallback responses
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
                    "Can you explain the last announcement?",
                    "Are there any assignments mentioned?",
                    "What's the most important information?"
                ];
            } else if (queryLower.includes('discussion')) {
                const recentDiscussions = courseContext.discussions.slice(0, 3);
                const topics = recentDiscussions.map(d => d.title).join(', ');
                content = `Recent discussion topics include: ${topics}. These discussions contain insights from your classmates and instructor.`;
                followUpQuestions = [
                    "What do others think about topic X?",
                    "Can you explain a specific discussion?",
                    "Which discussions should I read first?"
                ];
            } else if (resources.length > 0) {
                content = `I found some relevant course materials that might help with your question about "${userMessage}". Check the resources below for more information.`;
                followUpQuestions = [
                    "Can you explain this topic further?",
                    "Give me resources to review before next class",
                    "What should I focus on studying?"
                ];
            } else {
                content = `I understand you're asking about "${userMessage}". I can help you understand course concepts, explain announcements, or recommend relevant discussions. What would you like to explore?`;
                followUpQuestions = [
                    "Can you explain the last announcement?",
                    "What do others think about this topic?",
                    "Give me resources to review before next class"
                ];
            }
        }

        // Add note about AI configuration if not set up
        if (!this.isConfigured) {
            content += "\n\n(Note: For more detailed AI responses, please configure the OpenAI API key.)";
        }

        return { content, followUpQuestions };
    }

    private buildSystemPrompt(courseContext: CourseContext, resources: ResourceRecommendation[], userRole: UserRole): string {
        let basePrompt = "";

        if (userRole === 'teacher') {
            basePrompt = `You are assisting a teacher who manages a course on ${courseContext.courseName} (code: ${courseContext.courseCode}).
The teacher's name is ${courseContext.instructorName}. 
You have access to the following data:
- Recent student discussion questions and comments (with role tags and timestamps)
- Frequently asked or upvoted questions
- List of posted announcements and notes
- Optional external resources and PDFs uploaded to the course

Your job is to:
- Summarize class-wide student challenges
- Suggest learning resources or improvements
- Help draft announcements and follow-ups
- Analyze student engagement patterns

Always remember you're speaking to the instructor, so focus on pedagogical insights and class management.`;
        } else {
            basePrompt = `You are helping a student enrolled in ${courseContext.courseName} (code: ${courseContext.courseCode}).
Their instructor is ${courseContext.instructorName}. 
You have access to:
- Announcements made by the instructor
- Class notes or summaries
- Student discussions and questions
- External resources (links, PDFs)

Your job is to:
- Answer questions using course content
- Provide brief, easy-to-understand explanations
- Recommend relevant discussions/announcements
- Ask follow-up questions to deepen understanding

Always remember you're speaking to a student, so keep explanations clear and supportive.`;
        }

        // Add current course context
        const courseInfo = `

CURRENT COURSE CONTEXT:
Course: ${courseContext.courseName} (${courseContext.courseCode})
Instructor: ${courseContext.instructorName}
Total Discussions: ${courseContext.discussions.length}
Total Announcements: ${courseContext.announcements.length}
Total Resources: ${courseContext.resources.length}`;

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

        // Add course resources context
        const recentResources = courseContext.resources.slice(0, 5);
        const resourcesListContext = recentResources.length > 0 ? `

AVAILABLE COURSE RESOURCES:
${recentResources.map((r, i) => `${i + 1}. [${r.type.toUpperCase()}] "${r.title}" - ${r.description || r.content.substring(0, 100)}...`).join('\n')}` : '';

        // Add relevant resources found
        const resourcesContext = resources.length > 0 ? `

RELEVANT COURSE RESOURCES FOR THIS QUERY:
${resources.map((r, i) => `${i + 1}. [${r.type.toUpperCase()}] "${r.title}" - ${r.description}`).join('\n')}` : '';

        return basePrompt + courseInfo + discussionsContext + announcementsContext + resourcesListContext + resourcesContext;
    }

    private buildUserPrompt(userMessage: string, resources: ResourceRecommendation[], userRole: UserRole): string {
        let prompt = "";

        if (userRole === 'teacher') {
            prompt = `Teacher Question: "${userMessage}"`;
        } else {
            prompt = `Student Question: "${userMessage}"`;
        }

        if (resources.length > 0) {
            prompt += `\n\nNote: I found ${resources.length} relevant course resource(s) that might help with this question. Please reference them in your response if applicable.`;
        }

        return prompt;
    }

    private async generateFollowUpQuestions(
        userMessage: string,
        aiResponse: string,
        courseContext: CourseContext,
        userRole: UserRole
    ): Promise<string[]> {

        if (!this.isConfigured || !this.openai) {
            return this.getFallbackFollowUpQuestions(userMessage, userRole);
        }

        try {
            const roleContext = userRole === 'teacher'
                ? "You are helping generate follow-up questions for a teacher managing a course. Focus on pedagogical insights, class management, and student engagement."
                : "You are helping generate follow-up questions for a student. Focus on learning, understanding concepts, and academic growth.";

            const completion = await this.openai.chat.completions.create({
                model: OPENAI_CONFIG.model,
                messages: [
                    {
                        role: "system",
                        content: `${roleContext} Based on the ${userRole === 'teacher' ? 'teacher' : 'student'}'s original question and the AI response, suggest 2-3 relevant follow-up questions that would help them ${userRole === 'teacher' ? 'better manage their course and understand student needs' : 'learn more about the topic or explore related course content'}.

Course: ${courseContext.courseName}
Make the questions specific to the course context and encourage ${userRole === 'teacher' ? 'effective teaching' : 'deeper learning'}.`
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
            return this.getFallbackFollowUpQuestions(userMessage, userRole);
        }
    }

    private getFallbackFollowUpQuestions(userMessage: string, userRole: UserRole): string[] {
        const queryLower = userMessage.toLowerCase();

        if (userRole === 'teacher') {
            if (queryLower.includes('student') || queryLower.includes('confusion')) {
                return [
                    "What specific topics need clarification?",
                    "Should I create additional resources?",
                    "How can I better support struggling students?"
                ];
            } else if (queryLower.includes('announcement') || queryLower.includes('draft')) {
                return [
                    "What tone should this announcement have?",
                    "Should I reference specific discussions?",
                    "When should this be posted?"
                ];
            } else {
                return [
                    "What are students confused about this week?",
                    "Help me draft an announcement",
                    "What should I explain better in class?"
                ];
            }
        } else {
            if (queryLower.includes('assignment') || queryLower.includes('homework')) {
                return [
                    "What are the specific requirements?",
                    "When is this due?",
                    "Are there related discussions about this?"
                ];
            } else if (queryLower.includes('concept') || queryLower.includes('explain')) {
                return [
                    "Can you give me more examples?",
                    "What resources can help me understand this?",
                    "What should I ask if I'm still confused?"
                ];
            } else {
                return [
                    "Can you explain the last announcement?",
                    "What do others think about this topic?",
                    "Give me resources to review before next class"
                ];
            }
        }
    }
}

export const openaiService = new OpenAIService(); 