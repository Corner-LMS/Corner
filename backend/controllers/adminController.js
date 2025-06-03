const User = require('../models/user'); // User model
const School = require('../models/school'); // School model
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Mailgun = require('mailgun.js');
const formData = require('form-data');
const dotenv = require('dotenv');

dotenv.config();

exports.registerAdmin = async (req, res) => {
    try {
        const { name, email, password, role, schoolName } = req.body;

        if (role !== 'admin') {
            return res.status(400).json({ error: 'Invalid role for this route.' });
        }

        // Hash password
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

        // Create school but mark it as unverified initially
        const newSchool = new School({ name: schoolName, admin: newUser._id });
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

        // Generate email verification token
        const token = jwt.sign({ userId: newUser._id, schoolId: newSchool._id }, process.env.JWT_SECRET, {
            expiresIn: '1d',
        });

        // Send email verification
        const mailgun = new Mailgun(formData);
        const mg = mailgun.client({ username: 'api', key: process.env.MAILGUN_API_KEY });
        await mg.messages().create('cornerdiscussion.com', {
            from: 'noreply@cornerdiscussion.com',
            to: email,
            subject: 'Verify Your Email',
            text: `Please verify your email by clicking the link: ${process.env.BASE_URL}/verify-email/${token}`,
        });

        res.status(201).json({ message: 'Admin registered successfully. Please verify your email.' });
    } catch (error) {
        console.error('Error registering admin:', error);
        res.status(500).json({ error: 'Server error.' });
    }
};

exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { userId, schoolId } = decoded;

        // Update user and school records
        const user = await User.findById(userId);
        if (!user) return res.status(400).json({ error: 'Invalid verification token.' });

        user.emailVerified = true;
        await user.save();

        const school = await School.findById(schoolId);
        if (!school) return res.status(400).json({ error: 'School not found.' });

        school.verified = true;
        await school.save();

        res.redirect(`/admin/dashboard?school=${school._id}`);
    } catch (error) {
        console.error('Error verifying email:', error);
        res.status(500).json({ error: 'Server error.' });
    }
};

exports.getVerifiedSchools = async (req, res) => {
    try {
        // Find schools whose associated admins have verified their emails
        const schools = await School.find()
            .populate({
                path: 'admin',
                match: { role: 'admin', emailVerified: true },
                select: 'emailVerified',
            })
            .select('_id name')
            .exec();

        // Filter out schools where the admin is not verified
        const verifiedSchools = schools.filter((school) => school.admin);

        res.status(200).json(verifiedSchools);
    } catch (error) {
        console.error('Error fetching verified schools:', error);
        res.status(500).json({ error: 'Server error.' });
    }
};