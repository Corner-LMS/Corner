const OpenAI = require('openai');
const dotenv = require('dotenv');
dotenv.config();
const ChatHistory = require('../models/chatHistory');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const chatPrompt = async (req, res) => {
    try {
        const { prompt, courseId, courseName, userId } = req.body;

        if (!userId || !courseId || !courseName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Fetch recent chat history for context (limit to last 10 exchanges)
        const pastChats = await ChatHistory.find({ userId, courseId })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean(); // optional, to speed up read

        // Build chat history in OpenAI message format
        const messageHistory = pastChats
            .reverse() // chronological order
            .flatMap(chat => ([
                { role: 'user', content: chat.prompt },
                { role: 'assistant', content: chat.response }
            ]));

        const systemMessage = {
            role: "system",
            content: `You are a helpful course assistant for ${courseName}. 
            If this is the first message in the conversation, start by welcoming the student and recommending 5 relevant papers, books, or websites that relate to ${courseName}.
            Then proceed to assist with any course-related questions.`
        };
        const messages = [
            systemMessage,
            ...messageHistory,
            { role: 'user', content: prompt }
        ];

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: messages,
        });

        const aiResponse = completion.choices[0].message.content;
        // Save to database
        const chatEntry = new ChatHistory({
            userId,
            courseId,
            prompt,
            response: aiResponse,
            resourcesRecommended: extractResources(aiResponse), // Optional: Parse response for resources
        });
        await chatEntry.save();

        res.json({ message: aiResponse });

    
    } catch (error) {
        console.error('Error in AI chat:', error);
        res.status(500).json({ error: 'Error processing AI request' });
    }

};
// Helper function to extract recommended resources (optional)
function extractResources(response) {
    // Simple regex to find recommended items (adjust as needed)
    const matches = response.match(/\d\.\s(.+?)(?=\n|$)/g);
    return matches ? matches.map(m => m.replace(/\d\.\s/, '')) : [];
}

const getChatHistory = async (req, res) => {
    try {
        const { userId, courseId } = req.query;

        if (!userId || !courseId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const history = await ChatHistory.find({ 
            userId, 
            courseId 
        }).sort({ createdAt: 1 }); // Sort by timestamp ascending

        res.json({ history });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ error: 'Error fetching chat history' });
    }
};

module.exports = { 
    chatPrompt,
    getChatHistory 
}; 