'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('Bookings', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                allowNull: false,
                primaryKey: true,
            },
            offerId: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            userId: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            paymentId: {
                type: Sequelize.INTEGER,
                allowNull: true,
            },
            paymentUniqueCode: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            status: {
                type: Sequelize.ENUM('pending', 'cancelled', 'fulfilled'),
                allowNull: false,
                defaultValue: 'pending',
            },
            startTime: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            endTime: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            qrCode: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });
    },

    async down(queryInterface, Sequelize) {
        // Drop the Bookings table
        await queryInterface.dropTable('Bookings');
    },
};
