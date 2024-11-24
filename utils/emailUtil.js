// utils/emailUtil.js
const nodemailer = require('nodemailer');

// Create a transporter using SMTP and your SendGrid credentials
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,   // SMTP server address (smtp.sendgrid.net)
  port: process.env.MAIL_PORT,   // Port (587 for TLS)
  secure: false,                 // Use TLS
  auth: {
    user: process.env.MAIL_USERNAME,   // Your SendGrid username (apikey)
    pass: process.env.MAIL_PASSWORD,   // Your SendGrid API key
  },
  tls: {
    rejectUnauthorized: false,  // Don't reject unauthorized certificates
  },
});

// Function to send an email
async function sendEmail(to, subject, text, html) {
  try {
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS,  // From email address
      to,                                  // Recipient's email
      subject,                             // Subject of the email
      text,                                // Plain text content (optional)
      html,                                // HTML content
    };

    // Send email using the transporter
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ', info.response);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

module.exports = {
  sendEmail,  // Export the function directly as 'sendEmail'
};
