const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:630}});
await p.goto('file://'+require('path').resolve(__dirname,'..')+'/index.html');await p.waitForTimeout(3000);
await p.addStyleTag({content:'#menu,#title-foot,#ver,#snd,.sndb{display:none!important}'});
await p.waitForTimeout(800);await p.screenshot({path:''+require('path').resolve(__dirname,'..')+'/og.png'});await b.close();})();
