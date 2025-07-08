require('dotenv').config();
const { Sequelize } = require('sequelize');

// Create sequelize instance using your environment variables
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        port: process.env.DB_PORT || 3306,
    }
);

async function dropAllTables() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Connected successfully!');

        // Drop tables in order (considering foreign key constraints)
        const tables = ['messages', 'chats', 'users'];

        for (const table of tables) {
            console.log(`Dropping ${table} table...`);
            await sequelize.query(`DROP TABLE IF EXISTS ${table};`);
            console.log(`${table} table dropped successfully!`);
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await sequelize.close();
        console.log('Database connection closed.');
    }
}

dropAllTables();