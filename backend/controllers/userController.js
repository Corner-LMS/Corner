const User = require('../models/user');

const getUserInfo = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        const userInfo = await User.findById(userId).populate('school', 'name');
        if (!userInfo) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            name: userInfo.name,
            role: userInfo.role,
            school: userInfo.school?.name || "Unknown",
            userId: userInfo._id
        });
    } catch (error) {
        console.error('Error in getUserInfo:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getUserInfo };