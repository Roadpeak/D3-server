# Discoun3 API

This is the backend API for the Discoun3 platform, built with Node.js, Express, and Sequelize. It provides endpoints for managing users, merchants, stores, services, payments, and more.

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Installation

1. Clone the repository:

    ```sh
    git clone https://github.com/yourusername/discoun3-api.git
    cd discoun3-api
    ```

2. Install the dependencies:

    ```sh
    npm install
    ```

## Configuration

1. Create a `.env` file in the root directory and add the following environment variables:

    ```env
    DB_HOST=localhost
    DB_USER=d3_user
    DB_PASSWORD=new_password
    DB_NAME=d3
    DB_PORT=3306
    PORT=3000
    JWT_SECRET=your_jwt_secret
    DARAJA_API_KEY=your_api_key
    DARAJA_API_SECRET=your_api_secret
    BUSINESS_SHORTCODE=your_shortcode
    LIPA_SHORTCODE=your_lipa_shortcode
    LIPA_SHORTCODE_KEY=your_lipa_shortcode_key
    MAIL_MAILER=smtp
    MAIL_HOST=smtp.sendgrid.net
    MAIL_PORT=587
    MAIL_USERNAME=apikey
    MAIL_PASSWORD=your_sendgrid_api_key
    MAIL_ENCRYPTION=tls
    MAIL_FROM_ADDRESS=info@discoun3ree.com
    MAIL_FROM_NAME="Discoun3"
    CLOUDINARY_CLOUD_NAME=your_cloud_name
    CLOUDINARY_API_KEY=your_api_key
    CLOUDINARY_API_SECRET=your_api_secret
    ```

2. Update the `swagger.js` file to reflect your production URL if deploying.

## Running the Application

1. Start the development server:

    ```sh
    npm start
    ```

2. The server will start on `http://localhost:3000` by default.

## API Documentation

The API documentation is generated using Swagger. You can access the documentation at `http://localhost:3000/api/v1/api-docs`.

To regenerate the Swagger documentation, run:

```sh
node [swagger.js](http://_vscodecontentref_/0)


# Project Structure
.env
.gitignore
[app.js](http://_vscodecontentref_/1)
config/
    [cloudinary.js](http://_vscodecontentref_/2)
    config.js
    darajaConfig.js
    multer.js
controllers/
   enhancedBookingController.js
    merchantController.js
    offerController.js
    paymentController.js
    serviceController.js
    staffController.js
    storeController.js
    StoreGalleryController.js
    userController.js
migrations/
    20241122084001-create-users.js
    20241122084013-create-merchants.js
middlewares/
    auth.js
models/
[package.json](http://_vscodecontentref_/3)
routes/
seeders/
services/
[swagger_output.json](http://_vscodecontentref_/4)
[swagger.js](http://_vscodecontentref_/5)
templates/
utils/


Contributing
Fork the repository.
Create a new branch (git checkout -b feature-branch).
Make your changes.
Commit your changes (git commit -am 'Add new feature').
Push to the branch (git push origin feature-branch).
Create a new Pull Request.
License
This project is licensed under the MIT License.

This `README.md` file provides an overview of the project, instructions for installation and configuration, and details on how to run the application and access the API documentation. It also includes a section on contributing and the project structure.# D3-server
