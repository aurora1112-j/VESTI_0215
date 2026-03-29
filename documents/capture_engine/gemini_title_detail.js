// 检查 conversation-title-container 的内容

const titleContainer = document.querySelector('.conversation-title-container');
console.log('=== 标题容器详情 ===');
console.log('容器存在:', !!titleContainer);
console.log('innerHTML:', titleContainer?.innerHTML);
console.log('textContent:', titleContainer?.textContent);
console.log('子元素数量:', titleContainer?.children.length);

// 检查子元素
if (titleContainer) {
  Array.from(titleContainer.children).forEach((child, i) => {
    console.log(`Child ${i}:`, {
      tag: child.tagName,
      text: child.textContent.slice(0, 80),
      classes: child.className
    });
  });
}
