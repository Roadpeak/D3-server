# Push Notifications Implementation Guide

This document describes the push notification system implemented for Discoun3ree, covering store follows, reviews, and booking events (create, reschedule, cancel) for both users and merchants.

## Overview

The push notification system uses Web Push API via the `web-push` npm package to send real-time notifications to users and merchants. Notifications are sent for:
- **Store Follows**: Merchants notified when users follow their store
- **Store Reviews**: Merchants notified of new reviews with ratings
- **Bookings**: Both users and merchants notified of booking creation, reschedule, and cancellation

## Architecture

### Components

1. **PushNotificationService** (`services/pushNotificationService.js`)
   - Core service for sending push notifications
   - Handles subscription management
   - Provides specialized methods for each notification type

2. **PushSubscription Model** (`models/PushSubscription.js`)
   - Stores user/merchant push subscription data
   - Supports polymorphic user types (user, merchant, admin)
   - Fields: endpoint, p256dhKey, authKey, userAgent, lastUsedAt

3. **Controller Integrations**
   - `followController.js` - Store follow notifications
   - `reviewController.js` - Review notifications
   - `serviceBookingController.js` - Service booking notifications
   - `offerBookingController.js` - Offer booking notifications

## Setup

### 1. Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

### 2. Configure Environment Variables

Add to your `.env` file:

```env
# VAPID Keys for Web Push
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_SUBJECT=mailto:support@discoun3ree.com

# Frontend URLs (already configured)
FRONTEND_URL=https://discoun3ree.com
MERCHANT_FRONTEND_URL=https://merchants.discoun3ree.com
```

### 3. Database Schema

The `push_subscriptions` table is already created. Ensure it exists:

```sql
CREATE TABLE push_subscriptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  user_type ENUM('user', 'merchant', 'admin') DEFAULT 'user',
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_push_user_id (user_id),
  INDEX idx_push_user_type (user_type),
  INDEX idx_push_user_composite (user_id, user_type)
);
```

## Push Notification Events

### 1. Store Follow

**When**: User follows a store
**Recipient**: Merchant
**Trigger**: `POST /api/v1/follows/:storeId` or toggle follow

```javascript
// Example notification payload
{
  title: '🎉 New Follower!',
  body: 'John Doe started following Your Store',
  data: {
    type: 'new_follower',
    followerName: 'John Doe',
    storeName: 'Your Store',
    url: '/dashboard/followers'
  }
}
```

### 2. Store Review

**When**: User submits a review
**Recipient**: Merchant
**Trigger**: `POST /api/v1/reviews`

```javascript
// Example notification payload
{
  title: '📝 New Review!',
  body: 'Jane Smith rated Your Store ⭐⭐⭐⭐⭐ (5/5)',
  data: {
    type: 'new_review',
    reviewerName: 'Jane Smith',
    storeName: 'Your Store',
    rating: 5,
    url: '/dashboard/reviews'
  }
}
```

### 3. Booking Created

**When**: User creates a booking
**Recipients**: Merchant (new booking alert) + User (confirmation)
**Trigger**: `POST /api/v1/service-bookings` or `POST /api/v1/offer-bookings`

**Merchant Notification:**
```javascript
{
  title: '📅 New Booking!',
  body: 'John Doe booked Haircut for Dec 15, 2025 at 2:00 PM',
  data: {
    type: 'new_booking',
    customerName: 'John Doe',
    serviceName: 'Haircut',
    bookingTime: 'Dec 15, 2025 at 2:00 PM',
    url: '/dashboard/bookings'
  },
  requireInteraction: true
}
```

**User Notification:**
```javascript
{
  title: '✅ Booking Confirmed!',
  body: 'Your booking for Haircut at Your Store is confirmed for Dec 15, 2025 at 2:00 PM',
  data: {
    type: 'booking_confirmed',
    serviceName: 'Haircut',
    storeName: 'Your Store',
    bookingTime: 'Dec 15, 2025 at 2:00 PM',
    url: '/bookings'
  }
}
```

### 4. Booking Rescheduled

**When**: Booking time is changed
**Recipients**: Both merchant and user
**Trigger**: `PUT /api/v1/service-bookings/:id/reschedule` or offer booking reschedule

**User Notification:**
```javascript
{
  title: '🔄 Booking Rescheduled',
  body: 'Your Haircut booking at Your Store has been moved from Dec 15 at 2:00 PM to Dec 16 at 3:00 PM',
  data: {
    type: 'booking_rescheduled',
    serviceName: 'Haircut',
    oldTime: 'Dec 15 at 2:00 PM',
    newTime: 'Dec 16 at 3:00 PM',
    url: '/bookings'
  },
  requireInteraction: true
}
```

### 5. Booking Cancelled

**When**: Booking is cancelled
**Recipients**: Both merchant and user
**Trigger**: `DELETE /api/v1/service-bookings/:id` or offer booking cancel

**User Notification:**
```javascript
{
  title: '❌ Booking Cancelled',
  body: 'Your Haircut booking at Your Store for Dec 15 at 2:00 PM has been cancelled',
  data: {
    type: 'booking_cancelled',
    serviceName: 'Haircut',
    bookingTime: 'Dec 15 at 2:00 PM',
    reason: 'Customer request',
    url: '/bookings'
  },
  requireInteraction: true
}
```

## Frontend Integration

### Step 1: Request Permission

```javascript
async function requestNotificationPermission() {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    await subscribeUserToPush();
  }
}
```

### Step 2: Subscribe to Push

```javascript
async function subscribeUserToPush() {
  const registration = await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });

  // Send subscription to backend
  await fetch('/api/v1/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      userAgent: navigator.userAgent
    })
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
```

### Step 3: Service Worker

Create `/public/service-worker.js`:

```javascript
self.addEventListener('push', function(event) {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/badge-72x72.png',
    data: data.data,
    actions: data.actions,
    requireInteraction: data.requireInteraction || false,
    tag: data.tag || 'default'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // If a window is already open, focus it
        for (let client of clientList) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise, open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
```

### Step 4: Register Service Worker

```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(registration => {
      console.log('Service Worker registered:', registration);
    })
    .catch(error => {
      console.error('Service Worker registration failed:', error);
    });
}
```

## API Endpoints

### Subscribe to Push Notifications

```http
POST /api/v1/push/subscribe
Authorization: Bearer {token}
Content-Type: application/json

{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "userAgent": "Mozilla/5.0..."
}
```

### Unsubscribe from Push Notifications

```http
DELETE /api/v1/push/unsubscribe
Authorization: Bearer {token}
Content-Type: application/json

{
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

## Testing

### 1. Test Push Subscription

```bash
curl -X POST http://localhost:5000/api/v1/push/subscribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "subscription": {
      "endpoint": "https://fcm.googleapis.com/fcm/send/test",
      "keys": {
        "p256dh": "test_key",
        "auth": "test_auth"
      }
    }
  }'
```

### 2. Test Follow Notification

```bash
# Follow a store (as user)
curl -X POST http://localhost:5000/api/v1/follows/STORE_ID \
  -H "Authorization: Bearer USER_TOKEN"

# Merchant should receive push notification
```

### 3. Test Booking Notification

```bash
# Create a booking
curl -X POST http://localhost:5000/api/v1/service-bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer USER_TOKEN" \
  -d '{
    "serviceId": "service-id",
    "startTime": "2025-12-15T14:00:00Z",
    "duration": 60
  }'

# Both user and merchant should receive push notifications
```

## Error Handling

The push notification service handles errors gracefully:

1. **410 Gone**: Subscription expired - automatically removed from database
2. **404 Not Found**: Invalid endpoint - subscription removed
3. **Network Errors**: Logged but don't fail the main operation
4. **Missing VAPID Keys**: Warning logged, service disabled

All push notification failures are logged but don't interrupt the main flow (e.g., booking creation still succeeds even if push fails).

## Best Practices

1. **Always request permission** before subscribing users
2. **Handle denial gracefully** - app should work without push notifications
3. **Unsubscribe on logout** to prevent notifications after logout
4. **Test notifications** on multiple browsers (Chrome, Firefox, Edge)
5. **Use requireInteraction** for important notifications (bookings)
6. **Provide notification preferences** in user/merchant settings

## Notification Preferences (Future Enhancement)

Consider adding user preferences:

```sql
ALTER TABLE users ADD COLUMN push_notifications_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN notify_on_booking BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN notify_on_reschedule BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN notify_on_cancellation BOOLEAN DEFAULT TRUE;

ALTER TABLE merchants ADD COLUMN push_notifications_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE merchants ADD COLUMN notify_on_new_booking BOOLEAN DEFAULT TRUE;
ALTER TABLE merchants ADD COLUMN notify_on_new_follower BOOLEAN DEFAULT TRUE;
ALTER TABLE merchants ADD COLUMN notify_on_new_review BOOLEAN DEFAULT TRUE;
```

## Troubleshooting

### Notifications Not Appearing

1. Check browser permissions: `Settings > Site Settings > Notifications`
2. Verify VAPID keys are correctly set in `.env`
3. Check service worker is registered: DevTools > Application > Service Workers
4. Verify subscription exists in database
5. Check server logs for push errors

### Subscription Fails

1. Ensure HTTPS is used (required for push notifications)
2. Verify VAPID_PUBLIC_KEY is accessible on frontend
3. Check browser console for errors
4. Ensure service worker is properly registered

### Push Sent But Not Received

1. Check if user has multiple subscriptions (old ones might be stale)
2. Verify endpoint is still valid
3. Test with browser dev tools: Application > Push
4. Check lastUsedAt timestamp in database

## Browser Support

- ✅ Chrome/Edge 50+
- ✅ Firefox 44+
- ✅ Opera 37+
- ✅ Safari 16+ (macOS 13+, iOS 16.4+)
- ❌ IE (not supported)

## Security

- VAPID keys should be kept secret (private key)
- Subscriptions are user-specific and can't be spoofed
- Always verify user authentication before sending push
- Endpoints are unique and can't be guessed

## Performance

- Push notifications are sent asynchronously
- Failures don't block main operations
- Expired subscriptions are automatically cleaned up
- Uses connection pooling for multiple notifications

## Support

For issues or questions:
- Email: support@discoun3ree.com
- Check server logs for detailed error messages
- Review browser console for frontend errors
