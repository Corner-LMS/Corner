const Module = require('../models/module');
const Course = require('../models/course');
// Create a new module
const createModule = async (req, res) => {
    try {
        const { title, description, courseId } = req.body;

        // Verify the teacher owns the course
        const course = await Course.findOne({
            _id: courseId,
            teacherId: req.user.userId
        });

        if (!course) {
            return res.status(403).json({ msg: 'Not authorized to add modules to this course' });
        }

        // Get the next position number
        const lastModule = await Module.findOne({ courseId })
            .sort({ position: -1 })
            .limit(1);

        const newPosition = lastModule ? lastModule.position + 1 : 0;

        const newModule = new Module({
            title,
            description,
            courseId,
            teacherId: req.user.userId,
            position: newPosition
        });

        await newModule.save();
        course.modules.push(newModule._id);
        await course.save();
        res.status(201).json(newModule);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

const getCourseModules = async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId);

        if (!course) {
            return res.status(404).json({ msg: 'Course not found' });
        }

        const isTeacher = course.teacherId.toString() === req.user.userId;
        // const isStudent = course.students.includes(req.user.id);

        // if (!isTeacher) {
        //     return res.status(403).json({ msg: 'Not authorized to view these modules' });
        // }

        // const query = { courseId: req.params.courseId };
        // if (!isTeacher) {
        //     query.isPublished = true; // Students only see published modules
        // }

        // const modules = await Module.find(query)
        //     .sort({ position: 1 })
        //     .populate('items');
        
        const modules = await Module.find({ courseId: req.params.courseId })
            .sort({ position: 1 })
            .populate('items');


        res.json(modules);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error', error: err.message});
    }
};

const updateModule = async (req, res) => {
    try {
        const { title, description, isPublished, position } = req.body;

        let module = await Module.findById(req.params.id);

        if (!module) {
            return res.status(404).json({ msg: 'Module not found' });
        }

        // Verify the teacher owns the module
        
        if (module.teacherId.toString() !== req.user.userId) {
            return res.status(403).json({ msg: 'Not authorized to update this module' });
        }

        module.title = title || module.title;
        module.description = description || module.description;

        if (typeof isPublished !== 'undefined') {
            module.isPublished = isPublished;
        }

        if (typeof position !== 'undefined') {
            // Reorder other modules if position changed
            if (module.position !== position) {
                await Module.updateMany(
                    {
                        courseId: module.courseId,
                        position: { $gte: Math.min(module.position, position) },
                        _id: { $ne: module._id }
                    },
                    { $inc: { position: module.position < position ? -1 : 1 } }
                );
            }
            module.position = position;
        }

        await module.save();
        res.json(module);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
const deleteModule = async (req, res) => {
    try {
        const module = await Module.findById(req.params.id);

        if (!module) {
            return res.status(404).json({ msg: 'Module not found' });
        }
        
        // Verify the teacher owns the module
        if (module.teacherId.toString() !== req.user.userId) {
            return res.status(403).json({ msg: 'Not authorized to delete this module' });
        }

        // Update positions of remaining modules
        await Module.updateMany(
            { courseId: module.courseId, position: { $gt: module.position } },
            { $inc: { position: -1 } }
        );

        await module.deleteOne();
        res.json({ msg: 'Module removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
module.exports = {
    createModule,
    getCourseModules,
    updateModule,
    deleteModule
};