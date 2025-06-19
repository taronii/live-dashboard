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
  setBroadcastBtn.textContent = '設定済み';
  setBroadcastBtn.disabled = true;
});

// チャット一覧表示
const chatList = document.getElementById('chatList');
const activeChat = document.getElementById('activeChat');
socket.on('chat_messages', data => {
  chatList.innerHTML = '';
  data.comments.forEach(c => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${c.authorName}: ${c.text}</span>
                    <div>
                      <button onclick="displayComment('${c.id}')">表示</button>
                      <button onclick="hideComment('${c.id}')">非表示</button>
                    </div>`;
    chatList.appendChild(li);
  });
});

// 表示中コメント管理
let displayedComments = [];
function displayComment(commentId) {
  socket.emit('display_comment', { commentId });
  if (!displayedComments.includes(commentId)) displayedComments.push(commentId);
  renderActiveComments();
}
function hideComment(commentId) {
  socket.emit('hide_comment', { commentId });
  displayedComments = displayedComments.filter(id => id !== commentId);
  renderActiveComments();
}
function renderActiveComments() {
  activeChat.innerHTML = '';
  displayedComments.forEach(id => {
    const li = document.createElement('li');
    li.textContent = id;
    activeChat.appendChild(li);
  });
}

// アンケート設定
const surveyForm = document.getElementById('surveyForm');
const surveyControls = document.getElementById('surveyControls');
const surveyStatus = document.getElementById('surveyStatus');
const addOptionBtn = document.getElementById('addOption');

addOptionBtn.addEventListener('click', () => {
  const newInput = document.createElement('input');
  newInput.type = 'text';
  newInput.className = 'option';
  newInput.placeholder = `選択肢${document.querySelectorAll('.option').length + 1}`;
  surveyForm.querySelector('.options').appendChild(newInput);
});

surveyForm.addEventListener('submit', e => {
  e.preventDefault();
  const question = document.getElementById('question').value;
  const options = Array.from(document.querySelectorAll('.option')).map(o => o.value);
  const chartType = document.getElementById('chartType').value;
  socket.emit('create_survey', { question, options, chartType });
});

socket.on('survey_created', data => {
  surveyControls.innerHTML = '';
  const btnStart = document.createElement('button');
  btnStart.textContent = '開始';
  btnStart.className = 'btn-primary';
  btnStart.onclick = () => {
    socket.emit('start_survey', { surveyId: data.surveyId });
    surveyStatus.textContent = 'アンケート実施中: ' + data.surveyId;
  };
  const btnStop = document.createElement('button');
  btnStop.textContent = '終了';
  btnStop.className = 'btn-secondary';
  btnStop.onclick = () => {
    socket.emit('stop_survey', { surveyId: data.surveyId });
    surveyStatus.textContent = 'アンケート終了';
  };
  surveyControls.append(btnStart, btnStop);
});

// アンケート結果受信
socket.on('survey_results', data => {
  surveyStatus.textContent = '投票状況: ' + JSON.stringify(data.counts);
});
