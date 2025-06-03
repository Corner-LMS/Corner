// controllers/authController.js
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const School = require('../models/school');
const crypto = require('crypto');
const Mailgun = require('mailgun.js');
const formData = require('form-data');
const dotenv = require('dotenv');

dotenv.config();

const baseUrl = process.env.FRONTEND_URL||'http://localhost:3000';

exports.signup = async (req, res) => {
    try {
        const { name, email, password, role, school, schoolName } = req.body;

        // Validate role
        if (!['student', 'teacher', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role.' });
        }

        // Hash password
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

        let schoolId = null;

        if (role === 'admin') {
            // Handle admin registration logic
            if (!schoolName) {
                return res.status(400).json({ error: 'School name is required for admin registration.' });
            }

            // Create a new school and associate it with the admin
            const newSchool = new School({ name: schoolName });
            await newSchool.save();

            // Create admin user
            const newUser = new User({
                name,
                email,
                password: hashedPassword,
                role,
                school: newSchool._id,
                emailVerified: false,
            });

            await newUser.save();

            // Assign admin to the school
            newSchool.admin = newUser._id;
            await newSchool.save();

            // Generate email verification token for admin
            const token = jwt.sign({ userId: newUser._id, schoolId: newSchool._id }, process.env.JWT_SECRET, {
                expiresIn: '1d',
            });

            // Send email verification
            const mailgun = new Mailgun(formData);
            const mg = mailgun.client({ username: 'api', key: process.env.MAILGUN_API_KEY });

            await mg.messages.create('cornerdiscussion.com', {
                from: 'Mailgun Sandbox <postmaster@cornerdiscussion.com>',
                to: email,
                subject: 'Verify Your Email',
                text: `Please verify your email to allow students and schools of your university to access your resources. Verify your email by clicking the link: ${baseUrl}/verify-email/${token}`,
            });

            return res.status(201).json({ message: 'Admin registered successfully. Please verify your email.' });
        } else {
            // Handle student/teacher registration logic
            const schoolExists = await School.findOne({ _id: school, admin: { $exists: true } });
            if (!schoolExists) {
                return res.status(400).json({ error: 'Invalid or unverified school.' });
            }
            schoolId = schoolExists._id;

            // Create user (student or teacher)
            const newUser = new User({
                name,
                email,
                password: hashedPassword,
                role,
                school: schoolId,
                emailVerified: false, // Set emailVerified to false for all users initially
            });

            await newUser.save();

            // Generate email verification token for student or teacher
            const token = jwt.sign({ userId: newUser._id, schoolId: schoolId }, process.env.JWT_SECRET, {
                expiresIn: '1d',
            });

            // Send email verification for student or teacher
            const mailgun = new Mailgun(formData);
            const mg = mailgun.client({ username: 'api', key: process.env.MAILGUN_API_KEY });

            await mg.messages.create('cornerdiscussion.com', {
                from: 'noreply@cornerdiscussion.com',
                to: email,
                subject: 'Verify Your Email',
                text: `Please verify your email by clicking the link: ${baseUrl}/verify-email/${token}`,
            });

            return res.status(201).json({ message: 'User registered successfully. Please verify your email.' });
        }
    } catch (error) {
        console.error('Error in signup:', error);
        res.status(500).json({ error: 'Server error.' + error.message });
    }
};


exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find the user by email
        const user = await User.findOne({ email });
        

        if (!user) {
            return res.status(400).json({ msg: 'Invalid credentials:user not found' });
        }

        // Hash the input password using SHA-256
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

        // Compare the hashed password
        if (hashedPassword !== user.password) {
            return res.status(400).json({ msg: 'Invalid credentials:password not found' });
        }

        // Check if email is verified
        if (!user.emailVerified) {
            return res.status(400).json({ msg: 'Please verify your email before logging in.' });
        }

        // Create a session token with expiration of 30 minutes
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '30m' } // Token expires in 30 minutes
        );

        // Send token as response
        console.log("User school", user.school);
       
        res.status(200).json({ message: 'Login successful!', token, role: user.role });

    } catch (err) {
        console.error(err);
        res.status(500).send('Server error: ' + err);
    }
};

exports.verifyEmail = async (req, res) => {
    const { token } = req.params;

    try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);  // Use your secret key here

        // Find the user by ID or email from the decoded token data
        const user = await User.findById(decoded.userId);  // Assuming `userId` is stored in the token

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update user's email verification status
        user.emailVerified = true;  // Assuming you have an 'isVerified' field in your User model
        await user.save();

        // Respond with success
        res.status(200).json({ message: 'Email verified successfully' });

    } catch (error) {
        console.error('Verification error:', error);
        res.status(400).json({ message: 'Invalid or expired token' });
    }
}
