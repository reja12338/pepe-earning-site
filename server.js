const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// এডমিন ইমেইল (এটি দিয়ে লগইন করলে এডমিন প্যানেল ওপেন হবে)
const ADMIN_EMAIL = "admin@pepe.com";

let db = {
  users: [
    { email: "admin@pepe.com", balance: 0, refs: 10, lastAdTime: 0, adsToday: 0 },
    { email: "user@faucetpay.com", balance: 1250, refs: 3, lastAdTime: 0, adsToday: 5 }
  ],
  adminSettings: {
    minRefs: 3,
    dailyLimit: 30,
    rewardPerAd: 50
  },
  tasks: [
    { id: 1, title: "Telegram চ্যানেলে জয়েন করুন", reward: 100, link: "https://t.me" }
  ],
  ads: [
    { id: 1, title: "পিপ কইন স্পন্সর এড #১", reward: 50, duration: 15, url: "https://example.com" }
  ]
};

// API: Login / Register (Admin or User)
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

  const isAdmin = (email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  res.json({ success: true, user, isAdmin });
});

// API: Get Dashboard Data
app.get('/api/user/:email', (req, res) => {
  const email = req.params.email;
  const user = db.users.find(u => u.email === email);
  if (!user) return res.status(404).json({ success: false });

  const isAdmin = (email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  res.json({ 
    success: true, 
    user, 
    isAdmin,
    settings: db.adminSettings, 
    tasks: db.tasks, 
    ads: db.ads, 
    allUsers: isAdmin ? db.users : [] 
  });
});

// API: Admin Update Settings
app.post('/api/admin/settings', (req, res) => {
  const { email, minRefs, dailyLimit, rewardPerAd } = req.body;
  if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ success: false, message: 'অনুমতি নেই!' });
  }

  db.adminSettings.minRefs = Number(minRefs);
  db.adminSettings.dailyLimit = Number(dailyLimit);
  db.adminSettings.rewardPerAd = Number(rewardPerAd);

  res.json({ success: true, message: 'সেটিংস সফলভাবে আপডেট হয়েছে!' });
});

// API: Watch Ad
app.post('/api/watch-ad', (req, res) => {
  const { email, adId } = req.body;
  let user = db.users.find(u => u.email === email);
  if (!user) return res.status(400).json({ success: false });

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
  user.balance = 0;
  res.json({ success: true, message: `সফলভাবে ${amount} PEPE আপনার FaucetPay ইমেইলে পেমেন্ট পাঠানো হয়েছে!` });
});

// API: Demo Add Ref
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
