// 查找 Gemini 真实标题

// 1. 检查 URL 中是否有标题信息
console.log('URL:', window.location.href);

// 2. 查找所有可能包含标题的元素
console.log('\n=== 查找标题文本 ===');
const allText = document.querySelectorAll('div, span, p');
const titleCandidates = [];

allText.forEach(el => {
  const text = el.textContent.trim();
  // 标题通常是 10-100 字符
  if (text.length > 10 && text.length < 100 &&
      !text.includes('\n') &&
      el.children.length === 0) {
    titleCandidates.push({
      text: text.slice(0, 60),
      tag: el.tagName,
      classes: el.className.slice(0, 60)
    });
  }
});

console.log('候选标题（前10个）:');
titleCandidates.slice(0, 10).forEach((c, i) => {
  console.log(`${i}:`, c);
});
