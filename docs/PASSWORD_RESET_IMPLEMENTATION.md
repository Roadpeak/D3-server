# Password Reset Implementation Guide

This document describes the password reset functionality implemented for both Users and Merchants using SendGrid email service.

## Overview

The password reset system uses secure token-based authentication sent via email. The implementation includes:
- Token generation with 1-hour expiry
- Email delivery via SendGrid
- Separate flows for Users and Merchants
- Security best practices (no user enumeration, token expiry, etc.)

## Components

### 1. Database Schema

Added fields to both `users` and `merchants` tables:
- `resetToken` (STRING) - Secure random token for password reset
- `resetTokenExpiry` (DATE) - Token expiration timestamp (1 hour from creation)

### 2. Email Templates

Created professional email templates:
- `templates/passwordResetLink.ejs` - Password reset request email with reset link
- `templates/passwordResetConfirmation.ejs` - Confirmation email after successful reset

### 3. API Endpoints

#### Users
- **POST** `/api/v1/users/request-password-reset`
  - Request: `{ "email": "user@example.com" }`
  - Response: `{ "message": "If a user with that email exists, a password reset link has been sent." }`

- **POST** `/api/v1/users/reset-password`
  - Request: `{ "token": "abc123...", "newPassword": "newSecurePassword123" }`
  - Response: `{ "message": "Password reset successfully. You can now log in with your new password." }`

#### Merchants
- **POST** `/api/v1/merchants/request-password-reset`
  - Request: `{ "email": "merchant@example.com" }`
  - Response: `{ "success": true, "message": "If this email is registered, you will receive a password reset link" }`

- **POST** `/api/v1/merchants/reset-password`
  - Request: `{ "token": "abc123...", "newPassword": "newSecurePassword123" }`
  - Response: `{ "success": true, "message": "Password has been reset successfully. You can now log in with your new password." }`

## Implementation Details

### Token Generation

Tokens are generated using Node.js `crypto.randomBytes(32)` for cryptographic security:

```javascript
const crypto = require('crypto');
const resetToken = crypto.randomBytes(32).toString('hex');
const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
```

### Email Service Integration

Uses the existing `NotificationService` class with SendGrid:

```javascript
const NotificationService = require('../services/notificationService');
const notificationService = new NotificationService();

await notificationService.sendPasswordResetEmail(email, resetToken, 'user');
// or 'merchant' for merchant accounts
```

### Security Features

1. **No User Enumeration**: Always returns success message whether user exists or not
2. **Token Expiry**: Tokens expire after 1 hour
3. **Single Use**: Tokens are cleared after successful password reset
4. **Password Validation**: Minimum 8 characters enforced
5. **Secure Token Storage**: Tokens stored as-is (not hashed) but with expiry check

### Frontend Integration

Reset links are formatted as:
- Users: `https://discoun3ree.com/reset-password?token={resetToken}`
- Merchants: `https://merchants.discoun3ree.com/reset-password?token={resetToken}`

Frontend should:
1. Extract token from URL query parameter
2. Display password reset form
3. Submit token + new password to reset endpoint
4. Redirect to login on success

## Environment Variables

Required environment variables:

```env
# SendGrid Configuration
SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_FROM=noreply@discoun3ree.com

# Frontend URLs
FRONTEND_URL=https://discoun3ree.com
MERCHANT_FRONTEND_URL=https://merchants.discoun3ree.com

# Support Contact
SUPPORT_EMAIL=support@discoun3ree.com
COMPANY_ADDRESS=Nairobi, Kenya
```

## Migration

Run the migration to add the necessary database fields:

```bash
npx sequelize-cli db:migrate
```

Migration file: `migrations/20250113000000-add-password-reset-fields.js`

## Testing

### Manual Testing

1. **Request Password Reset**
```bash
curl -X POST http://localhost:5000/api/v1/users/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

2. **Check Email**
   - Verify SendGrid sent the email
   - Extract the token from the reset link

3. **Reset Password**
```bash
curl -X POST http://localhost:5000/api/v1/users/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token":"extracted_token_here",
    "newPassword":"NewSecurePass123"
  }'
```

4. **Test Login**
   - Attempt login with new password
   - Verify old password no longer works

### Testing Merchants

Same process but use `/api/v1/merchants/` endpoints instead.

## Error Handling

Common error responses:

- **400 Bad Request**: Missing required fields or validation errors
- **400 Bad Request**: Invalid or expired token
- **500 Internal Server Error**: Email sending failed or database errors

## Flow Diagram

```
User                    Backend                 SendGrid
  |                        |                        |
  |--Request Reset-------->|                        |
  |                        |--Generate Token------->|
  |                        |--Send Email----------->|
  |<---Success Response----|                        |
  |                        |                        |
  |<------Receive Email-------------------------|
  |                        |                        |
  |--Click Link----------->|                        |
  |--Submit New Password-->|                        |
  |                        |--Verify Token--------->|
  |                        |--Update Password------>|
  |                        |--Send Confirmation---->|
  |<---Success Response----|                        |
```

## Troubleshooting

### Emails Not Sending

1. Check `SENDGRID_API_KEY` is set correctly
2. Verify SendGrid account is active
3. Check server logs for SendGrid errors
4. Ensure `EMAIL_FROM` is verified in SendGrid

### Token Issues

1. Verify token hasn't expired (1 hour limit)
2. Check token is being passed correctly from frontend
3. Ensure database migration has been run
4. Check server logs for token validation errors

### Database Errors

1. Run migration: `npx sequelize-cli db:migrate`
2. Verify database connection
3. Check model definitions match schema

## Best Practices

1. **Rate Limiting**: Consider adding rate limiting to prevent abuse
2. **Logging**: Log password reset attempts for security auditing
3. **Monitoring**: Monitor SendGrid delivery rates
4. **Token Length**: 32-byte tokens provide sufficient security
5. **HTTPS Only**: Ensure reset links use HTTPS in production

## Future Enhancements

Potential improvements:
- Add SMS-based password reset option
- Implement 2FA for password reset
- Add password history to prevent reuse
- Implement account lockout after multiple failed attempts
- Add password strength meter on frontend
- Support for password reset via mobile app

## Support

For issues or questions:
- Email: support@discoun3ree.com
- Check server logs for detailed error messages
- Review SendGrid dashboard for email delivery status
