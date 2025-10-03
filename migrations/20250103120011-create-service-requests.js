'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('service_requests', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      category: {
        type: Sequelize.ENUM(
          'Web Development', 'Graphic Design', 'Writing & Translation', 'Digital Marketing',
          'Video & Animation', 'Music & Audio', 'Programming', 'Business', 'Health & Fitness',
          'Beauty & Salon', 'Photography', 'Home Services', 'Automotive', 'Education',
          'Technology', 'Legal Services', 'Consulting', 'Healthcare', 'Food & Catering',
          'Event Services', 'Pet Services', 'Moving & Storage', 'Landscaping',
          'Cleaning Services', 'Repair Services', 'Installation Services', 'Financial Services', 'Other'
        ),
        allowNull: false
      },
      budgetMin: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      budgetMax: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      timeline: {
        type: Sequelize.ENUM('urgent', 'thisweek', 'nextweek', 'thismonth', 'flexible'),
        allowNull: false
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      coordinates: {
        type: Sequelize.JSON,
        defaultValue: null
      },
      requirements: {
        type: Sequelize.JSON,
        defaultValue: '[]'
      },
      priority: {
        type: Sequelize.ENUM('low', 'normal', 'high', 'urgent'),
        defaultValue: 'normal'
      },
      postedBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      status: {
        type: Sequelize.ENUM('open', 'in_progress', 'completed', 'cancelled', 'disputed'),
        defaultValue: 'open'
      },
      acceptedOfferId: {
        type: Sequelize.UUID,
        defaultValue: null,
        references: {
          model: 'service_offers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      completedAt: {
        type: Sequelize.DATE,
        defaultValue: null
      },
      cancelledAt: {
        type: Sequelize.DATE,
        defaultValue: null
      },
      cancellationReason: {
        type: Sequelize.TEXT,
        defaultValue: null
      },
      finalRating: {
        type: Sequelize.INTEGER,
        defaultValue: null
      },
      finalReview: {
        type: Sequelize.TEXT,
        defaultValue: null
      },
      images: {
        type: Sequelize.JSON,
        defaultValue: '[]'
      },
      attachments: {
        type: Sequelize.JSON,
        defaultValue: '[]'
      },
      urgentUntil: {
        type: Sequelize.DATE,
        defaultValue: null
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      viewCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      bookmarkCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      offerCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Total number of offers received'
      },
      storeOfferCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of store-based offers received'
      },
      uniqueStoreCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of unique stores that offered'
      },
      averageOfferPrice: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: null,
        comment: 'Average price of all offers received'
      },
      lowestOfferPrice: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: null,
        comment: 'Lowest price offered'
      },
      highestOfferPrice: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: null,
        comment: 'Highest price offered'
      },
      firstOfferReceivedAt: {
        type: Sequelize.DATE,
        defaultValue: null,
        comment: 'When the first offer was received'
      },
      lastOfferReceivedAt: {
        type: Sequelize.DATE,
        defaultValue: null,
        comment: 'When the last offer was received'
      },
      averageResponseTime: {
        type: Sequelize.DECIMAL(8, 2),
        defaultValue: null,
        comment: 'Average time in hours for stores to respond'
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
    await queryInterface.addIndex('service_requests', ['postedBy'], {
      name: 'idx_service_requests_posted_by'
    });

    await queryInterface.addIndex('service_requests', ['category', 'status', 'createdAt'], {
      name: 'idx_service_requests_category_status_created'
    });

    await queryInterface.addIndex('service_requests', ['location', 'status'], {
      name: 'idx_service_requests_location_status'
    });

    await queryInterface.addIndex('service_requests', ['status', 'priority', 'createdAt'], {
      name: 'idx_service_requests_status_priority_created'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('service_requests');
  }
};