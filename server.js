const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ADMIN_EMAIL = "admin@pepe.com";

let db = {
  users: [
    { email: "admin@pepe.com", balance: 0, refs: 10, adsToday: 0, lastAdReset: Date.now(), history: [] },
    { email: "user@faucetpay.com", balance: 150, refs: 2, adsToday: 3, lastAdReset: Date.now(), history: [{type: 'Ad Reward', amount: 50, date: '10:00 AM'}] }
  ],
  adminSettings: {
    minRefs: 3,
    dailyLimit: 30,
    rewardPerAd: 50,
    adDuration: 15,
    adNetworkUrl: "https://www.google.com", // এখান থেকে এড লিংক পরিবর্তন হবে
    faucetpayApiKey: "YOUR_FAUCETPAY_API_KEY"
  },
  tasks: [
    { id: 1, title: "আমাদের টেলিগ্রাম চ্যানেলে জয়েন করুন", reward: 100, link: "https://t.me" },
    { id: 2, title: "ইউটিউব চ্যানেল সাবস্ক্রাইব করুন", reward: 150, link: "https://youtube.com" }
  ],
  totalPaidOut: 4500
};

// ২৪ ঘণ্টা পর ডেইলি এড লিমিট রিসেট চেক
function checkDailyReset(user) {
  const twentyFourHours = 24 * 60 * 60 * 1000;
  if (Date.now() - user.lastAdReset >= twentyFourHours) {
    user.adsToday = 0;
    user.lastAdReset = Date.now();
  }
}

// Login / Register
app.post('/api/login', (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'সঠিক FaucetPay ইমেইল দিন।' });
  }
  
  let user = db.users.find(u => u.email === email);
  if (!user) {
    user = { email, balance: 0, refs: 0, adsToday: 0, lastAdReset: Date.now(), history: [] };
    db.users.push(user);
  }
  checkDailyReset(user);

  const isAdmin = (email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  res.json({ success: true, user, isAdmin });
});

// Get User & Admin Data
app.get('/api/user/:email', (req, res) => {
  const email = req.params.email;
  const user = db.users.find(u => u.email === email);
  if (!user) return res.status(404).json({ success: false });

  checkDailyReset(user);
  const isAdmin = (email.toLowerCase() === ADMIN_EMAIL.toLowerCase());

  res.json({ 
    success: true, 
    user, 
    isAdmin,
    settings: db.adminSettings, 
    tasks: db.tasks, 
    stats: {
      totalUsers: db.users.length,
      totalPaidOut: db.totalPaidOut
    },
    allUsers: isAdmin ? db.users : [] 
  });
});

// Admin: Update All Settings (Ad Link, API Key, Limits, Ref Req)
app.post('/api/admin/settings', (req, res) => {
  const { email, minRefs, dailyLimit, rewardPerAd, adDuration, adNetworkUrl, faucetpayApiKey } = req.body;
  if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ success: false, message: 'অনুমতি নেই!' });
  }

  db.adminSettings.minRefs = Number(minRefs);
  db.adminSettings.dailyLimit = Number(dailyLimit);
  db.adminSettings.rewardPerAd = Number(rewardPerAd);
  db.adminSettings.adDuration = Number(adDuration) || 15;
  db.adminSettings.adNetworkUrl = adNetworkUrl;
  db.adminSettings.faucetpayApiKey = faucetpayApiKey;

  res.json({ success: true, message: 'সকল সেটিংস সফলভাবে আপডেট হয়েছে!' });
});

// Admin: Add New Task
app.post('/api/admin/tasks/add', (req, res) => {
  const { email, title, reward, link } = req.body;
  if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return res.status(403).json({ success: false });

  const newTask = {
    id: Date.now(),
    title,
    reward: Number(reward),
    link
  };
  db.tasks.push(newTask);
  res.json({ success: true, message: 'নতুন টাস্ক যুক্ত হয়েছে!' });
});

// Admin: Delete Task
app.post('/api/admin/tasks/delete', (req, res) => {
  const { email, taskId } = req.body;
  if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return res.status(403).json({ success: false });

  db.tasks = db.tasks.filter(t => t.id !== taskId);
  res.json({ success: true, message: 'টাস্ক ডিলিট করা হয়েছে!' });
});

// User: Watch Ad Reward
app.post('/api/watch-ad', (req, res) => {
  const { email } = req.body;
  let user = db.users.find(u => u.email === email);
  if (!user) return res.status(400).json({ success: false });

  checkDailyReset(user);
  if (user.adsToday >= db.adminSettings.dailyLimit) {
    return res.json({ success: false, message: `আজকের ${db.adminSettings.dailyLimit}টি এড দেখার লিমিট শেষ! ২৪ ঘণ্টা পর আবার চেষ্টা করুন।` });
  }

  user.balance += db.adminSettings.rewardPerAd;
  user.adsToday += 1;
  user.history.unshift({ type: 'Ad Watch Reward', amount: `+${db.adminSettings.rewardPerAd} PEPE`, date: new Date().toLocaleTimeString() });
  
  res.json({ success: true, newBalance: user.balance, adsToday: user.adsToday });
});

// User: Complete Task
app.post('/api/complete-task', (req, res) => {
  const { email, taskId } = req.body;
  let user = db.users.find(u => u.email === email);
  let task = db.tasks.find(t => t.id === taskId);
  if (!user || !task) return res.status(400).json({ success: false });

  user.balance += task.reward;
  user.history.unshift({ type: `Task: ${task.title}`, amount: `+${task.reward} PEPE`, date: new Date().toLocaleTimeString() });

  res.json({ success: true, newBalance: user.balance });
});

// User: Auto Withdraw
app.post('/api/withdraw', (req, res) => {
  const { email, withdrawEmail } = req.body;
  let user = db.users.find(u => u.email === email);
  if (!user) return res.status(400).json({ success: false });

  if (user.refs < db.adminSettings.minRefs) {
    return res.json({ success: false, message: `উইথড্র করতে কমপক্ষে ${db.adminSettings.minRefs}টি রেফার করতে হবে!` });
  }
  if (user.balance <= 0) {
    return res.json({ success: false, message: 'আপনার ব্যালেন্স শূন্য!' });
  }

  const amount = user.balance;
  user.balance = 0;
  db.totalPaidOut += amount;
  user.history.unshift({ type: `FaucetPay Auto-Payout (${withdrawEmail})`, amount: `-${amount} PEPE`, date: new Date().toLocaleTimeString() });

  res.json({ success: true, message: `সফলভাবে ${amount} PEPE আপনার FaucetPay ইমেইলে (${withdrawEmail}) অটো-পেমেন্ট পাঠানো হয়েছে!` });
});

// Demo Add Ref
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
