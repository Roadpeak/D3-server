// migrations/20241217000001-create-stores.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('Stores', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false
            },
            logo_url: {
                type: Sequelize.STRING,
                allowNull: true
            },
            google_logo: {
                type: Sequelize.STRING,
                allowNull: true
            },
            address: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            phone: {
                type: Sequelize.STRING,
                allowNull: true
            },
            email: {
                type: Sequelize.STRING,
                allowNull: true
            },
            website: {
                type: Sequelize.STRING,
                allowNull: true
            },
            status: {
                type: Sequelize.ENUM('active', 'inactive', 'pending'),
                defaultValue: 'active'
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
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('Stores');
    }
};

// migrations/20241217000002-create-services.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('Services', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            price: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false
            },
            duration: {
                type: Sequelize.INTEGER,
                allowNull: true,
                comment: 'Duration in minutes'
            },
            image_url: {
                type: Sequelize.STRING,
                allowNull: true
            },
            category: {
                type: Sequelize.STRING,
                allowNull: false
            },
            type: {
                type: Sequelize.ENUM('product', 'service'),
                defaultValue: 'service'
            },
            status: {
                type: Sequelize.ENUM('active', 'inactive', 'draft'),
                defaultValue: 'active'
            },
            store_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'Stores',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
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

        await queryInterface.addIndex('Services', ['store_id']);
        await queryInterface.addIndex('Services', ['category']);
        await queryInterface.addIndex('Services', ['status']);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('Services');
    }
};

// migrations/20241217000003-create-offers.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('Offers', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            title: {
                type: Sequelize.STRING,
                allowNull: true
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            discount: {
                type: Sequelize.DECIMAL(5, 2),
                allowNull: false,
                comment: 'Discount percentage'
            },
            fee: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false,
                comment: 'Platform fee (5% of discount)'
            },
            expiration_date: {
                type: Sequelize.DATE,
                allowNull: true
            },
            status: {
                type: Sequelize.ENUM('active', 'inactive', 'expired', 'draft'),
                defaultValue: 'active'
            },
            featured: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            service_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'Services',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
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

        await queryInterface.addIndex('Offers', ['service_id']);
        await queryInterface.addIndex('Offers', ['status']);
        await queryInterface.addIndex('Offers', ['featured']);
        await queryInterface.addIndex('Offers', ['expiration_date']);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('Offers');
    }
};