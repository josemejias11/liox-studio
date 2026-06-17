const rects = Array.from(document.querySelectorAll('*')).map(el => {
  const r = el.getBoundingClientRect();
  return { tag: el.tagName, class: el.className, w: r.width, h: r.height };
});
console.log(JSON.stringify(rects.filter(r => r.h > 100 && r.w > 100).slice(0, 50), null, 2));
