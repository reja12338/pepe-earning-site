const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ডেমো ডাটাবেস (মেমোরিতে সংরক্ষিত থাকবে)
let db = {
  users: [
    { email: "user@faucetpay.com", balance: 1250, refs: 3, lastAdTime: 0, adsToday: 5 }
  ],
  adminSettings: {
    minRefs: 3,
    dailyLimit: 30,
    rewardPerAd: 50
  },
  tasks: [
    { id: 1, title: "Telegram চ্যানেলে জয়েন করুন", reward: 100, link: "https://t.me" },
    { id: 2, title: "আমাদের ফেসবুক পেজ ফলো করুন", reward: 150, link: "https://facebook.com" }
  ],
  ads: [
    { id: 1, title: "পিপ কইন স্পন্সর এড #১", reward: 50, duration: 15, url: "https://example.com" },
    { id: 2, title: "ক্রিপ্টো এক্সচেঞ্জ অফার #২", reward: 50, duration: 15, url: "https://example.com" }
  ]
};

// API: Login / Register
app.post('/api/login', (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'সঠিক FaucetPay ইমেইল দিন।' });
  }
  let user = db.users.find(u => u.email === email);
  if (!user) {
    user = { email, balance: 0, refs: 0, lastAdTime: 0, adsToday: 0 };
    db.users.push(user);
  }
  res.json({ success: true, user });
});

// API: Get Dashboard Data
app.get('/api/user/:email', (req, res) => {
  const user = db.users.find(u => u.email === req.params.email);
  if (!user) return res.status(404).json({ success: false });
  res.json({ success: true, user, settings: db.adminSettings, tasks: db.tasks, ads: db.ads, totalUsers: db.users.length });
});

// API: Complete Ad
app.post('/api/watch-ad', (req, res) => {
  const { email, adId } = req.body;
  let user = db.users.find(u => u.email === email);
  if (!user) return res.status(400).json({ success: false, message: 'ইউজার পাওয়া যায়নি।' });

  if (user.adsToday >= db.adminSettings.dailyLimit) {
    return res.json({ success: false, message: 'আজকের ৩০টি এড দেখার লিমিট শেষ!' });
  }

  user.balance += db.adminSettings.rewardPerAd;
  user.adsToday += 1;
  res.json({ success: true, newBalance: user.balance, adsToday: user.adsToday });
});

// API: Withdraw
app.post('/api/withdraw', (req, res) => {
  const { email } = req.body;
  let user = db.users.find(u => u.email === email);
  if (!user) return res.status(400).json({ success: false });

  if (user.refs < db.adminSettings.minRefs) {
    return res.json({ success: false, message: `উইথড্র করতে কমপক্ষে ${db.adminSettings.minRefs}টি রেফার করতে হবে!` });
  }
  if (user.balance <= 0) {
    return res.json({ success: false, message: 'পর্যাপ্ত ব্যালেন্স নেই!' });
  }

  const amount = user.balance;
  user.balance = 0; // ব্যালেন্স শূন্য করা
  res.json({ success: true, message: `সফলভাবে ${amount} PEPE আপনার FaucetPay ইমেইলে পেমেন্ট পাঠানো হয়েছে!` });
});

// API: Demo Add Ref (Test purpose)
app.post('/api/add-ref', (req, res) => {
  const { email } = req.body;
  let user = db.users.find(u => u.email === email);
  if (user) {
    user.refs += 1;
    res.json({ success: true, refs: user.refs });
  } else {
    res.json({ success: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
