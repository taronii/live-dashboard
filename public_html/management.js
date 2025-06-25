// public_html/management.js
const socketBaseUrl = typeof window.API_URL === 'string' ? window.API_URL : 'http://localhost:3000';
const socket = io(socketBaseUrl);

// 配信ID設定
const broadcastInput = document.getElementById('broadcastId');
const setBroadcastBtn = document.getElementById('setBroadcast');
setBroadcastBtn.addEventListener('click', () => {
  const id = broadcastInput.value.trim();
  if (!id) return alert('配信IDを入力してください');
  socket.emit('set_broadcast_id', { broadcastId: id });
  broadcastInput.disabled = true;
  setBroadcastBtn.textContent = '✅ 接続中';
  setBroadcastBtn.disabled = true;
  setBroadcastBtn.style.background = '#4caf50';
});

// チャット一覧表示
const chatList = document.getElementById('chatList');
const activeChat = document.getElementById('activeChat');
let allComments = [];

socket.on('chat_messages', data => {
  allComments = data.comments;
  renderChatList();
});

function renderChatList() {
  console.log('Rendering chat list, total comments:', allComments.length);
  chatList.innerHTML = '';
  
  if (allComments.length === 0) {
    chatList.innerHTML = '<div style="padding: 2rem; text-align: center; color: #666;">コメントを待機中...</div>';
    return;
  }
  
  // 最新のコメントを上に表示（最大50件）
  const recentComments = allComments.slice(-50).reverse();
  console.log('Displaying recent comments:', recentComments.length);
  
  recentComments.forEach(comment => {
    const div = document.createElement('div');
    div.className = `comment-item${comment.isSuperChat ? ' superchat' : ''}`;
    div.innerHTML = `
      <div class="comment-author">${comment.authorName}${comment.isSuperChat ? ' 💎' : ''}</div>
      <div class="comment-text">${comment.text}</div>
      <div class="comment-actions">
        <button onclick="displayComment('${comment.id}')" class="btn-primary">🔥 表示</button>
      </div>
    `;
    chatList.appendChild(div);
  });
}

// 表示中コメント管理
let displayedComments = [];
let currentSurveyId = null;
function displayComment(commentId) {
  const comment = allComments.find(c => c.id === commentId);
  if (!comment) return;
  
  socket.emit('display_comment', { commentId });
  if (!displayedComments.find(c => c.id === commentId)) {
    displayedComments.push(comment);
  }
  renderActiveComments();
}

function hideComment(commentId) {
  socket.emit('hide_comment', { commentId });
  displayedComments = displayedComments.filter(c => c.id !== commentId);
  renderActiveComments();
}

function renderActiveComments() {
  activeChat.innerHTML = '';
  displayedComments.forEach(comment => {
    const div = document.createElement('div');
    div.className = 'active-comment-item';
    div.innerHTML = `
      <div class="active-comment-content">
        <div class="comment-author">${comment.authorName}${comment.isSuperChat ? ' 💎' : ''}</div>
        <div class="comment-text">${comment.text}</div>
      </div>
      <button onclick="hideComment('${comment.id}')" class="btn-danger hide-btn">❌ 非表示</button>
    `;
    activeChat.appendChild(div);
  });
}

// アンケート設定
const surveyForm = document.getElementById('surveyForm');
const surveyControls = document.getElementById('surveyControls');
const surveyStatus = document.getElementById('surveyStatus');
const addOptionBtn = document.getElementById('addOption');
const hideSurveyBtn = document.getElementById('hideSurvey');

// アンケート非表示機能
hideSurveyBtn.addEventListener('click', () => {
  currentSurveyId = null;
  socket.emit('hide_survey');
  surveyStatus.textContent = '📊 アンケートを非表示にしました';
  hideSurveyBtn.disabled = true;
  setTimeout(() => {
    hideSurveyBtn.disabled = false;
  }, 2000);
});

addOptionBtn.addEventListener('click', () => {
  const newInput = document.createElement('input');
  newInput.type = 'text';
  newInput.className = 'option-input';
  newInput.placeholder = `選択肢${document.querySelectorAll('.option-input').length + 1}`;
  document.getElementById('optionsContainer').appendChild(newInput);
});

surveyForm.addEventListener('submit', e => {
  e.preventDefault();
  const question = document.getElementById('question').value;
  const options = Array.from(document.querySelectorAll('.option-input')).map(o => o.value).filter(v => v.trim());
  const chartType = document.getElementById('chartType').value;
  
  if (options.length < 2) {
    alert('選択肢を2つ以上入力してください');
    return;
  }
  
  socket.emit('create_survey', { question, options, chartType });
  surveyStatus.textContent = '📊 アンケートを作成中...';
});

socket.on('survey_created', data => {
  currentSurveyId = data.surveyId;
  surveyControls.innerHTML = '';
  const btnStart = document.createElement('button');
  btnStart.textContent = '🚀 アンケート開始';
  btnStart.className = 'btn-primary';
  btnStart.onclick = () => {
    socket.emit('start_survey', { surveyId: data.surveyId });
    surveyStatus.textContent = '🔥 アンケート実施中: ' + data.question;
    btnStart.disabled = true;
    btnStart.textContent = '実施中...';
  };
  
  const btnStop = document.createElement('button');
  btnStop.textContent = '⏹️ 終了';
  btnStop.className = 'btn-secondary';
  btnStop.onclick = () => {
    socket.emit('stop_survey', { surveyId: data.surveyId });
    surveyStatus.textContent = '✅ アンケート終了';
    btnStart.disabled = false;
    btnStart.textContent = '🚀 アンケート開始';
  };
  
  const btnDelete = document.createElement('button');
  btnDelete.textContent = '🗑️ 削除';
  btnDelete.className = 'btn-danger';
  btnDelete.onclick = () => {
    if (confirm('本当にこのアンケートを削除しますか？')) {
      socket.emit('delete_survey', { surveyId: data.surveyId });
      surveyControls.innerHTML = '';
      surveyStatus.textContent = '🗑️ アンケート削除';
      currentSurveyId = null;
    }
  };
  
  surveyControls.append(btnStart, btnStop, btnDelete);
  surveyStatus.textContent = '✅ アンケート作成完了: ' + data.question;
});

// アンケート結果受信
socket.on('survey_results', data => {
  const total = Object.values(data.counts).reduce((a, b) => a + b, 0);
  surveyStatus.innerHTML = `
    <div><strong>📊 投票状況 (総投票数: ${total})</strong></div>
    <div>${Object.entries(data.counts).map(([option, count]) => 
      `${option}: ${count}票 (${total > 0 ? Math.round(count/total*100) : 0}%)`
    ).join(' | ')}</div>
  `;
});
