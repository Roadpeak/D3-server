'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('service_requests', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
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
          'Home Services',
          'Auto Services',
          'Beauty & Wellness',
          'Tech Support',
          'Event Services',
          'Tutoring',
          'Fitness',
          'Photography',
          'Food & Catering',
          'Legal Services',
          'Financial Services',
          'Healthcare',
          'Pet Services',
          'Moving & Storage',
          'Landscaping',
          'Other'
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
        type: Sequelize.JSON
      },
      requirements: {
        type: Sequelize.JSON
      },
      priority: {
        type: Sequelize.ENUM('low', 'normal', 'high', 'urgent'),
        defaultValue: 'normal'
      },
      postedBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      status: {
        type: Sequelize.ENUM('open', 'in_progress', 'completed', 'cancelled', 'disputed'),
        defaultValue: 'open'
      },
      acceptedOfferId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'service_offers',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      completedAt: {
        type: Sequelize.DATE
      },
      cancelledAt: {
        type: Sequelize.DATE
      },
      cancellationReason: {
        type: Sequelize.TEXT
      },
      finalRating: {
        type: Sequelize.INTEGER
      },
      finalReview: {
        type: Sequelize.TEXT
      },
      images: {
        type: Sequelize.JSON
      },
      attachments: {
        type: Sequelize.JSON
      },
      urgentUntil: {
        type: Sequelize.DATE
      },
      expiresAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('DATE_ADD(NOW(), INTERVAL 30 DAY)')
      },
      viewCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      bookmarkCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
 
    // Add indexes
    await queryInterface.addIndex('service_requests', ['postedBy']);
    await queryInterface.addIndex('service_requests', ['category']);
    await queryInterface.addIndex('service_requests', ['status']);
    await queryInterface.addIndex('service_requests', ['timeline']);
    await queryInterface.addIndex('service_requests', ['priority']);
    await queryInterface.addIndex('service_requests', ['createdAt']);
    await queryInterface.addIndex('service_requests', ['budgetMin', 'budgetMax']);
    await queryInterface.addIndex('service_requests', ['expiresAt']);
  },
 
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('service_requests');
  }
 };