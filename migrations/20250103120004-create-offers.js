'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('offers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      service_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'services',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      title: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Custom title for the offer'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      discount: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        comment: 'Discount percentage (0-100)'
      },
      offer_type: {
        type: Sequelize.ENUM('fixed', 'dynamic'),
        allowNull: false,
        defaultValue: 'fixed',
        comment: 'Whether this is a fixed service offer or dynamic service offer'
      },
      discount_explanation: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Explanation of how discount applies for dynamic services'
      },
      expiration_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'expired', 'paused'),
        defaultValue: 'active'
      },
      featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this offer should be featured'
      },
      fee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Platform access fee for this offer'
      },
      terms_conditions: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Terms and conditions for this offer'
      },
      max_redemptions: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment: 'Maximum number of times this offer can be redeemed'
      },
      current_redemptions: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Current number of redemptions'
      },
      requires_consultation: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this offer requires consultation before booking'
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'ID of the user who created this offer'
      },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'ID of the user who last updated this offer'
      },
      view_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of times this offer has been viewed'
      },
      click_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of times this offer has been clicked'
      },
      booking_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of bookings made for this offer'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('offers', ['service_id'], {
      name: 'idx_offers_service_id'
    });

    await queryInterface.addIndex('offers', ['status', 'expiration_date'], {
      name: 'idx_offers_status_expiration'
    });

    await queryInterface.addIndex('offers', ['featured', 'status'], {
      name: 'idx_offers_featured_status'
    });

    await queryInterface.addIndex('offers', ['offer_type', 'status'], {
      name: 'idx_offers_type_status'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('offers');
  }
};