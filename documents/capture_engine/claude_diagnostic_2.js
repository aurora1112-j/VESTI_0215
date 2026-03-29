// Claude 详细诊断 - 第二轮

// 1. 查找 copy 按钮的父容器
console.log('=== Copy 按钮父容器 ===');
const copyBtns = document.querySelectorAll('[data-testid="action-bar-copy"]');
copyBtns.forEach((btn, i) => {
  let parent = btn.parentElement;
  let level = 0;
  while (parent && level < 5) {
    console.log(`Copy ${i} - Level ${level}:`, {
      tag: parent.tagName,
      testid: parent.getAttribute('data-testid'),
      classes: parent.className.slice(0, 100)
    });
    parent = parent.parentElement;
    level++;
  }
});

// 2. 查找所有可能的消息根节点
console.log('\n=== 查找消息根节点 ===');
const main = document.querySelector('main');
if (main) {
  const children = Array.from(main.children);
  console.log('main 直接子元素数量:', children.length);
  children.forEach((child, i) => {
    if (i < 3) {
      console.log(`Child ${i}:`, {
        tag: child.tagName,
        testid: child.getAttribute('data-testid'),
        childCount: child.children.length
      });
    }
  });
}
