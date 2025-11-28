# Password Reset - Quick Start Guide

## Setup Steps

### 1. Run Database Migration

```bash
npx sequelize-cli db:migrate
```

This adds `resetToken` and `resetTokenExpiry` fields to both `users` and `merchants` tables.

### 2. Verify Environment Variables

Ensure these are set in your `.env` file:

```env
SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_FROM=noreply@discoun3ree.com
FRONTEND_URL=https://discoun3ree.com
MERCHANT_FRONTEND_URL=https://merchants.discoun3ree.com
SUPPORT_EMAIL=support@discoun3ree.com
```

### 3. Test the Implementation

#### For Users:

**Request Reset:**
```bash
curl -X POST http://localhost:5000/api/v1/users/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

**Reset Password:**
```bash
curl -X POST http://localhost:5000/api/v1/users/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token":"TOKEN_FROM_EMAIL",
    "newPassword":"NewPassword123"
  }'
```

#### For Merchants:

**Request Reset:**
```bash
curl -X POST http://localhost:5000/api/v1/merchants/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"merchant@example.com"}'
```

**Reset Password:**
```bash
curl -X POST http://localhost:5000/api/v1/merchants/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token":"TOKEN_FROM_EMAIL",
    "newPassword":"NewPassword123"
  }'
```

## What Was Implemented

### Modified Files:

1. **Models:**
   - [models/user.js](models/user.js) - Added `resetToken` and `resetTokenExpiry` fields
   - [models/merchant.js](models/merchant.js) - Added `resetToken` and `resetTokenExpiry` fields

2. **Controllers:**
   - [controllers/userController.js](controllers/userController.js) - Updated `requestPasswordReset` and `resetPassword` functions
   - [controllers/merchantController.js](controllers/merchantController.js) - Updated `requestPasswordReset` and `resetPassword` functions

3. **Services:**
   - [services/notificationService.js](services/notificationService.js) - Added `sendPasswordResetEmail` and `sendPasswordResetConfirmation` methods
   - [services/userService.js](services/userService.js) - Added `findUserByEmailWithPassword` alias

4. **Email Templates:**
   - [templates/passwordResetLink.ejs](templates/passwordResetLink.ejs) - Reset link email template
   - [templates/passwordResetConfirmation.ejs](templates/passwordResetConfirmation.ejs) - Success confirmation email

5. **Migrations:**
   - [migrations/20250113000000-add-password-reset-fields.js](migrations/20250113000000-add-password-reset-fields.js) - Database migration

### Routes (Already Configured):

- **Users:**
  - POST `/api/v1/users/request-password-reset`
  - POST `/api/v1/users/reset-password`

- **Merchants:**
  - POST `/api/v1/merchants/request-password-reset`
  - POST `/api/v1/merchants/reset-password`

## How It Works

### Step 1: User Requests Password Reset
1. User enters their email on frontend
2. Frontend calls request endpoint
3. Backend generates secure token (32 bytes)
4. Token stored in database with 1-hour expiry
5. SendGrid sends email with reset link

### Step 2: User Resets Password
1. User clicks link in email
2. Frontend extracts token from URL
3. User enters new password
4. Frontend submits token + new password
5. Backend validates token and expiry
6. Password updated, token cleared
7. Confirmation email sent

## Security Features

✅ **No User Enumeration** - Same response whether email exists or not
✅ **Token Expiry** - Tokens expire after 1 hour
✅ **Single Use** - Tokens cleared after use
✅ **Password Validation** - Minimum 8 characters
✅ **Secure Tokens** - Cryptographically random (crypto.randomBytes)
✅ **Email Confirmation** - User notified of successful reset

## Common Issues & Solutions

### Emails Not Arriving

1. Check SendGrid API key is valid
2. Verify sender email is authenticated in SendGrid
3. Check spam folder
4. Review SendGrid dashboard for delivery status

### Token Invalid/Expired

1. Token expires after 1 hour - request new reset
2. Each token can only be used once
3. Verify token is being passed correctly from frontend

### Database Errors

1. Make sure migration has been run
2. Check database connection
3. Verify column names match (users vs merchants have different field naming)

## Frontend Integration

### User Flow:

```javascript
// 1. Request password reset
const response = await fetch('/api/v1/users/request-password-reset', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: userEmail })
});

// 2. Extract token from URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

// 3. Submit new password
const resetResponse = await fetch('/api/v1/users/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: token,
    newPassword: newPassword
  })
});

// 4. Redirect to login
if (resetResponse.ok) {
  window.location.href = '/login';
}
```

## Next Steps

1. **Test in development** - Use the curl commands above
2. **Check emails** - Verify SendGrid is sending properly
3. **Update frontend** - Implement the password reset UI
4. **Add rate limiting** - Prevent abuse of reset endpoint
5. **Monitor logs** - Watch for any errors in production

## Need Help?

- Full documentation: [docs/PASSWORD_RESET_IMPLEMENTATION.md](PASSWORD_RESET_IMPLEMENTATION.md)
- Support: support@discoun3ree.com
- Check server logs for detailed error messages
