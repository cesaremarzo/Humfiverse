import"./chunk-K4L5T74A.js";function E(l,o={}){let{qrSize:s=280,showCloseButton:y=!0,closeButtonText:p="\xD7",theme:n="light",container:b=document.body,onCancel:u}=o,t=document.createElement("div");t.style.cssText=`
    position: fixed;
    inset: 0;
    background-color: ${n==="dark"?"rgba(0, 0, 0, 0.8)":"rgba(0, 0, 0, 0.5)"};
    backdrop-filter: blur(10px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 300ms ease-out;
  `,o.overlayStyles&&Object.assign(t.style,o.overlayStyles);let r=document.createElement("div");if(r.style.cssText=`
    background: ${n==="dark"?"#1f1f1f":"#ffffff"};
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    max-width: 90vw;
    max-height: 90vh;
    position: relative;
    animation: scaleIn 300ms ease-out;
  `,o.modalStyles&&Object.assign(r.style,o.modalStyles),y){let e=document.createElement("button");e.textContent=p,e.style.cssText=`
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: ${n==="dark"?"#ffffff":"#000000"};
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: background-color 0.2s;
    `,e.addEventListener("mouseenter",()=>{e.style.backgroundColor=n==="dark"?"rgba(255, 255, 255, 0.1)":"rgba(0, 0, 0, 0.1)"}),e.addEventListener("mouseleave",()=>{e.style.backgroundColor="transparent"}),e.addEventListener("click",()=>{f(!0)}),r.appendChild(e)}let i=document.createElement("div");i.style.cssText=`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  `;let m=document.createElement("h3");m.textContent="Scan to Connect",m.style.cssText=`
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: ${n==="dark"?"#ffffff":"#000000"};
    text-align: center;
  `;let c=document.createElement("canvas");c.width=s,c.height=s,c.style.cssText=`
    border: 1px solid ${n==="dark"?"#333333":"#e5e5e5"};
    border-radius: 12px;
  `,C(l,c,s).catch(console.error);let a=document.createElement("button");a.textContent="Copy URI",a.style.cssText=`
    background: ${n==="dark"?"#333333":"#f5f5f5"};
    border: 1px solid ${n==="dark"?"#444444":"#e5e5e5"};
    color: ${n==="dark"?"#ffffff":"#000000"};
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
  `,a.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(l);let e=a.textContent;a.textContent="Copied!",setTimeout(()=>{a.textContent=e},2e3)}catch(e){console.error("Failed to copy URI:",e)}}),i.appendChild(m),i.appendChild(c),i.appendChild(a),r.appendChild(i),t.appendChild(r);let d=document.createElement("style");d.textContent=`
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    @keyframes scaleIn {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    @keyframes scaleOut {
      from { transform: scale(1); opacity: 1; }
      to { transform: scale(0.9); opacity: 0; }
    }
  `,document.head.appendChild(d);let x=e=>{e.key==="Escape"&&f(!0)},h=e=>{e.target===t&&f(!0)};document.addEventListener("keydown",x),t.addEventListener("click",h),b.appendChild(t);function f(e=!1){document.removeEventListener("keydown",x),t.removeEventListener("click",h),e&&u&&u(),t.style.animation="fadeOut 200ms ease-in",r.style.animation="scaleOut 200ms ease-in";let g=()=>{t.parentNode&&t.parentNode.removeChild(t),d.parentNode&&d.parentNode.removeChild(d)};t.addEventListener("animationend",g,{once:!0}),setTimeout(g,250)}function k(){t.style.display="none"}function v(){t.style.display="flex"}return{destroy:()=>f(!1),hide:k,show:v}}async function C(l,o,s){if(!o.getContext("2d"))return;let{toCanvas:p}=await import("./chunk-3NWP5HE6.js");await p(o,l,{width:s,margin:2,color:{dark:"#000000",light:"#ffffff"}})}export{E as createQROverlay};
