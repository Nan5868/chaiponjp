const express = require('express');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'responses.json');

function loadResponses() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveResponses(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// フォーム送信
app.post('/submit', async (req, res) => {
  const responses = loadResponses();
  const entry = {
    id: Date.now(),
    submittedAt: new Date().toISOString(),
    status: 'pending',
    name: 'さとさん',
    email: req.body.email,
    date1: req.body.date1,
    time1: req.body.time1 || '',
    date2: req.body.date2,
    time2: req.body.time2 || '',
    date3: req.body.date3,
    time3: req.body.time3 || '',
    groupType: req.body.groupType,
    count: req.body.count,
    cuisine: req.body.cuisine,
    allergy: req.body.allergy || 'なし',
    message: req.body.message || '',
  };
  responses.push(entry);
  saveResponses(responses);

  const config = loadConfig();
  const notifyTargets = [config.notifyEmail, config.fatherEmail].filter(Boolean);
  if (notifyTargets.length > 0) {
    const notifyBody =
      `さとさんがフォームを送信しました！\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      `📅 第1希望: ${entry.date1} ${entry.time1 ? '／' + entry.time1 : ''}\n` +
      `📅 第2希望: ${entry.date2 ? entry.date2 + (entry.time2 ? ' ／' + entry.time2 : '') : 'なし'}\n` +
      `📅 第3希望: ${entry.date3 ? entry.date3 + (entry.time3 ? ' ／' + entry.time3 : '') : 'なし'}\n` +
      `👥 ${entry.groupType}・${entry.count}名\n` +
      `🍽️  料理: ${entry.cuisine}\n` +
      `🚫 アレルギー: ${entry.allergy}\n` +
      `💬 メッセージ: ${entry.message || 'なし'}\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `管理画面で予約を確定してください👇\n` +
      `${config.adminUrl || '/admin'}`;
    await Promise.all(
      notifyTargets.map(email =>
        sendMail(config, email, '【新着】さとさんからフォームが届きました！', notifyBody)
          .catch(err => console.error(`通知メール送信エラー(${email}):`, err))
      )
    );
  }

  res.redirect('/thanks.html');
});

// 管理画面: 回答一覧
app.get('/admin', (req, res) => {
  const responses = loadResponses();
  const rows = responses.map(r => `
    <tr class="${r.status === 'confirmed' ? 'confirmed' : r.status === 'rejected' ? 'rejected' : ''}">
      <td>${new Date(r.submittedAt).toLocaleString('ja-JP')}</td>
      <td><strong>${r.name}</strong><br><small>${r.email}</small></td>
      <td>
        第1希望: ${r.date1} ${r.time1 ? '／' + r.time1 : ''}<br>
        第2希望: ${r.date2 ? r.date2 + (r.time2 ? ' ／' + r.time2 : '') : '—'}<br>
        第3希望: ${r.date3 ? r.date3 + (r.time3 ? ' ／' + r.time3 : '') : '—'}
      </td>
      <td>${r.groupType}・${r.count}名</td>
      <td>${r.cuisine}</td>
      <td>${r.allergy}</td>
      <td class="status-cell">
        ${r.status === 'pending' ? `
          <div class="action-form">
            <label>確定日程:</label>
            <input type="date" id="date-${r.id}">
            <label>時間:</label>
            <input type="time" id="time-${r.id}" value="19:00">
            <button class="btn-confirm" onclick="confirm_reservation(${r.id})">✅ 予約確定・メール送信</button>
            <button class="btn-reject" onclick="reject_reservation(${r.id})">❌ お断り</button>
          </div>
        ` : r.status === 'confirmed' ? '✅ 予約確定済み' : '❌ お断り済み'}
      </td>
    </tr>
  `).join('');

  res.send(`<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>管理画面 — ご招待フォーム</title>
<style>
  body { font-family: 'Hiragino Sans', sans-serif; background: #f5f0eb; margin: 0; padding: 20px; }
  h1 { color: #4a3728; border-bottom: 2px solid #c9a96e; padding-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
  th { background: #4a3728; color: white; padding: 12px; text-align: left; }
  td { padding: 12px; border-bottom: 1px solid #eee; vertical-align: top; }
  tr.confirmed { background: #f0faf0; }
  tr.rejected { background: #fff5f5; opacity: 0.6; }
  .action-form { display: flex; flex-direction: column; gap: 6px; }
  .action-form input { padding: 6px; border: 1px solid #ddd; border-radius: 6px; }
  .action-form label { font-size: 12px; color: #666; }
  .btn-confirm { background: #2a7a3b; color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 14px; }
  .btn-reject { background: #c0392b; color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 14px; }
  .btn-confirm:hover { background: #1e5c2c; }
  .btn-reject:hover { background: #922b21; }
  .badge { background: #c9a96e; color: white; border-radius: 12px; padding: 2px 10px; font-size: 12px; }
  .no-data { text-align: center; padding: 40px; color: #999; }
</style>
</head>
<body>
<h1>🍽️ ご招待フォーム — 管理画面</h1>
<p>回答件数: <span class="badge">${responses.length}件</span></p>
${responses.length === 0 ? '<div class="no-data">まだ回答はありません</div>' : `
<table>
  <thead>
    <tr>
      <th>送信日時</th><th>お名前 / メール</th><th>希望日程</th><th>人数</th><th>料理</th><th>アレルギー</th><th>操作</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`}
<script>
async function confirm_reservation(id) {
  const date = document.getElementById('date-' + id).value;
  const time = document.getElementById('time-' + id).value;
  if (!date) { alert('確定日程を選択してください'); return; }
  if (!confirm('予約確定メールをゲストに送信しますか？')) return;
  const res = await fetch('/admin/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, date, time })
  });
  const data = await res.json();
  if (data.ok) { alert('✅ 予約確定メールを送信しました！'); location.reload(); }
  else { alert('エラー: ' + data.error); }
}
async function reject_reservation(id) {
  if (!confirm('お断りメールをゲストに送信しますか？')) return;
  const res = await fetch('/admin/reject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  const data = await res.json();
  if (data.ok) { alert('お断りメールを送信しました'); location.reload(); }
  else { alert('エラー: ' + data.error); }
}
</script>
</body>
</html>`);
});

// 予約確定
app.post('/admin/confirm', async (req, res) => {
  const { id, date, time } = req.body;
  const responses = loadResponses();
  const entry = responses.find(r => r.id === Number(id));
  if (!entry) return res.json({ ok: false, error: '回答が見つかりません' });

  const config = loadConfig();
  const restaurantName = entry.cuisine === '和食' ? config.restaurantNameJapanese : config.restaurantNameFrench;
  const formatted = new Date(date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  await sendMail(config, entry.email, `【ご予約確定】${restaurantName}へのご招待`,
    `${entry.name} 様\n\nこのたびはご都合をお知らせいただきありがとうございました。\n\n以下の日程でご予約が確定いたしました。\n\n━━━━━━━━━━━━━━━\n📅 日程: ${formatted}\n🕐 時間: ${time}\n🍽️  料理: ${entry.cuisine}\n👥 人数: ${entry.groupType}・${entry.count}名\n━━━━━━━━━━━━━━━\n\n${restaurantName}にてお待ちしております。\n何かご不明な点がございましたら、お気軽にお知らせください。\n\n${config.ownerName}`
  );

  entry.status = 'confirmed';
  entry.confirmedDate = date;
  entry.confirmedTime = time;
  saveResponses(responses);
  res.json({ ok: true });
});

// お断り
app.post('/admin/reject', async (req, res) => {
  const { id } = req.body;
  const responses = loadResponses();
  const entry = responses.find(r => r.id === Number(id));
  if (!entry) return res.json({ ok: false, error: '回答が見つかりません' });

  const config = loadConfig();
  const restaurantName = entry.cuisine === '和食' ? config.restaurantNameJapanese : config.restaurantNameFrench;
  await sendMail(config, entry.email, `ご連絡 — ${restaurantName}`,
    `${entry.name} 様\n\nご希望いただいた日程につきまして、誠に申し訳ございませんが、ご希望の日程にご用意できる席がございませんでした。\n\n改めてご都合のよい日程をお知らせいただけますと幸いです。\n\n${config.ownerName}`
  );

  entry.status = 'rejected';
  saveResponses(responses);
  res.json({ ok: true });
});

function loadConfig() {
  const cfg = path.join(__dirname, 'config.json');
  const fileConfig = fs.existsSync(cfg) ? JSON.parse(fs.readFileSync(cfg, 'utf8')) : {};
  return {
    restaurantNameJapanese: process.env.RESTAURANT_NAME_JAPANESE || fileConfig.restaurantNameJapanese,
    restaurantNameFrench: process.env.RESTAURANT_NAME_FRENCH || fileConfig.restaurantNameFrench,
    ownerName: process.env.OWNER_NAME || fileConfig.ownerName,
    gmailUser: process.env.GMAIL_USER || fileConfig.gmailUser,
    gmailAppPassword: process.env.GMAIL_APP_PASSWORD || fileConfig.gmailAppPassword,
    notifyEmail: process.env.NOTIFY_EMAIL || fileConfig.notifyEmail,
    fatherEmail: process.env.FATHER_EMAIL || fileConfig.fatherEmail,
    adminUrl: process.env.ADMIN_URL || fileConfig.adminUrl,
  };
}

async function sendMail(config, to, subject, text) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: config.gmailUser, pass: config.gmailAppPassword }
  });
  await transporter.sendMail({ from: config.gmailUser, to, subject, text });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🍽️  サーバー起動中: http://localhost:${PORT}`);
  console.log(`📋 管理画面: http://localhost:${PORT}/admin\n`);
});
