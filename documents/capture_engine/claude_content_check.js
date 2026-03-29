// Claude 内容捕获诊断

// 1. 检查消息内容
console.log('=== 检查消息内容 ===');
const groups = document.querySelectorAll('main .group');
console.log('找到 .group 数量:', groups.length);

groups.forEach((g, i) => {
  console.log(`Group ${i}:`, {
    textLength: g.textContent.length,
    text: g.textContent.slice(0, 100),
    hasUserMsg: !!g.querySelector('[data-testid="user-message"]'),
    hasCopy: !!g.querySelector('[data-testid="action-bar-copy"]')
  });
});

// 2. 查找实际内容区域
console.log('\n=== 查找内容区域 ===');
const markdown = document.querySelectorAll('.standard-markdown, .progressive-markdown');
console.log('Markdown 区域数量:', markdown.length);
markdown.forEach((m, i) => {
  console.log(`Markdown ${i}:`, m.textContent.slice(0, 80));
});
