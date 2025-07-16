# Seed Data Scripts

This directory contains scripts to generate comprehensive test data for the Corner app.

## Overview

The seed data scripts create realistic test data including:
- **Users**: Teachers, students, and admins with verified emails
- **Courses**: Multiple courses per teacher with student enrollments
- **Discussions**: Course discussions with comments
- **Announcements**: Course announcements (some pinned)
- **Comments**: Realistic comments on discussions

## Configuration

The seed data generation is configured in `seedData.ts` with the following defaults:

```typescript
const SEED_CONFIG = {
    users: {
        teachers: 8,
        students: 25,
        admins: 3
    },
    courses: {
        perTeacher: 2,
        maxStudents: 15
    },
    discussions: {
        perCourse: 3,
        maxComments: 8
    },
    announcements: {
        perCourse: 2
    },
    comments: {
        perDiscussion: 5
    }
};
```

## Usage

### Generate Seed Data

```bash
npm run seed:data
```

This will create:
- 8 teachers with 2 courses each (16 total courses)
- 25 students enrolled in random courses
- 3 admins
- ~48 discussions (3 per course)
- ~32 announcements (2 per course)
- ~240 comments (5 per discussion)

### Clear Seed Data

```bash
npm run seed:clear
```

This will remove all documents from the following collections:
- users
- courses
- discussions
- announcements
- comments

## Generated Data Details

### Users
- **Teachers**: 8 teachers with realistic names and emails
- **Students**: 25 students with realistic names and emails
- **Admins**: 3 admins with realistic names and emails
- All users are marked as verified
- Users are assigned to random schools from the constants

### Courses
- Each teacher creates 2 courses
- Course names are realistic (e.g., "Introduction to Computer Science 1")
- Course codes follow a pattern (e.g., "CS1011")
- Students are randomly enrolled in courses (5-15 students per course)
- Join dates are randomized within the last 30 days

### Discussions
- 3 discussions per course
- Topics include: Homework Questions, Class Discussion, Project Ideas, etc.
- Authors are randomly selected from course participants
- Realistic discussion content

### Announcements
- 2 announcements per course
- Titles include: Important Update, Assignment Due Date, Exam Schedule, etc.
- 20% chance of being pinned
- All announcements are created by teachers

### Comments
- 5 comments per discussion
- Comments are realistic and varied
- Authors are randomly selected from course participants
- No reply comments (can be extended if needed)

## Sample Output

When you run the seed script, you'll see output like:

```
🌱 Starting seed data generation...
👨‍🏫 Creating teachers...
👨‍🎓 Creating students...
👨‍💼 Creating admins...
📚 Creating courses...
📝 Enrolling students in courses...
💬 Creating discussions...
📢 Creating announcements...
💭 Creating comments...
🔥 Writing data to Firestore...
✅ Seed data generation completed successfully!
📊 Summary:
   - Users: 36 (8 teachers, 25 students, 3 admins)
   - Courses: 16
   - Discussions: 48
   - Announcements: 32
   - Comments: 240

📧 Sample user emails for testing:
   teacher: alice.smith@gmail.com (Alice Smith)
   student: bob.johnson123@yahoo.com (Bob Johnson)
   admin: charlie.williams@outlook.com (Charlie Williams)
```

## Testing with Generated Data

After running the seed script, you can:

1. **Test different user roles**: Use the generated email addresses to log in as different user types
2. **Test course functionality**: Browse courses, join discussions, view announcements
3. **Test performance**: The data volume is sufficient to test app performance
4. **Test admin features**: Use admin accounts to view school-wide data
5. **Test superadmin features**: The superadmin (corner.e.learning@gmail.com) will still work

## Customization

To modify the amount of data generated:

1. Edit the `SEED_CONFIG` object in `seedData.ts`
2. Add more names, course names, or content to the arrays
3. Modify the generation logic as needed

## Notes

- All generated emails are fictional and won't actually receive emails
- The script uses realistic but random data
- All timestamps are recent (within the last 30 days)
- The script is idempotent - you can run it multiple times safely
- Use `seed:clear` before running `seed:data` again to avoid duplicates

## Troubleshooting

If you encounter issues:

1. **Firebase permissions**: Ensure your Firebase project allows write operations
2. **Network issues**: The script requires internet connection to write to Firestore
3. **Memory issues**: For very large datasets, consider reducing the configuration values
4. **Rate limiting**: Firebase has rate limits, so very large datasets might need to be generated in batches 