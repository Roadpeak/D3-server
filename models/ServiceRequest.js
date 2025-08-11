module.exports = (sequelize, DataTypes) => {
  const ServiceRequest = sequelize.define('ServiceRequest', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        len: [5, 200],
        notEmpty: true,
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [10, 2000],
        notEmpty: true,
      },
    },
    category: {
      type: DataTypes.ENUM(
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
      allowNull: false,
    },
    budgetMin: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
        isDecimal: true,
      },
    },
    budgetMax: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
        isDecimal: true,
      },
    },
    timeline: {
      type: DataTypes.ENUM('urgent', 'thisweek', 'nextweek', 'thismonth', 'flexible'),
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [3, 255],
        notEmpty: true,
      },
    },
    coordinates: {
      type: DataTypes.JSON,
      defaultValue: null,
    },
    requirements: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
      defaultValue: 'normal',
    },
    postedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    status: {
      type: DataTypes.ENUM('open', 'in_progress', 'completed', 'cancelled', 'disputed'),
      defaultValue: 'open',
    },
    // Remove the foreign key constraint - just store the UUID as a string
    acceptedOfferId: {
      type: DataTypes.UUID,
      defaultValue: null,
      // Remove the references - we'll handle this with associations
    },
    completedAt: {
      type: DataTypes.DATE,
      defaultValue: null,
    },
    cancelledAt: {
      type: DataTypes.DATE,
      defaultValue: null,
    },
    cancellationReason: {
      type: DataTypes.TEXT,
      defaultValue: null,
    },
    finalRating: {
      type: DataTypes.INTEGER,
      validate: {
        min: 1,
        max: 5,
      },
      defaultValue: null,
    },
    finalReview: {
      type: DataTypes.TEXT,
      validate: {
        len: [0, 1000],
      },
      defaultValue: null,
    },
    images: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    attachments: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    urgentUntil: {
      type: DataTypes.DATE,
      defaultValue: null,
    },
    expiresAt: {
      type: DataTypes.DATE,
      defaultValue: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    viewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    bookmarkCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    tableName: 'service_requests',
    timestamps: true,
  });

  return ServiceRequest;
};