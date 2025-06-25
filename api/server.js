// api/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
let liveChatId = null;
let nextPageToken = null;
let pollingInterval = 4000;

// キャッシュ: 最新コメント
let chatCache = [];

// アンケート管理
const surveys = {};

// YouTube ライブチャット取得
async function fetchLiveChat() {
  if (!liveChatId) return;
  try {
    const url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${liveChatId}&part=snippet,authorDetails&key=${YOUTUBE_API_KEY}` + (nextPageToken ? `&pageToken=${nextPageToken}` : '');
    const res = await axios.get(url);
    nextPageToken = res.data.nextPageToken;
    res.data.items.forEach(item => {
      const msg = {
        id: item.id,
        authorName: item.authorDetails.displayName,
        authorIcon: item.authorDetails.profileImageUrl,
        text: item.snippet.displayMessage,
        isSuperChat: !!item.snippet.superChatDetails,
        amount: item.snippet.superChatDetails ? item.snippet.superChatDetails.amountDisplayString : null,
        authorChannelId: item.authorDetails.channelId
      };
      chatCache.push(msg);
      if (chatCache.length > 100) chatCache.shift();
    });
    io.emit('chat_messages', { comments: chatCache.slice(-50) });
  } catch (err) {
    console.error('Error fetching liveChat:', err.message);
  }
}

// Socket.IO ハンドラ
io.on('connection', socket => {
  console.log('Client connected:', socket.id);
  // 現在のチャットキャッシュを新規接続へ即時送信
  if (chatCache.length) {
    socket.emit('chat_messages', { comments: chatCache.slice(-50) });
  }

  socket.on('set_broadcast_id', async ({ broadcastId }) => {
    try {
      // YouTube Data API: use videos.list to get activeLiveChatId (API key allowed)
      const info = await axios.get(`https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${broadcastId}&key=${YOUTUBE_API_KEY}`);
      liveChatId = info.data.items[0]?.liveStreamingDetails?.activeLiveChatId;
      console.log('liveChatId =>', liveChatId);
      if (liveChatId) {
        setInterval(fetchLiveChat, pollingInterval);
      } else {
        socket.emit('error_msg', { message: 'ライブチャットIDが取得できませんでした' });
      }
    } catch (err) {
      console.error('Error fetching liveStreamingDetails:', err.message);
      socket.emit('error_msg', { message: 'YouTube API エラー: ' + err.message });
    }
  });

  socket.on('display_comment', ({ commentId }) => {
    const comment = chatCache.find(c => c.id === commentId);
    if (comment) io.emit('display_comment', comment);
  });

  socket.on('hide_comment', ({ commentId }) => {
    io.emit('hide_comment', { commentId });
  });

  socket.on('create_survey', ({ question, options, chartType }) => {
    const id = Date.now().toString();
    surveys[id] = { question, options, chartType, votes: {}, active: false };
    socket.emit('survey_created', { surveyId: id });
  });

  socket.on('start_survey', ({ surveyId }) => {
    if (surveys[surveyId]) surveys[surveyId].active = true;
  });

  socket.on('stop_survey', ({ surveyId }) => {
    if (surveys[surveyId]) surveys[surveyId].active = false;
  });

  socket.on('hide_survey', () => {
    // すべてのアンケートを非アクティブ化
    Object.values(surveys).forEach(s => (s.active = false));
    io.emit('hide_survey');
  });
});

// 投票集計ループ
setInterval(() => {
  Object.entries(surveys).forEach(([id, survey]) => {
    if (!survey.active) return;
    const voteMap = {};
    chatCache.forEach(c => {
      if (survey.options.includes(c.text)) {
        voteMap[c.authorChannelId] = c.text;
      }
    });
    const counts = {};
    survey.options.forEach(opt => counts[opt] = 0);
    Object.values(voteMap).forEach(opt => counts[opt]++);
    io.emit('survey_results', { question: survey.question, counts, chartType: survey.chartType });
  });
}, pollingInterval);

// 静的ファイル配信
app.use(express.static(__dirname + '/../public_html'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
