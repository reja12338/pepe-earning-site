const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ADMIN_EMAIL = "admin@pepe.com";

let db = {
  users: [
    { email: "admin@pepe.com", balance: 0, refs: 0, adsToday: 0, lastAdReset: Date.now(), referredBy: null, completedTasks: [], history: [] }
  ],
  adminSettings: {
    minRefs: 3,
    minWithdraw: 1000,
    dailyLimit: 30,
    rewardPerAd: 50,
    adDuration: 15,
    adNetworkUrl: "https://www.google.com",
    faucetpayApiKey: ""
  },
  tasks: [
    { id: 1, title: "আমাদের টেলিগ্রাম চ্যানেলে জয়েন করুন", reward: 100, link: "https://t.me" },
    { id: 2, title: "আমাদের ইউটিউব চ্যানেল সাবস্ক্রাইব করুন", reward: 150, link: "https://youtube.com" }
  ],
  totalPaidOut: 0
};

function checkDailyReset(user) {
  const twentyFourHours = 24 * 60 * 60 * 1000;
  if (Date.now() - user.lastAdReset >= twentyFourHours) {
    user.adsToday = 0;
    user.lastAdReset = Date.now();
  }
}

app.post('/api/login', (req, res) => {
  const { email, refBy } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'সঠিক FaucetPay ইমেইল দিন।' });
  }
  
  let user = db.users.find(u => u.email === email);
  if (!user) {
    user = { email, balance: 0, refs: 0, adsToday: 0, lastAdReset: Date.now(), referredBy: null, completedTasks: [], history: [] };
    if (refBy && refBy !== email) {
      let referrer = db.users.find(u => u.email === refBy);
      if (referrer) {
        user.referredBy = refBy;
        referrer.refs += 1;
        referrer.history.unshift({ type: `New Referral (${email})`, amount: '+1 Ref', date: new Date().toLocaleTimeString() });
      }
    }
    db.users.push(user);
  }
  
  checkDailyReset(user);
  const isAdmin = (email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  res.json({ success: true, user, isAdmin });
});

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

app.post('/api/admin/settings', (req, res) => {
  const { email, minRefs, minWithdraw, dailyLimit, rewardPerAd, adDuration, adNetworkUrl, faucetpayApiKey } = req.body;
  if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return res.status(403).json({ success: false });

  db.adminSettings.minRefs = Number(minRefs);
  db.adminSettings.minWithdraw = Number(minWithdraw);
  db.adminSettings.dailyLimit = Number(dailyLimit);
  db.adminSettings.rewardPerAd = Number(rewardPerAd);
  db.adminSettings.adDuration = Number(adDuration) || 15;
  db.adminSettings.adNetworkUrl = adNetworkUrl;
  db.adminSettings.faucetpayApiKey = faucetpayApiKey;

  res.json({ success: true, message: 'সেটিংস সফলভাবে আপডেট হয়েছে!' });
});

app.post('/api/admin/tasks/add', (req, res) => {
  const { email, title, reward, link } = req.body;
  if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return res.status(403).json({ success: false });

  db.tasks.push({ id: Date.now(), title, reward: Number(reward), link });
  res.json({ success: true, message: 'টাস্ক সফলভাবে যোগ হয়েছে!' });
});

app.post('/api/admin/tasks/delete', (req, res) => {
  const { email, taskId } = req.body;
  if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return res.status(403).json({ success: false });

  db.tasks = db.tasks.filter(t => t.id !== taskId);
  res.json({ success: true, message: 'টাস্ক ডিলিট করা হয়েছে!' });
});

app.post('/api/watch-ad', (req, res) => {
  const { email } = req.body;
  let user = db.users.find(u => u.email === email);
  if (!user) return res.status(400).json({ success: false });

  checkDailyReset(user);
  if (user.adsToday >= db.adminSettings.dailyLimit) {
    return res.json({ success: false, message: `আজকের এড দেখার লিমিট শেষ!` });
  }

  user.balance += db.adminSettings.rewardPerAd;
  user.adsToday += 1;
  user.history.unshift({ type: 'Ad Watch Reward', amount: `+${db.adminSettings.rewardPerAd} PEPE`, date: new Date().toLocaleTimeString() });
  
  res.json({ success: true, newBalance: user.balance, adsToday: user.adsToday });
});

// Task Claim API (ক্লাইম করার পর ব্যালেন্সে যোগ হবে এবং কমপ্লিটেড লিস্টে থাকবে)
app.post('/api/claim-task', (req, res) => {
  const { email, taskId } = req.body;
  let user = db.users.find(u => u.email === email);
  let task = db.tasks.find(t => t.id === taskId);
  if (!user || !task) return res.status(400).json({ success: false });

  if (user.completedTasks.includes(taskId)) {
    return res.json({ success: false, message: 'এই টাস্কটি আপনি ইতিমধ্যে সম্পন্ন করেছেন!' });
  }

  user.completedTasks.push(taskId);
  user.balance += task.reward;
  user.history.unshift({ type: `Task: ${task.title}`, amount: `+${task.reward} PEPE`, date: new Date().toLocaleTimeString() });

  res.json({ success: true, message: `সফলভাবে ${task.reward} PEPE পয়েন্ট যোগ হয়েছে!` });
});

app.post('/api/withdraw', (req, res) => {
  const { email, withdrawEmail } = req.body;
  let user = db.users.find(u => u.email === email);
  if (!user) return res.status(400).json({ success: false });

  if (user.refs < db.adminSettings.minRefs) {
    return res.json({ success: false, message: `উইথড্র করতে কমপক্ষে ${db.adminSettings.minRefs}টি রিয়েল রেফার করতে হবে!` });
  }
  if (user.balance < db.adminSettings.minWithdraw) {
    return res.json({ success: false, message: `ন্যূনতম উইথড্র অ্যামাউন্ট ${db.adminSettings.minWithdraw} PEPE!` });
  }

  const amount = user.balance;
  user.balance = 0;
  db.totalPaidOut += amount;
  user.history.unshift({ type: `FaucetPay Payout (${withdrawEmail})`, amount: `-${amount} PEPE`, date: new Date().toLocaleTimeString() });

  res.json({ success: true, message: `সফলভাবে ${amount} PEPE আপনার FaucetPay ইমেইলে পেমেন্ট পাঠানো হয়েছে!` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
