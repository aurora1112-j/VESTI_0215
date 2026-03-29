// 方法2：查找包含标题文本的元素

const titleText = 'AI 助手介绍与能力展示';
const allElements = document.querySelectorAll('*');

console.log('=== 查找包含标题的元素 ===');
let found = 0;
allElements.forEach(el => {
  if (el.textContent.trim() === titleText && found < 3) {
    console.log(`匹配 ${found}:`, {
      tag: el.tagName,
      classes: el.className.slice(0, 80),
      parent: el.parentElement?.tagName,
      parentClasses: el.parentElement?.className.slice(0, 60)
    });
    found++;
  }
});
