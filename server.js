const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ADMIN_EMAIL = "admin@pepe.com";

let db = {
  users: [
    { email: "admin@pepe.com", balance: 0, refs: 10, adsToday: 0, history: [] },
    { email: "user@faucetpay.com", balance: 50, refs: 2, adsToday: 1, history: [{type: 'Ad Reward', amount: 50, date: 'Today'}] }
  ],
  adminSettings: {
    minRefs: 3,
    dailyLimit: 30,
    rewardPerAd: 50
  },
  tasks: [
    { id: 1, title: "আমাদের টেলিগ্রাম চ্যানেলে জয়েন করুন", reward: 100, link: "https://t.me" },
    { id: 2, title: "ইউটিউব চ্যানেল সাবস্ক্রাইব করুন", reward: 150, link: "https://youtube.com" }
  ]
};

app.post('/api/login', (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'সঠিক FaucetPay ইমেইল দিন।' });
  }
  
  let user = db.users.find(u => u.email === email);
  if (!user) {
    user = { email, balance: 0, refs: 0, adsToday: 0, history: [] };
    db.users.push(user);
  }

  const isAdmin = (email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  res.json({ success: true, user, isAdmin });
});

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
    allUsers: isAdmin ? db.users : [] 
  });
});

// Watch Ad API
app.post('/api/watch-ad', (req, res) => {
  const { email } = req.body;
  let user = db.users.find(u => u.email === email);
  if (!user) return res.status(400).json({ success: false });

  if (user.adsToday >= db.adminSettings.dailyLimit) {
    return res.json({ success: false, message: 'আজকের ৩০টি এড দেখার লিমিট শেষ!' });
  }

  user.balance += db.adminSettings.rewardPerAd;
  user.adsToday += 1;
  user.history.unshift({ type: 'Ad Watch Reward', amount: db.adminSettings.rewardPerAd, date: new Date().toLocaleTimeString() });
  
  res.json({ success: true, newBalance: user.balance, adsToday: user.adsToday });
});

// Complete Task API
app.post('/api/complete-task', (req, res) => {
  const { email, taskId } = req.body;
  let user = db.users.find(u => u.email === email);
  let task = db.tasks.find(t => t.id === taskId);
  if (!user || !task) return res.status(400).json({ success: false });

  user.balance += task.reward;
  user.history.unshift({ type: `Task: ${task.title}`, amount: task.reward, date: new Date().toLocaleTimeString() });

  res.json({ success: true, newBalance: user.balance });
});

// Withdraw API
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
  user.history.unshift({ type: 'FaucetPay Withdrawal', amount: -amount, date: new Date().toLocaleTimeString() });

  res.json({ success: true, message: `সফলভাবে ${amount} PEPE আপনার FaucetPay ইমেইলে পেমেন্ট পাঠানো হয়েছে!` });
});

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
