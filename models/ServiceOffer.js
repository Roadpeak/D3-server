module.exports = (sequelize, DataTypes) => {
  const ServiceOffer = sequelize.define('ServiceOffer', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    requestId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'service_requests', // ✅ Fixed: Use actual table name
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    providerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users', // ✅ Also check this matches your Users table name
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    storeId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'stores', // ✅ Also check this matches your Stores table name
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    quotedPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
        isDecimal: true,
      },
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [10, 1000],
        notEmpty: true,
      },
    },
    availability: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        len: [1, 200],
        notEmpty: true,
      },
    },
    estimatedDuration: {
      type: DataTypes.STRING(100),
      defaultValue: null,
    },
    includesSupplies: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    warranty: {
      type: DataTypes.JSON,
      defaultValue: {
        offered: false,
        duration: null,
        terms: null,
      },
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'withdrawn', 'expired'),
      defaultValue: 'pending',
    },
    statusReason: {
      type: DataTypes.TEXT,
      defaultValue: null,
    },
    acceptedAt: {
      type: DataTypes.DATE,
      defaultValue: null,
    },
    rejectedAt: {
      type: DataTypes.DATE,
      defaultValue: null,
    },
    withdrawnAt: {
      type: DataTypes.DATE,
      defaultValue: null,
    },
    expiresAt: {
      type: DataTypes.DATE,
      defaultValue: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    responseTime: {
      type: DataTypes.DECIMAL(8, 2),
      defaultValue: 0,
    },
    revisionCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    originalOfferId: {
      type: DataTypes.UUID,
      defaultValue: null,
      references: {
        model: 'service_offers', // ✅ Self-reference to same table
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    negotiationHistory: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    attachments: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
  }, {
    tableName: 'service_offers',
    timestamps: true,
  });

  return ServiceOffer;
};