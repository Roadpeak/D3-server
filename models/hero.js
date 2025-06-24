const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Offer = sequelize.define('Offer', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: {
                    msg: 'Title cannot be empty'
                },
                len: {
                    args: [1, 255],
                    msg: 'Title must be between 1 and 255 characters'
                }
            }
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false,
            validate: {
                notEmpty: {
                    msg: 'Description cannot be empty'
                }
            }
        },
        image: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: '/images/default.jpg',
            validate: {
                isUrl: {
                    msg: 'Image must be a valid URL or path'
                }
            }
        },
        originalPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            validate: {
                isDecimal: {
                    msg: 'Original price must be a valid decimal number'
                },
                min: {
                    args: [0.01],
                    msg: 'Original price must be greater than 0'
                }
            }
        },
        discountedPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            validate: {
                isDecimal: {
                    msg: 'Discounted price must be a valid decimal number'
                },
                min: {
                    args: [0],
                    msg: 'Discounted price must be greater than or equal to 0'
                }
            }
        },
        discountPercentage: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                isInt: {
                    msg: 'Discount percentage must be an integer'
                },
                min: {
                    args: [1],
                    msg: 'Discount percentage must be at least 1%'
                },
                max: {
                    args: [99],
                    msg: 'Discount percentage cannot exceed 99%'
                }
            }
        },
        store: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: {
                    msg: 'Store name cannot be empty'
                },
                len: {
                    args: [1, 100],
                    msg: 'Store name must be between 1 and 100 characters'
                }
            }
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false,
            validate: {
                isDate: {
                    msg: 'Expires at must be a valid date'
                },
                isAfter: {
                    args: new Date().toISOString(),
                    msg: 'Expiration date must be in the future'
                }
            }
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        isFeatured: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        deletedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        reactivatedAt: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        // Model options
        tableName: 'offers',
        timestamps: true, // This adds createdAt and updatedAt automatically
        paranoid: false, // We're using custom soft delete with deletedAt
        indexes: [
            {
                fields: ['isActive']
            },
            {
                fields: ['isFeatured']
            },
            {
                fields: ['expiresAt']
            },
            {
                fields: ['store']
            },
            {
                fields: ['isActive', 'expiresAt']
            },
            {
                fields: ['isActive', 'isFeatured']
            },
            {
                fields: ['title', 'description', 'store'],
                type: 'FULLTEXT' // For search functionality (if using MySQL)
            }
        ],

        // Instance methods
        instanceMethods: {
            isExpired() {
                return new Date() > this.expiresAt;
            },

            getSavingsAmount() {
                return this.originalPrice - this.discountedPrice;
            },

            getTimeLeft() {
                const now = new Date();
                const expiry = new Date(this.expiresAt);
                const timeDiff = expiry - now;

                if (timeDiff <= 0) return "Expired";

                const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

                if (days > 0) return `${days} day${days > 1 ? 's' : ''} left`;
                if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} left`;
                return "Few minutes left";
            }
        },

        // Class methods
        classMethods: {
            getActiveOffers() {
                return this.findAll({
                    where: {
                        isActive: true,
                        expiresAt: {
                            [require('sequelize').Op.gt]: new Date()
                        }
                    }
                });
            },

            getFeaturedOffers() {
                return this.findAll({
                    where: {
                        isActive: true,
                        isFeatured: true,
                        expiresAt: {
                            [require('sequelize').Op.gt]: new Date()
                        }
                    }
                });
            },

            getSideOffers() {
                return this.findAll({
                    where: {
                        isActive: true,
                        isFeatured: false,
                        expiresAt: {
                            [require('sequelize').Op.gt]: new Date()
                        }
                    }
                });
            }
        },

        // Hooks
        hooks: {
            beforeCreate: (offer, options) => {
                // Ensure discounted price is calculated correctly
                if (offer.originalPrice && offer.discountPercentage) {
                    offer.discountedPrice = parseFloat(
                        (offer.originalPrice - (offer.originalPrice * offer.discountPercentage / 100)).toFixed(2)
                    );
                }
            },

            beforeUpdate: (offer, options) => {
                // Recalculate discounted price if original price or discount percentage changed
                if (offer.changed('originalPrice') || offer.changed('discountPercentage')) {
                    offer.discountedPrice = parseFloat(
                        (offer.originalPrice - (offer.originalPrice * offer.discountPercentage / 100)).toFixed(2)
                    );
                }
            },

            beforeValidate: (offer, options) => {
                // Ensure discounted price is less than original price
                if (offer.discountedPrice >= offer.originalPrice) {
                    throw new Error('Discounted price must be less than original price');
                }
            }
        },

        // Scopes for common queries
        scopes: {
            active: {
                where: {
                    isActive: true,
                    expiresAt: {
                        [require('sequelize').Op.gt]: new Date()
                    }
                }
            },
            featured: {
                where: {
                    isFeatured: true
                }
            },
            sideOffers: {
                where: {
                    isFeatured: false
                }
            },
            expired: {
                where: {
                    [require('sequelize').Op.or]: [
                        { isActive: false },
                        { expiresAt: { [require('sequelize').Op.lte]: new Date() } }
                    ]
                }
            }
        }
    });

    // Virtual fields
    Offer.prototype.timeLeft = function () {
        return this.getTimeLeft();
    };

    Offer.prototype.savingsAmount = function () {
        return this.getSavingsAmount();
    };

    Offer.prototype.isExpired = function () {
        return new Date() > this.expiresAt;
    };

    return Offer;
};