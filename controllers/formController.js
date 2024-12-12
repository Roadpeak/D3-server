const { Form, Service, FormField } = require('../models');

exports.createForm = async (req, res) => {
    try {
        const { name, description, service_id } = req.body;
        const service = await Service.findByPk(service_id);
        if (!service) {
            return res.status(404).json({ message: 'Service not found' });
        }
        const existingForm = await Form.findOne({ where: { service_id } });
        if (existingForm) {
            return res.status(400).json({ message: 'Service already has an associated form' });
        }
        const form = await Form.create({ name, description, service_id });
        return res.status(201).json({ form });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error creating form' });
    }
};

exports.getForms = async (req, res) => {
    try {
        const forms = await Form.findAll({
            include: [
                {
                    model: FormField,
                    as: 'fields',
                },
                {
                    model: Service,
                    as: 'service',
                },
            ],
        });

        return res.status(200).json({ forms });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error fetching forms' });
    }
};

exports.getFormsByServiceId = async (req, res) => {
    try {
        const { serviceId } = req.params;

        const forms = await Form.findAll({
            where: {
                service_id: serviceId,
            },
            include: [
                {
                    model: FormField,
                    as: 'fields',
                },
            ],
        });

        if (forms.length === 0) {
            return res.status(404).json({ message: 'No forms found for this service' });
        }

        return res.status(200).json({ forms });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error fetching forms by service ID' });
    }
};

exports.getFormById = async (req, res) => {
    try {
        const { id } = req.params;
        const form = await Form.findByPk(id, {
            include: [
                {
                    model: FormField,
                    as: 'fields',
                },
            ],
        });

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
