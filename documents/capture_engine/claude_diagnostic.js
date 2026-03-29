// 在 Claude 页面运行此诊断脚本

// 1. 查找所有可能的消息容器
console.log('=== 查找消息容器 ===');
const articles = document.querySelectorAll('main article');
console.log('article 数量:', articles.length);

// 2. 检查每个 article 的属性
articles.forEach((art, i) => {
  console.log(`Article ${i}:`, {
    testid: art.getAttribute('data-testid'),
    author: art.getAttribute('data-author'),
    role: art.getAttribute('data-message-author-role'),
    classes: art.className
  });
});

// 3. 查找 copy 按钮（AI 消息标志）
const copyBtns = document.querySelectorAll('[data-testid="action-bar-copy"]');
console.log('Copy 按钮数量:', copyBtns.length);

// 4. 查找所有包含文本的 div
const allDivs = document.querySelectorAll('main div[class*="font"]');
console.log('Font div 数量:', allDivs.length);
