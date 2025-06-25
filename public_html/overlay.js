const socketBaseUrl = typeof window.API_URL === 'string' ? window.API_URL : 'http://localhost:3000';
const socket = io(socketBaseUrl);
const commentsDiv = document.getElementById('comments');
let displayedComments = [];
const MAX_COMMENTS = 2; // 最大表示コメント数を2個に制限

socket.on('display_comment', data => {
  displayedComments.push(data);
  
  // 最大表示数を超えたら古いものから削除
  while (displayedComments.length > MAX_COMMENTS) {
    displayedComments.shift(); // 配列の先頭（最も古いコメント）を削除
  }
  
  renderComments();
});

socket.on('hide_comment', data => {
  displayedComments = displayedComments.filter(c => c.id !== data.commentId);
  renderComments();
});

let surveyVisible = false;

socket.on('survey_results', data => {
  if (!surveyVisible) return;
  if (!data || !data.counts) return;
  
  // アンケートが表示可能な状態でのみ表示
  if (surveyVisible) {
    // 質問をセット
    document.getElementById('surveyQuestion').textContent = data.question;
    
    // 選択肢と割合を表示
    const optionsElement = document.getElementById('surveyOptions');
    optionsElement.innerHTML = '';
    
    // 合計投票数を計算
    const total = Object.values(data.counts).reduce((sum, count) => sum + count, 0);
    
    // 色リスト
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
    
    // 選択肢ごとに表示
    Object.entries(data.counts).forEach(([option, count], index) => {
      const percent = total > 0 ? Math.round((count / total) * 100) : 0;
      const optionDiv = document.createElement('div');
      optionDiv.className = 'survey-option';
      optionDiv.style.borderLeftColor = colors[index % colors.length];
      
      // アニメーション効果用の背景のグラデーション
      optionDiv.style.background = `linear-gradient(
        to right, 
        rgba(255,255,255,0.15) 0%, 
        rgba(255,255,255,0.15) ${percent}%, 
        rgba(255,255,255,0.05) ${percent}%, 
        rgba(255,255,255,0.05) 100%
      )`;
      
      optionDiv.innerHTML = `
        <div class="option-text">${option}</div>
        <div class="option-percent">${percent}%</div>
      `;
      
      optionsElement.appendChild(optionDiv);
    });
    
    // グラフ更新
    if (surveyChart) surveyChart.destroy();
    const ctx = document.getElementById('surveyChart').getContext('2d');
    surveyChart = new Chart(ctx, {
      type: data.chartType,
      data: {
        labels: Object.keys(data.counts),
        datasets: [{
          data: Object.values(data.counts),
          backgroundColor: colors
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw;
                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                return `${label}: ${value}票 (${percentage}%)`;
              }
            }
          }
        }
      }
    });
    document.getElementById('surveyBox').style.display = 'block';
  }
});

// アンケート開始イベントを追加
socket.on('survey_started', data => {
  surveyVisible = true;
});

socket.on('hide_survey', () => {
  surveyVisible = false;
  document.getElementById('surveyBox').style.display = 'none';
  document.getElementById('surveyQuestion').textContent = '';
  document.getElementById('surveyOptions').innerHTML = '';
  if (surveyChart) {
    surveyChart.destroy();
    surveyChart = null;
  }
});

function renderComments() {
  commentsDiv.innerHTML = displayedComments.map(comment => `
    <div class="comment-box${comment.isSuperChat ? ' superchat' : ''}">
      ${comment.isSuperChat && comment.amount ? `<div class="superchat-amount">${comment.amount}</div>` : ''}
      <img class="user-avatar" src="${comment.authorIcon}" alt="${comment.authorName}">
      <div class="comment-content">
        <div class="user-name">${comment.authorName}</div>
        <div class="comment-text">${comment.text}</div>
      </div>
    </div>
  `).join('');
}

let surveyChart;
// カラフルなテーマカラー配列
const colorPalette = [
  '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', 
  '#FF9F40', '#8AC926', '#1982C4', '#6A4C93', '#FF595E',
  '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93', '#F15BB5'
];

function updateChart(counts, chartType) {
  const ctx = document.getElementById('surveyChart').getContext('2d');
  const labels = Object.keys(counts);
  const data = Object.values(counts);
  
  // カラーパレットから必要な数だけ色を取得
  const colors = labels.map((_, i) => colorPalette[i % colorPalette.length]);
  const hoverColors = colors.map(color => {
    // 選択時はやや明るく
    return color.replace(')', ', 0.8)');
  });
  
  const fontOptions = {
    family: "'Inter Display', 'Neue Machina', sans-serif",
    size: 16,
    weight: 'bold'
  };
  
  if (!surveyChart) {
    surveyChart = new Chart(ctx, {
      type: chartType || 'bar',
      data: { 
        labels, 
        datasets: [{ 
          data,
          backgroundColor: colors,
          hoverBackgroundColor: hoverColors,
          borderWidth: 2,
          borderColor: '#ffffff',
          borderRadius: 6
        }] 
      },
      options: { 
        animation: { duration: 500 },
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              font: fontOptions,
              color: '#ffffff',
              padding: 12,
              boxWidth: 15,
              boxHeight: 15
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: fontOptions,
            bodyFont: fontOptions,
            padding: 12,
            cornerRadius: 8
          }
        },
        scales: {
          y: {
            display: chartType === 'bar',
            grid: {
              color: 'rgba(255, 255, 255, 0.2)'
            },
            ticks: {
              color: '#ffffff',
              font: {
                family: fontOptions.family,
                size: 12
              }
            }
          },
          x: {
            display: chartType === 'bar',
            grid: {
              color: 'rgba(255, 255, 255, 0.2)'
            },
            ticks: {
              color: '#ffffff',
              font: {
                family: fontOptions.family,
                size: 12
              }
            }
          }
        }
      }
    });
  } else {
    surveyChart.data.labels = labels;
    surveyChart.data.datasets[0].data = data;
    surveyChart.data.datasets[0].backgroundColor = colors;
    surveyChart.data.datasets[0].hoverBackgroundColor = hoverColors;
    surveyChart.config.type = chartType || 'bar';
    
    // 表示/非表示を切り替え
    surveyChart.options.scales.y.display = chartType === 'bar';
    surveyChart.options.scales.x.display = chartType === 'bar';
    
    surveyChart.update();
  }
}

document.getElementById('surveyBox').style.display = 'none';
