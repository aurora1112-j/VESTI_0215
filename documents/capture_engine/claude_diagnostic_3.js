// 第三轮诊断 - 找到消息的完整结构

// 从 copy 按钮向上找到消息根节点
const copyBtn = document.querySelector('[data-testid="action-bar-copy"]');
let current = copyBtn;
let level = 0;

console.log('=== 向上查找消息根 ===');
while (current && level < 10) {
  const hasUserMsg = current.querySelector('[data-testid="user-message"]');
  const hasContent = current.textContent.length > 50;

  console.log(`Level ${level}:`, {
    tag: current.tagName,
    hasUserMsg: !!hasUserMsg,
    textLength: current.textContent.length,
    childCount: current.children.length,
    classes: current.className.slice(0, 80)
  });

  current = current.parentElement;
  level++;
}
