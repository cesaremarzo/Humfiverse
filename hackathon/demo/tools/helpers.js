window.hv = {
  vis: (e) => e && e.offsetParent !== null,
  field: (label) => [...document.querySelectorAll('input,textarea,select')].find((e) => hv.vis(e) && ((e.labels?.[0]?.textContent || '') + ' ' + (e.closest('label')?.textContent || '') + ' ' + (e.getAttribute('aria-label') || '') + ' ' + (e.placeholder || '')).includes(label)),
  set: (label, v) => { const e = hv.field(label); if (!e) return 'no field ' + label; const proto = e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : e.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; },
  btn: (text) => { const e = [...document.querySelectorAll('button,a,[role=button],label')].filter(hv.vis).find((x) => x.textContent.trim().replace(/\s+/g, ' ') === text) || [...document.querySelectorAll('button,a,[role=button],label')].filter(hv.vis).find((x) => x.textContent.trim().replace(/\s+/g, ' ').startsWith(text)); if (!e) return 'no button ' + text; e.click(); return 'clicked ' + e.textContent.trim().slice(0, 40); },
  text: () => document.querySelector('main')?.innerText || document.body.innerText,
};
'helpers loaded';
