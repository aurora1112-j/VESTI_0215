// 找到激活对话的精确选择器

const activeChat = document.querySelector('[aria-current="page"]');
console.log('=== 激活对话详情 ===');
console.log('标题:', activeChat?.textContent.trim());
console.log('标签:', activeChat?.tagName);
console.log('类名:', activeChat?.className);
console.log('属性:', {
  'aria-current': activeChat?.getAttribute('aria-current'),
  'data-testid': activeChat?.getAttribute('data-testid')
});

// 查找标题文本的具体位置
if (activeChat) {
  console.log('\n=== 标题子元素 ===');
  Array.from(activeChat.children).forEach((child, i) => {
    console.log(`Child ${i}:`, {
      tag: child.tagName,
      text: child.textContent.trim().slice(0, 60),
      classes: child.className.slice(0, 60)
    });
  });
}
