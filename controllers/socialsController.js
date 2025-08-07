const { Social, Store } = require("../models");

exports.createSocial = async (req, res) => {
    try {
        const { store_id, platform, link } = req.body;
        const merchantId = req.user.id;

        // Validate required fields
        if (!store_id || !platform || !link) {
            return res.status(400).json({ 
                success: false,
                message: 'Store ID, platform, and link are required' 
            });
        }

        // Validate URL format
        const urlRegex = /^https?:\/\/.+/;
        if (!urlRegex.test(link)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid URL format. URL must start with http:// or https://' 
            });
        }

        // Verify that the store belongs to the merchant
        const store = await Store.findOne({
            where: { 
                id: store_id, 
                merchant_id: merchantId 
            }
        });

        if (!store) {
            return res.status(403).json({ 
                success: false,
                message: 'Store not found or access denied' 
            });
        }

        // Check if social platform already exists for this store
        const existingSocial = await Social.findOne({
            where: { 
                store_id, 
                platform: platform.toLowerCase() 
            }
        });

        if (existingSocial) {
            return res.status(400).json({ 
                success: false,
                message: `${platform} link already exists for this store. Please update the existing one.` 
            });
        }

        const social = await Social.create({
            store_id,
            platform: platform.toLowerCase(),
            link,
        });

        res.status(201).json({
            success: true,
            message: 'Social media link added successfully',
            social
        });
    } catch (error) {
        console.error('Create social error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error creating social media link',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getSocialsByStore = async (req, res) => {
    try {
        const store_id = req.params.storeId;

        // For public access (store view page), no authentication required
        // For merchant access, verify store ownership
        if (req.user && req.user.type === 'merchant') {
            const store = await Store.findOne({
                where: { 
                    id: store_id, 
                    merchant_id: req.user.id 
                }
            });

            if (!store) {
                return res.status(403).json({ 
                    success: false,
                    message: 'Store not found or access denied' 
                });
            }
        }

        const socials = await Social.findAll({
            where: { store_id },
            order: [['createdAt', 'ASC']]
        });

        res.status(200).json({
            success: true,
            socials
        });
    } catch (error) {
        console.error('Get socials error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching social media links',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.updateSocial = async (req, res) => {
    try {
        const socialId = req.params.id;
        const { platform, link } = req.body;
        const merchantId = req.user.id;

        // Validate required fields
        if (!platform || !link) {
            return res.status(400).json({ 
                success: false,
                message: 'Platform and link are required' 
            });
        }

        // Validate URL format
        const urlRegex = /^https?:\/\/.+/;
        if (!urlRegex.test(link)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid URL format. URL must start with http:// or https://' 
            });
        }

        const social = await Social.findByPk(socialId, {
            include: [{
                model: Store,
                as: 'store',
                where: { merchant_id: merchantId }
            }]
        });

        if (!social) {
            return res.status(404).json({ 
                success: false,
                message: 'Social media link not found or access denied' 
            });
        }

        // Check if platform change conflicts with existing social for same store
        if (platform.toLowerCase() !== social.platform) {
            const existingSocial = await Social.findOne({
                where: { 
                    store_id: social.store_id, 
                    platform: platform.toLowerCase(),
                    id: { [require('sequelize').Op.ne]: socialId }
                }
            });

            if (existingSocial) {
                return res.status(400).json({ 
                    success: false,
                    message: `${platform} link already exists for this store` 
                });
            }
        }

        await social.update({
            platform: platform.toLowerCase(),
            link
        });

        res.status(200).json({
            success: true,
            message: 'Social media link updated successfully',
            social
        });
    } catch (error) {
        console.error('Update social error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error updating social media link',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.deleteSocial = async (req, res) => {
    try {
        const socialId = req.params.id;
        const merchantId = req.user.id;

        const social = await Social.findByPk(socialId, {
            include: [{
                model: Store,
                as: 'store',
                where: { merchant_id: merchantId }
            }]
        });

        if (!social) {
            return res.status(404).json({ 
                success: false,
                message: 'Social media link not found or access denied' 
            });
        }

        await social.destroy();

        res.status(200).json({ 
            success: true,
            message: 'Social media link deleted successfully' 
        });
    } catch (error) {
        console.error('Delete social error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error deleting social media link',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};