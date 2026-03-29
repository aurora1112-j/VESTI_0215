// 找到正确的消息容器

// 1. 从 markdown 向上找消息根
const markdown = document.querySelector('.standard-markdown, .progressive-markdown');
let current = markdown;
let level = 0;

console.log('=== 从 Markdown 向上查找 ===');
while (current && level < 8) {
  console.log(`Level ${level}:`, {
    tag: current.tagName,
    classes: current.className.slice(0, 60),
    childCount: current.children.length,
    textLength: current.textContent.length
  });
  current = current.parentElement;
  level++;
}

// 2. 查找用户消息
const userMsg = document.querySelector('[data-testid="user-message"]');
console.log('\n=== 用户消息父容器 ===');
current = userMsg;
level = 0;
while (current && level < 6) {
  console.log(`Level ${level}:`, {
    tag: current.tagName,
    classes: current.className.slice(0, 60)
  });
  current = current.parentElement;
  level++;
}
