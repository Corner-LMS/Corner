# Corner LMS – Backend

Corner is a modern Learning Management System (LMS) designed to support students and instructors with essential tools for course management. This backend powers key functionalities like authentication, material uploads, and — most notably — a personalized AI assistant for each course.

## 🔑 Key Features

- **AI Assistant Tutor (per course)**  
  Each course comes with its own AI assistant that helps students with course-related questions. The assistant improves over time based on user interactions.

- **Authentication and Roles**  
  Supports student and instructor roles with secure login and role-based access.

- **Course and Material Management**  
  Instructors can create courses, upload materials; students can view and interact with course content.

- **Chat History Tracking**  
  All user queries and AI responses are saved per course and user, enabling persistent context and assistant improvement.

## 🧠 Tech Stack

- **Node.js + Express**
- **MongoDB (Mongoose)**
- **OpenAI API** (GPT-based assistant per course)
- **dotenv** for environment management
