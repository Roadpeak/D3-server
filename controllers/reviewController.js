const { Review, Store, User } = require('../models');

exports.createReview = async (req, res) => {
    try {
        const { store_id, user_id, text, rating } = req.body;

        if (!store_id || rating === undefined) {
            return res.status(400).json({ error: 'Store ID and rating are required' });
        }
        if (rating < 0 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 0 and 5' });
        }

        const review = await Review.create({
            store_id,
            user_id: user_id || null,
            text,
            rating,
        });

        res.status(201).json(review);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while creating the review' });
    }
};

exports.getReviewsByStore = async (req, res) => {
    try {
        const { store_id } = req.params;

        if (!store_id) {
            return res.status(400).json({ error: 'Store ID is required' });
        }

        const reviews = await Review.findAll({
            where: { store_id },
            include: [
                { model: User, attributes: ['id', 'firstName', 'lastName', 'email'] },
                { model: Store, attributes: ['id', 'name'] },
            ],
        });

        res.status(200).json(reviews);
    } catch (error) {
        res.status(500).json({ message: 'Error updating social media entry', error });
    }
};

exports.getReviewById = async (req, res) => {
    try {
        const { id } = req.params;

        const review = await Review.findByPk(id, {
            include: [
                { model: User, attributes: ['id', 'firstName', 'lastName', 'email'] },
                { model: Store, attributes: ['id', 'name'] },
            ],
        });

        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }

        res.status(200).json(review);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching the review' });
    }
};

exports.updateReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { text, rating } = req.body;

        if (rating !== undefined && (rating < 0 || rating > 5)) {
            return res.status(400).json({ error: 'Rating must be between 0 and 5' });
        }

        const [updated] = await Review.update({ text, rating }, { where: { id } });

        if (!updated) {
            return res.status(404).json({ error: 'Review not found or no changes made' });
        }

        const updatedReview = await Review.findByPk(id);
        res.status(200).json(updatedReview);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while updating the review' });
    }
};

exports.deleteReview = async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await Review.destroy({ where: { id } });

        if (!deleted) {
            return res.status(404).json({ error: 'Review not found' });
        }

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while deleting the review' });
    }
};
