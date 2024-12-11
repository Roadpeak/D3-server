const { Form } = require('../models');

exports.createForm = async (req, res) => {
    try {
        const { name, description } = req.body;
        const form = await Form.create({ name, description });
        return res.status(201).json({ form });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error creating form' });
    }
};

exports.getForms = async (req, res) => {
    try {
        const forms = await Form.findAll();
        return res.status(200).json({ forms });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error fetching forms' });
    }
};

exports.getFormById = async (req, res) => {
    try {
        const { id } = req.params;
        const form = await Form.findByPk(id);

        if (!form) {
            return res.status(404).json({ message: 'Form not found' });
        }

        return res.status(200).json({ form });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error fetching form' });
    }
};

exports.updateForm = async (req, res) => {
    try {
        const { id } = req.params;
        const form = await Form.findByPk(id);

        if (!form) {
            return res.status(404).json({ message: 'Form not found' });
        }

        const updatedForm = await form.update(req.body);
        return res.status(200).json({ form: updatedForm });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error updating form' });
    }
};

exports.deleteForm = async (req, res) => {
    try {
        const { id } = req.params;
        const form = await Form.findByPk(id);

        if (!form) {
            return res.status(404).json({ message: 'Form not found' });
        }

        await form.destroy();
        return res.status(200).json({ message: 'Form deleted successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error deleting form' });
    }
};
