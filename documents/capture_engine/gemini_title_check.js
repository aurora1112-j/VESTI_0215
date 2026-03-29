// Gemini 标题诊断

console.log('=== Gemini 标题查找 ===');
console.log('1. header h1:', document.querySelector('header h1')?.textContent);
console.log('2. nav h1:', document.querySelector('nav h1')?.textContent);
console.log('3. document.title:', document.title);

// 查找所有 h1
console.log('\n=== 所有 h1 元素 ===');
document.querySelectorAll('h1').forEach((h1, i) => {
  console.log(`h1 ${i}:`, {
    text: h1.textContent.slice(0, 60),
    parent: h1.parentElement?.tagName,
    classes: h1.className
  });
});

// 查找可能的标题容器
console.log('\n=== 可能的标题位置 ===');
const candidates = document.querySelectorAll('[class*="title"], [class*="heading"], [aria-label*="title"]');
candidates.forEach((el, i) => {
  if (i < 5) {
    console.log(`Candidate ${i}:`, {
      tag: el.tagName,
      text: el.textContent.slice(0, 60),
      classes: el.className.slice(0, 60)
    });
  }
});
