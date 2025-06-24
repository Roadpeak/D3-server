// models/ServiceRequest.js

module.exports = (sequelize, DataTypes) => {
  const ServiceRequest = sequelize.define('ServiceRequest', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [5, 200]
      }
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [20, 2000]
      }
    },
    budgetMin: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    budgetMax: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    timeline: {
      type: DataTypes.ENUM('urgent', 'thisweek', 'nextweek', 'thismonth', 'flexible'),
      allowNull: false
    },
    location: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    requirements: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
      defaultValue: 'normal'
    },
    status: {
      type: DataTypes.ENUM('open', 'in_progress', 'completed', 'cancelled'),
      defaultValue: 'open'
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    }
  }, {
    tableName: 'service_requests',
    timestamps: true,
    indexes: [
      { fields: ['category'] },
      { fields: ['status'] },
      { fields: ['userId'] },
      { fields: ['createdAt'] }
    ]
  });

  ServiceRequest.associate = (models) => {
    ServiceRequest.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });

    ServiceRequest.hasMany(models.Offer, {
      foreignKey: 'serviceRequestId',
      as: 'offers'
    });
  };

  return ServiceRequest;
};

// models/Offer.js

module.exports = (sequelize, DataTypes) => {
  const Offer = sequelize.define('Offer', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    serviceRequestId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'service_requests',
        key: 'id'
      }
    },
    providerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    quotedPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: { min: 0 }
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [10, 1000]
      }
    },
    availability: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true }
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'withdrawn'),
      defaultValue: 'pending'
    },
    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'offers',
    timestamps: true,
    indexes: [
      { fields: ['serviceRequestId'] },
      { fields: ['providerId'] },
      { fields: ['status'] },
      { fields: ['createdAt'] },
      { unique: true, fields: ['serviceRequestId', 'providerId'] }
    ]
  });

  Offer.associate = (models) => {
    Offer.belongsTo(models.ServiceRequest, {
      foreignKey: 'serviceRequestId',
      as: 'serviceRequest'
    });

    Offer.belongsTo(models.User, {
      foreignKey: 'providerId',
      as: 'provider'
    });
  };

  return Offer;
};
