const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.set('trust proxy', true);

const ADMIN_EMAIL = "admin@pepe.com";
const DB_FILE = path.join(__dirname, 'database.json');

function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.error("Database read error:", e);
    }
  }
  return {
    users: [
      { email: "admin@pepe.com", uid: "admin_01", balance: 0, refs: 0, adsToday: 0, lastAdReset: Date.now(), referredBy: null, completedTasks: [], history: [], ip: "127.0.0.1", deviceId: "admin_device" }
    ],
    adminSettings: {
      minRefs: 0,
      minWithdraw: 5,
      dailyLimit: 30,
      rewardPerAd: 10,
      adDuration: 15,
      adNetworkUrl: "https://uplcm.com/4/9137470",
      faucetpayApiKey: "660278ac2da745a2cc93882be85c519663b4f7f773db8388eccb7a056db1cc39"
    },
    tasks: [
      { id: 1, title: "টেলিগ্রাম চ্যানেল (+10)", reward: 10, link: "https://t.me" }
    ],
    totalPaidOut: 0
  };
}

function saveDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error("Database save error:", e);
  }
}

let db = loadDb();

function checkDailyReset(user) {
  const twentyFourHours = 24 * 60 * 60 * 1000;
  if (Date.now() - user.lastAdReset >= twentyFourHours) {
    user.adsToday = 0;
    user.lastAdReset = Date.now();
  }
}

// কঠোর ডিভাইস লক ও অ্যাকাউন্ট সিকিউরিটি
app.post('/api/login', (req, res) => {
  db = loadDb();
  const { email, refUid, deviceId } = req.body;
  
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'সঠিক FaucetPay ইমেইল দিন।' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown_ip';
  const clientDevice = deviceId || 'unknown_device';

  let user = db.users.find(u => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    // যদি কেউ এডমিন না হয়, তবে চেক করবে এই ডিভাইস থেকে ইতিপূর্বে অন্য কোনো অ্যাকাউন্ট খোলা হয়েছে কি না
    if (cleanEmail !== ADMIN_EMAIL.toLowerCase()) {
      const existingDeviceUser = db.users.find(u => u.deviceId === clientDevice && u.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase());
      if (existingDeviceUser) {
        return res.status(400).json({ 
          success: false, 
          message: 'সিকিউরিটি অ্যালার্ট! এই ডিভাইস থেকে ইতিমধ্যে একটি অ্যাকাউন্ট খোলা হয়েছে। একাধিক অ্যাকাউন্ট খোলা কঠোরভাবে নিষিদ্ধ।' 
        });
      }
    }

    const uniqueUid = 'u_' + Math.floor(100000 + Math.random() * 900000);
    user = { 
      email: email.trim(), 
      uid: uniqueUid, 
      balance: 0, 
      refs: 0, 
      adsToday: 0, 
      lastAdReset: Date.now(), 
      referredBy: null, 
      completedTasks: [], 
      history: [],
      ip: clientIp,
      deviceId: clientDevice
    };
    
    if (refUid) {
      let referrer = db.users.find(u => u.uid === refUid);
      if (referrer && referrer.email.toLowerCase() !== cleanEmail) {
        user.referredBy = referrer.email;
        referrer.refs += 1;
        referrer.history.unshift({ type: `New Referral`, amount: '+1 Ref', date: new Date().toLocaleTimeString() });
      }
    }
    db.users.push(user);
    saveDb(db);
  }
  
  checkDailyReset(user);
  saveDb(db);
  const isAdmin = (cleanEmail === ADMIN_EMAIL.toLowerCase());
  res.json({ success: true, user, isAdmin });
});

app.get('/api/user/:email', (req, res) => {
  db = loadDb();
  const email = req.params.email.trim().toLowerCase();
  const user = db.users.find(u => u.email.toLowerCase() === email);
  if (!user) return res.status(404).json({ success: false });

  checkDailyReset(user);
  saveDb(db);
  const isAdmin = (email === ADMIN_EMAIL.toLowerCase());

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
  db = loadDb();
  const { email, minRefs, minWithdraw, dailyLimit, rewardPerAd, adDuration, adNetworkUrl, faucetpayApiKey } = req.body;
  if (!email || email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return res.status(403).json({ success: false });

  db.adminSettings.minRefs = Number(minRefs);
  db.adminSettings.minWithdraw = Number(minWithdraw);
  db.adminSettings.dailyLimit = Number(dailyLimit);
  db.adminSettings.rewardPerAd = Number(rewardPerAd);
  db.adminSettings.adDuration = Number(adDuration) || 15;
  db.adminSettings.adNetworkUrl = adNetworkUrl;
  db.adminSettings.faucetpayApiKey = faucetpayApiKey;

  saveDb(db);
  res.json({ success: true, message: 'সেটিংস সফলভাবে আপডেট হয়েছে!' });
});

app.post('/api/admin/tasks/add', (req, res) => {
  db = loadDb();
  const { email, title, reward, link } = req.body;
  if (!email || email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return res.status(403).json({ success: false });

  db.tasks.push({ id: Date.now(), title, reward: Number(reward), link });
  saveDb(db);
  res.json({ success: true, message: 'টাস্ক সফলভাবে যোগ হয়েছে!' });
});

app.post('/api/admin/tasks/delete', (req, res) => {
  db = loadDb();
  const { email, taskId } = req.body;
  if (!email || email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return res.status(403).json({ success: false });

  db.tasks = db.tasks.filter(t => t.id !== taskId);
  saveDb(db);
  res.json({ success: true, message: 'টাস্ক ডিলিট করা হয়েছে!' });
});

app.post('/api/watch-ad', (req, res) => {
  db = loadDb();
  const { email } = req.body;
  let user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) return res.status(400).json({ success: false, message: 'ইউজার পাওয়া যায়নি!' });

  checkDailyReset(user);
  if (user.adsToday >= db.adminSettings.dailyLimit) {
    return res.json({ success: false, message: `আজকের এড দেখার লিমিট শেষ!` });
  }

  user.balance += db.adminSettings.rewardPerAd;
  user.adsToday += 1;
  user.history.unshift({ type: 'Ad Watch Reward', amount: `+${db.adminSettings.rewardPerAd} PEPE`, date: new Date().toLocaleTimeString() });
  
  saveDb(db);
  res.json({ success: true, newBalance: user.balance, adsToday: user.adsToday });
});

app.post('/api/claim-task', (req, res) => {
  db = loadDb();
  const { email, taskId } = req.body;
  let user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  let task = db.tasks.find(t => t.id === taskId);
  if (!user || !task) return res.status(400).json({ success: false, message: 'টাস্ক বা ইউজার পাওয়া যায়নি!' });

  if (user.completedTasks.includes(taskId)) {
    return res.json({ success: false, message: 'এই টাস্কটি ইতিমধ্যে সম্পন্ন করেছেন!' });
  }

  user.completedTasks.push(taskId);
  user.balance += task.reward;
  user.history.unshift({ type: `Task: ${task.title}`, amount: `+${task.reward} PEPE`, date: new Date().toLocaleTimeString() });

  saveDb(db);
  res.json({ success: true, message: `সফলভাবে ${task.reward} PEPE পয়েন্ট যোগ হয়েছে!` });
});

app.post('/api/withdraw', async (req, res) => {
  db = loadDb();
  const { email, withdrawEmail } = req.body;
  let user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) return res.status(400).json({ success: false, message: 'ইউজার পাওয়া যায়নি!' });

  if (user.refs < db.adminSettings.minRefs) {
    return res.json({ success: false, message: `উইথড্র করতে কমপক্ষে ${db.adminSettings.minRefs}টি রেফার করতে হবে!` });
  }
  if (user.balance < db.adminSettings.minWithdraw) {
    return res.json({ success: false, message: `ন্যূনতম উইথড্র অ্যামাউন্ট ${db.adminSettings.minWithdraw} PEPE!` });
  }

  const amount = user.balance;
  const satoshiAmount = Math.round(amount * 100000000); 

  try {
    const fpResponse = await fetch('https://faucetpay.io/api/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        api_key: db.adminSettings.faucetpayApiKey,
        to: withdrawEmail,
        amount: satoshiAmount,
        currency: 'PEPE'
      })
    });

    const fpResult = await fpResponse.json();

    if (fpResult.status === 200) {
      user.balance = 0;
      db.totalPaidOut += amount;
      user.history.unshift({ type: `FaucetPay Payout (${withdrawEmail})`, amount: `-${amount} PEPE`, date: new Date().toLocaleTimeString() });
      saveDb(db);
      return res.json({ success: true, message: `সফলভাবে ${amount} PEPE আপনার FaucetPay ওয়ালেটে পাঠানো হয়েছে!` });
    } else {
      return res.json({ success: false, message: `পেমেন্ট ফেইল হয়েছে: ${fpResult.message || 'পর্যাপ্ত ব্যালেন্স বা ফসেটে ফান্ড নেই'}` });
    }
  } catch (error) {
    return res.json({ success: false, message: 'সার্ভার কানেকশন এরর! ফসেটপে এপিআই কাজ করছে না।' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
