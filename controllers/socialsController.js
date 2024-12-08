const { Social } = require("../models");

// Create a new social media entry
exports.createSocial = async (req, res) => {
    try {
        const { store_id, platform, link } = req.body;

        const social = await Social.create({
            store_id,
            platform,
            link,
        });

        res.status(201).json(social);
    } catch (error) {
        res.status(500).json({ error });
        console.log(error);
    }
};

exports.getSocialsByStore = async (req, res) => {
    try {
        const store_id = req.params.storeId;

        const socials = await Social.findAll({
            where: { store_id },
        });

        res.status(200).json(socials);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching social media entries', error });
    }
};

// Update a social media entry
exports.updateSocial = async (req, res) => {
    try {
        const socialId = req.params.id;
        const { platform, link } = req.body;
        const updatedBy = req.user.id; // Set the updated_by field to the current merchant's ID

        const social = await Social.findByPk(socialId);
        if (!social) {
            return res.status(404).json({ message: 'Social media entry not found' });
        }

        social.platform = platform || social.platform;
        social.link = link || social.link;
        social.updated_by = updatedBy;

        await social.save();

        res.status(200).json(social);
    } catch (error) {
        res.status(500).json({ message: 'Error updating social media entry', error });
    }
};

// Delete a social media entry
exports.deleteSocial = async (req, res) => {
    try {
        const socialId = req.params.id;

        const social = await Social.findByPk(socialId);
        if (!social) {
            return res.status(404).json({ message: 'Social media entry not found' });
        }

        await social.destroy();

        res.status(200).json({ message: 'Social media entry deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting social media entry', error });
    }
};
