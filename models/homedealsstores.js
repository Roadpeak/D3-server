// models/index.js
const { Sequelize, DataTypes } = require('sequelize');

// Initialize Sequelize
// Replace with your actual database configuration
const sequelize = new Sequelize({
    dialect: 'postgres', // or 'mysql', 'sqlite', 'mariadb', 'mssql'
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'deals_app',
    username: process.env.DB_USER || 'your_username',
    password: process.env.DB_PASSWORD || 'your_password',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

// Import all models
const Category = require('./category')(sequelize, DataTypes);
const Store = require('./store')(sequelize, DataTypes);
const Deal = require('./offer')(sequelize, DataTypes);
const User = require('./User')(sequelize, DataTypes);

// Define associations
const db = {
    sequelize,
    Sequelize,
    Category,
    Store,
    Deal,
    User
};

// Category associations
Category.hasMany(Store, {
    foreignKey: 'categoryId',
    as: 'stores'
});

Category.hasMany(Deal, {
    foreignKey: 'categoryId',
    as: 'deals'
});

// Store associations
Store.belongsTo(Category, {
    foreignKey: 'categoryId',
    as: 'category'
});

Store.hasMany(Deal, {
    foreignKey: 'storeId',
    as: 'deals'
});

// Deal associations
Deal.belongsTo(Category, {
    foreignKey: 'categoryId',
    as: 'category'
});

Deal.belongsTo(Store, {
    foreignKey: 'storeId',
    as: 'store'
});

// User associations (for future use)
User.hasMany(Deal, {
    foreignKey: 'userId',
    as: 'favorites'
});

module.exports = db;

// models/Category.js
module.exports = (sequelize, DataTypes) => {
    const Category = sequelize.define('Category', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true
        },
        slug: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        icon: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        sortOrder: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    }, {
        tableName: 'categories',
        timestamps: true,
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        indexes: [
            {
                fields: ['slug']
            },
            {
                fields: ['isActive']
            }
        ]
    });

    return Category;
};

// models/Store.js
module.exports = (sequelize, DataTypes) => {
    const Store = sequelize.define('Store', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        slug: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true
        },
        category: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        categoryId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'categories',
                key: 'id'
            }
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        location: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        address: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        phone: {
            type: DataTypes.STRING(20),
            allowNull: true
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: true,
            validate: {
                isEmail: true
            }
        },
        website: {
            type: DataTypes.STRING(500),
            allowNull: true,
            validate: {
                isUrl: true
            }
        },
        discount: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            defaultValue: 0,
            validate: {
                min: 0,
                max: 100
            }
        },
        offer: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        rating: {
            type: DataTypes.DECIMAL(3, 2),
            allowNull: false,
            defaultValue: 0,
            validate: {
                min: 0,
                max: 5
            }
        },
        reviews: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            validate: {
                min: 0
            }
        },
        image: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        logo: {
            type: DataTypes.STRING(10),
            allowNull: true
        },
        logoColor: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        tag: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        activeDealsCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            validate: {
                min: 0
            }
        },
        isVerified: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        isFeatured: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    }, {
        tableName: 'stores',
        timestamps: true,
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        indexes: [
            {
                fields: ['slug']
            },
            {
                fields: ['categoryId']
            },
            {
                fields: ['isActive']
            },
            {
                fields: ['rating']
            },
            {
                fields: ['isFeatured']
            },
            {
                fields: ['location']
            }
        ],
        hooks: {
            beforeValidate: (store) => {
                if (store.name && !store.slug) {
                    store.slug = store.name
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, '-')
                        .replace(/-+/g, '-')
                        .replace(/^-|-$/g, '');
                }
            }
        }
    });

    return Store;
};

// models/Deal.js
module.exports = (sequelize, DataTypes) => {
    const Deal = sequelize.define('Deal', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        title: {
            type: DataTypes.STRING(500),
            allowNull: false
        },
        slug: {
            type: DataTypes.STRING(500),
            allowNull: false,
            unique: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        originalPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            validate: {
                min: 0
            }
        },
        salePrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            validate: {
                min: 0
            }
        },
        discount: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            validate: {
                min: 0,
                max: 100
            }
        },
        discountType: {
            type: DataTypes.ENUM('percentage', 'fixed'),
            allowNull: false,
            defaultValue: 'percentage'
        },
        rating: {
            type: DataTypes.DECIMAL(3, 2),
            allowNull: false,
            defaultValue: 0,
            validate: {
                min: 0,
                max: 5
            }
        },
        reviews: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            validate: {
                min: 0
            }
        },
        timeLeft: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        image: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        images: {
            type: DataTypes.JSON,
            allowNull: true
        },
        tag: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        location: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        categoryId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'categories',
                key: 'id'
            }
        },
        storeId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'stores',
                key: 'id'
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
        isHotDeal: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        maxPurchases: {
            type: DataTypes.INTEGER,
            allowNull: true,
            validate: {
                min: 1
            }
        },
        currentPurchases: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            validate: {
                min: 0
            }
        },
        terms: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false
        },
        startDate: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'deals',
        timestamps: true,
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        indexes: [
            {
                fields: ['slug']
            },
            {
                fields: ['categoryId']
            },
            {
                fields: ['storeId']
            },
            {
                fields: ['isActive']
            },
            {
                fields: ['expiresAt']
            },
            {
                fields: ['rating']
            },
            {
                fields: ['discount']
            },
            {
                fields: ['isFeatured']
            },
            {
                fields: ['isHotDeal']
            },
            {
                fields: ['startDate', 'expiresAt']
            }
        ],
        hooks: {
            beforeValidate: (deal) => {
                if (deal.title && !deal.slug) {
                    deal.slug = deal.title
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, '-')
                        .replace(/-+/g, '-')
                        .replace(/^-|-$/g, '');
                }

                // Calculate discount percentage if not provided
                if (deal.originalPrice && deal.salePrice && !deal.discount) {
                    deal.discount = ((deal.originalPrice - deal.salePrice) / deal.originalPrice * 100).toFixed(2);
                }
            },
            beforeUpdate: (deal) => {
                // Recalculate discount if prices change
                if (deal.changed('originalPrice') || deal.changed('salePrice')) {
                    deal.discount = ((deal.originalPrice - deal.salePrice) / deal.originalPrice * 100).toFixed(2);
                }
            }
        },
        validate: {
            salePriceLessThanOriginal() {
                if (this.salePrice >= this.originalPrice) {
                    throw new Error('Sale price must be less than original price');
                }
            },
            validExpiryDate() {
                if (this.expiresAt <= new Date()) {
                    throw new Error('Expiry date must be in the future');
                }
            }
        }
    });

    return Deal;
};

// models/User.js (for future use)
module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true
            }
        },
        password: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        firstName: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        lastName: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        phone: {
            type: DataTypes.STRING(20),
            allowNull: true
        },
        location: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        avatar: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        isVerified: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        lastLoginAt: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'users',
        timestamps: true,
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        indexes: [
            {
                fields: ['email'],
                unique: true
            },
            {
                fields: ['isActive']
            }
        ],
        hooks: {
            beforeCreate: async (user) => {
                // Hash password before creating user
                if (user.password) {
                    const bcrypt = require('bcrypt');
                    user.password = await bcrypt.hash(user.password, 10);
                }
            },
            beforeUpdate: async (user) => {
                // Hash password before updating if it was changed
                if (user.changed('password')) {
                    const bcrypt = require('bcrypt');
                    user.password = await bcrypt.hash(user.password, 10);
                }
            }
        }
    });

    // Instance methods
    User.prototype.validatePassword = async function (password) {
        const bcrypt = require('bcrypt');
        return bcrypt.compare(password, this.password);
    };

    User.prototype.getFullName = function () {
        return `${this.firstName} ${this.lastName}`;
    };

    return User;
};