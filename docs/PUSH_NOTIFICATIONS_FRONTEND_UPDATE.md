# Push Notifications Frontend Update Guide

This guide shows how to update your existing push notification implementation on both user and merchant frontends to handle the new notification types (follows, reviews, bookings).

## Overview

Since you already have push notifications working for messages, you only need to update your service worker to handle the new notification types with proper routing and actions.

## New Notification Types

| Type | Recipient | When | Data Type Field |
|------|-----------|------|-----------------|
| New Follower | Merchant | User follows store | `new_follower` |
| New Review | Merchant | User submits review | `new_review` |
| New Booking | Both | Booking created | `new_booking` (merchant), `booking_confirmed` (user) |
| Booking Rescheduled | Both | Booking time changed | `booking_rescheduled` (user), `booking_rescheduled_merchant` (merchant) |
| Booking Cancelled | Both | Booking cancelled | `booking_cancelled` (user), `booking_cancelled_merchant` (merchant) |

## User Frontend Updates

### 1. Update Service Worker (`public/service-worker.js`)

```javascript
self.addEventListener('push', function(event) {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/badge-72x72.png',
    data: data.data,
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
    tag: data.tag || 'default',
    vibrate: data.vibrate || [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const data = event.notification.data || {};
  const action = event.action;
  let urlToOpen = '/';

  // Handle notification actions
  if (action === 'view') {
    urlToOpen = data.url || '/';
  } else if (action === 'add-to-calendar') {
    // Handle add to calendar action
    urlToOpen = data.url || '/bookings';
  } else if (action === 'rebook') {
    urlToOpen = '/bookings/new';
  } else {
    // Handle different notification types based on data.type
    switch(data.type) {
      // Booking notifications (User side)
      case 'booking_confirmed':
        urlToOpen = '/bookings';
        break;

      case 'booking_rescheduled':
        urlToOpen = data.url || '/bookings';
        break;

      case 'booking_cancelled':
        urlToOpen = data.url || '/bookings';
        break;

      // Message notifications (existing)
      case 'new_message':
      case 'message':
        urlToOpen = '/messages';
        break;

      // Default fallback
      default:
        urlToOpen = data.url || '/';
    }
  }

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

// Optional: Handle notification close event
self.addEventListener('notificationclose', function(event) {
  const data = event.notification.data || {};
  console.log('Notification closed:', data.type);

  // You can track notification dismissals here
  // Example: send analytics
});
```

### 2. Optional: Add Notification Sound (User Frontend)

```javascript
// In your main app file or notification component
// Play sound when notification arrives (if app is open)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'notification') {
      const audio = new Audio('/sounds/notification.mp3');
      audio.play().catch(e => console.log('Audio play failed:', e));
    }
  });
}
```

### 3. Update Notification Preferences UI (Optional)

```javascript
// components/NotificationPreferences.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

export function NotificationPreferences() {
  const { token } = useAuth();
  const [preferences, setPreferences] = useState({
    bookingConfirmations: true,
    bookingReschedules: true,
    bookingCancellations: true,
    messages: true
  });

  const updatePreference = async (key, value) => {
    setPreferences(prev => ({ ...prev, [key]: value }));

    // Save to backend (you'll need to create this endpoint)
    await fetch('/api/v1/users/notification-preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ [key]: value })
    });
  };

  return (
    <div className="notification-preferences">
      <h3>Notification Preferences</h3>

      <div className="preference-item">
        <label>
          <input
            type="checkbox"
            checked={preferences.bookingConfirmations}
            onChange={(e) => updatePreference('bookingConfirmations', e.target.checked)}
          />
          Booking Confirmations
        </label>
      </div>

      <div className="preference-item">
        <label>
          <input
            type="checkbox"
            checked={preferences.bookingReschedules}
            onChange={(e) => updatePreference('bookingReschedules', e.target.checked)}
          />
          Booking Reschedule Alerts
        </label>
      </div>

      <div className="preference-item">
        <label>
          <input
            type="checkbox"
            checked={preferences.bookingCancellations}
            onChange={(e) => updatePreference('bookingCancellations', e.target.checked)}
          />
          Booking Cancellation Alerts
        </label>
      </div>

      <div className="preference-item">
        <label>
          <input
            type="checkbox"
            checked={preferences.messages}
            onChange={(e) => updatePreference('messages', e.target.checked)}
          />
          Messages
        </label>
      </div>
    </div>
  );
}
```

## Merchant Frontend Updates

### 1. Update Service Worker (`public/service-worker.js`)

```javascript
self.addEventListener('push', function(event) {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/badge-72x72.png',
    data: data.data,
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
    tag: data.tag || 'default',
    vibrate: data.vibrate || [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const data = event.notification.data || {};
  const action = event.action;
  let urlToOpen = '/dashboard';

  // Handle notification actions
  if (action === 'view') {
    urlToOpen = data.url || '/dashboard';
  } else if (action === 'reply') {
    urlToOpen = '/dashboard/reviews';
  } else if (action === 'confirm') {
    urlToOpen = data.url || '/dashboard/bookings';
  } else {
    // Handle different notification types based on data.type
    switch(data.type) {
      // New notifications
      case 'new_follower':
        urlToOpen = '/dashboard/followers';
        break;

      case 'new_review':
        urlToOpen = '/dashboard/reviews';
        break;

      case 'new_booking':
        urlToOpen = '/dashboard/bookings';
        break;

      case 'booking_rescheduled_merchant':
        urlToOpen = data.url || '/dashboard/bookings';
        break;

      case 'booking_cancelled_merchant':
        urlToOpen = data.url || '/dashboard/bookings';
        break;

      // Message notifications (existing)
      case 'new_message':
      case 'message':
        urlToOpen = '/dashboard/messages';
        break;

      // Default fallback
      default:
        urlToOpen = data.url || '/dashboard';
    }
  }

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

// Optional: Handle notification close event
self.addEventListener('notificationclose', function(event) {
  const data = event.notification.data || {};
  console.log('Merchant notification closed:', data.type);
});
```

### 2. Optional: Add Desktop Notification Badge Count (Merchant Frontend)

```javascript
// utils/notificationBadge.js
export class NotificationBadge {
  static async update(count) {
    if ('setAppBadge' in navigator) {
      try {
        await navigator.setAppBadge(count);
      } catch (error) {
        console.log('Badge API not supported');
      }
    }
  }

  static async clear() {
    if ('clearAppBadge' in navigator) {
      try {
        await navigator.clearAppBadge();
      } catch (error) {
        console.log('Badge API not supported');
      }
    }
  }
}

// Usage in your notification handler
import { NotificationBadge } from './utils/notificationBadge';

// When notification arrives
NotificationBadge.update(unreadCount);

// When user views notifications
NotificationBadge.clear();
```

### 3. Update Notification Preferences UI (Merchant)

```javascript
// components/MerchantNotificationPreferences.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

export function MerchantNotificationPreferences() {
  const { token } = useAuth();
  const [preferences, setPreferences] = useState({
    newBookings: true,
    bookingReschedules: true,
    bookingCancellations: true,
    newReviews: true,
    newFollowers: true,
    messages: true
  });

  const updatePreference = async (key, value) => {
    setPreferences(prev => ({ ...prev, [key]: value }));

    // Save to backend
    await fetch('/api/v1/merchants/notification-preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ [key]: value })
    });
  };

  return (
    <div className="notification-preferences">
      <h3>Notification Preferences</h3>

      <h4>Booking Notifications</h4>
      <div className="preference-item">
        <label>
          <input
            type="checkbox"
            checked={preferences.newBookings}
            onChange={(e) => updatePreference('newBookings', e.target.checked)}
          />
          New Bookings
        </label>
      </div>

      <div className="preference-item">
        <label>
          <input
            type="checkbox"
            checked={preferences.bookingReschedules}
            onChange={(e) => updatePreference('bookingReschedules', e.target.checked)}
          />
          Booking Reschedules
        </label>
      </div>

      <div className="preference-item">
        <label>
          <input
            type="checkbox"
            checked={preferences.bookingCancellations}
            onChange={(e) => updatePreference('bookingCancellations', e.target.checked)}
          />
          Booking Cancellations
        </label>
      </div>

      <h4>Customer Engagement</h4>
      <div className="preference-item">
        <label>
          <input
            type="checkbox"
            checked={preferences.newReviews}
            onChange={(e) => updatePreference('newReviews', e.target.checked)}
          />
          New Reviews
        </label>
      </div>

      <div className="preference-item">
        <label>
          <input
            type="checkbox"
            checked={preferences.newFollowers}
            onChange={(e) => updatePreference('newFollowers', e.target.checked)}
          />
          New Followers
        </label>
      </div>

      <h4>Communication</h4>
      <div className="preference-item">
        <label>
          <input
            type="checkbox"
            checked={preferences.messages}
            onChange={(e) => updatePreference('messages', e.target.checked)}
          />
          Messages
        </label>
      </div>
    </div>
  );
}
```

## Testing the Updates

### 1. Clear Service Worker Cache

```javascript
// Run this in browser console to force update service worker
navigator.serviceWorker.getRegistrations().then(function(registrations) {
  for(let registration of registrations) {
    registration.unregister();
  }
}).then(() => {
  console.log('Service workers unregistered. Reload the page.');
});
```

### 2. Test Each Notification Type

#### User Frontend Tests:
```bash
# 1. Create a booking (as user)
# Expected: User receives "Booking Confirmed" push notification

# 2. Reschedule a booking
# Expected: User receives "Booking Rescheduled" push notification

# 3. Cancel a booking
# Expected: User receives "Booking Cancelled" push notification
```

#### Merchant Frontend Tests:
```bash
# 1. User follows store (as user)
# Expected: Merchant receives "New Follower" push notification

# 2. User submits review (as user)
# Expected: Merchant receives "New Review" push notification with rating

# 3. User creates booking (as user)
# Expected: Merchant receives "New Booking" push notification

# 4. Booking is rescheduled
# Expected: Merchant receives "Booking Rescheduled" push notification

# 5. Booking is cancelled
# Expected: Merchant receives "Booking Cancelled" push notification
```

## Notification Appearance Examples

### User Side Notifications

**Booking Confirmed:**
```
Title: ✅ Booking Confirmed!
Body: Your booking for Haircut at Salon XYZ is confirmed for Dec 15, 2025 at 2:00 PM
Actions: [View Details] [Add to Calendar]
```

**Booking Rescheduled:**
```
Title: 🔄 Booking Rescheduled
Body: Your Haircut booking at Salon XYZ has been moved from Dec 15 at 2:00 PM to Dec 16 at 3:00 PM
Actions: [View Details] [Confirm Change]
```

**Booking Cancelled:**
```
Title: ❌ Booking Cancelled
Body: Your Haircut booking at Salon XYZ for Dec 15 at 2:00 PM has been cancelled
Actions: [View Details] [Book Again]
```

### Merchant Side Notifications

**New Follower:**
```
Title: 🎉 New Follower!
Body: John Doe started following Salon XYZ
Actions: [View Followers]
```

**New Review:**
```
Title: 📝 New Review!
Body: Jane Smith rated Salon XYZ ⭐⭐⭐⭐⭐ (5/5)
Actions: [View Review] [Reply]
```

**New Booking:**
```
Title: 📅 New Booking!
Body: John Doe booked Haircut for Dec 15, 2025 at 2:00 PM
Actions: [View Booking] [Confirm]
```

## Deployment Checklist

### Both Frontends:
- [ ] Update service worker file
- [ ] Test service worker in development
- [ ] Clear old service worker cache
- [ ] Build and deploy updated service worker
- [ ] Test on HTTPS (production)
- [ ] Verify notifications appear correctly
- [ ] Test notification click actions
- [ ] Test on multiple devices/browsers

### User Frontend Specific:
- [ ] Test booking confirmation notifications
- [ ] Test booking reschedule notifications
- [ ] Test booking cancellation notifications
- [ ] Add notification preferences UI (optional)

### Merchant Frontend Specific:
- [ ] Test new follower notifications
- [ ] Test new review notifications
- [ ] Test new booking notifications
- [ ] Test booking reschedule notifications (merchant side)
- [ ] Test booking cancellation notifications (merchant side)
- [ ] Add notification preferences UI (optional)
- [ ] Add badge count feature (optional)

## Troubleshooting

### Notifications Not Appearing
1. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
2. Check if service worker is updated: DevTools > Application > Service Workers
3. Unregister old service worker and reload
4. Check browser console for errors
5. Verify push subscription still exists in database

### Wrong URL Opens on Click
1. Check the `data.url` field in notification payload
2. Verify your service worker routing logic matches notification types
3. Check browser console for navigation errors

### Notifications Work But No Sound
1. Check browser notification settings allow sound
2. Verify sound file exists at specified path
3. Check if user has muted notifications for your site

## Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 90+ | ✅ Full | Best support |
| Firefox 88+ | ✅ Full | Full support |
| Safari 16+ | ✅ Limited | Requires iOS 16.4+ and "Add to Home Screen" |
| Edge 90+ | ✅ Full | Same as Chrome |
| Opera 76+ | ✅ Full | Full support |

## Performance Tips

1. **Cache notification icons** in service worker for faster display
2. **Limit notification frequency** to avoid annoying users
3. **Group related notifications** using the same `tag`
4. **Use badge API** to show count instead of multiple notifications
5. **Clear old notifications** programmatically

## Support

For issues:
- Check backend logs: `docker logs server`
- Check browser console for errors
- Verify VAPID keys are correct
- Test with curl to ensure backend is sending notifications
- Email: support@discoun3ree.com

## Additional Resources

- [Web Push API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
