// 查找 Gemini 侧边栏对话标题

// 1. 查找侧边栏
console.log('=== 查找侧边栏对话列表 ===');
const sidebar = document.querySelector('mat-sidenav, [class*="sidenav"], [class*="sidebar"]');
console.log('侧边栏存在:', !!sidebar);

// 2. 查找对话列表项
const chatItems = document.querySelectorAll('[class*="conversation"], [class*="chat-item"], mat-list-item');
console.log('对话项数量:', chatItems.length);

// 3. 查找当前激活的对话
const activeChat = document.querySelector('[class*="active"], [class*="selected"], [aria-current="page"]');
console.log('激活对话:', activeChat?.textContent.slice(0, 80));

// 4. 查找所有可能的对话标题
console.log('\n=== 对话标题候选 ===');
chatItems.forEach((item, i) => {
  if (i < 5) {
    console.log(`Item ${i}:`, {
      text: item.textContent.trim().slice(0, 60),
      classes: item.className.slice(0, 60)
    });
  }
});
