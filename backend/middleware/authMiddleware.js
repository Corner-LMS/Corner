const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
        console.error('No token, authorization denied');
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
        console.error('No token, authorization denied');
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if the decoded token contains the user role (student or teacher)
        req.user = decoded;

        if (decoded.role === 'teacher') {
            req.teacherId = decoded._id;
        } else if (decoded.role === 'student') {
            req.studentId = decoded._id;
        } else {
            return res.status(401).json({ msg: 'Invalid role in token' });
        }

        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};

module.exports = authMiddleware;
