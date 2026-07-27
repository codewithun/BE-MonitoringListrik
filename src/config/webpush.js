const webpush = require('web-push');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  let subject = process.env.VAPID_SUBJECT || 'mailto:admin@monitoring-listrik.local';
  
  // Jika subject adalah email murni (tanpa mailto: dan tanpa http://), tambahkan mailto:
  if (!subject.startsWith('mailto:') && !subject.startsWith('http')) {
    subject = 'mailto:' + subject;
  }

  webpush.setVapidDetails(
    subject,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn('⚠️ VAPID keys tidak ditemukan di .env. Fitur Web Push mungkin tidak berfungsi.');
}

module.exports = webpush;
