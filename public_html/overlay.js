const socketBaseUrl = typeof window.API_URL === 'string' ? window.API_URL : 'http://localhost:3000';
const socket = io(socketBaseUrl);
const commentArea = document.querySelector('.comment-area');
let displayedComments = [];

socket.on('display_comment', data => {
  displayedComments.push(data);
  if (displayedComments.length > 2) displayedComments.shift();
  renderComments();
});

socket.on('hide_comment', data => {
  displayedComments = displayedComments.filter(c => c.id !== data.commentId);
  renderComments();
});

socket.on('survey_results', data => {
  updateChart(data.counts, data.chartType);
});

function renderComments() {
  commentArea.innerHTML = '';
  displayedComments.forEach(c => {
    const div = document.createElement('div');
    div.classList.add('comment-box');
    div.innerHTML = `
      <img src="${c.authorIcon}" class="avatar"/>
      <span class="username">${c.authorName}</span>
      <span class="text">${c.text}</span>
      ${c.isSuperChat ? `<span class="superchat-amount">${c.amount}</span>` : ''}
    `;
    commentArea.appendChild(div);
  });
}

let surveyChart;
function updateChart(counts, chartType) {
  const ctx = document.getElementById('surveyChart').getContext('2d');
  const labels = Object.keys(counts);
  const data = Object.values(counts);
  if (!surveyChart) {
    surveyChart = new Chart(ctx, {
      type: chartType || 'bar',
      data: { labels, datasets: [{ data }] },
      options: { animation: { duration: 500 } }
    });
  } else {
    surveyChart.data.labels = labels;
    surveyChart.data.datasets[0].data = data;
    surveyChart.update();
  }
}
