import fs from 'node:fs';import path from 'node:path';
const lock=JSON.parse(fs.readFileSync('package-lock.json'));const rows=[];
for(const [loc,value] of Object.entries(lock.packages)){
 if(!loc)continue;let pkg={};try{pkg=JSON.parse(fs.readFileSync(path.join(loc,'package.json')))}catch{}
 rows.push({name:pkg.name??loc.split('node_modules/').at(-1),version:value.version,license:pkg.license??value.license??'SEE PACKAGE LICENSE',development:!!value.dev});
}
fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/dependency-licenses.json',JSON.stringify(rows,null,2));
fs.writeFileSync('THIRD-PARTY-NOTICES.md','# 第三方依赖与素材许可\n\n原创应用代码采用 MIT。胖雀、手绘数字和纸纹由本项目通过 OpenAI ImageGen 制作；素材及提示词见 [设计素材](design/ASSETS.md)。\n\n中文字体使用未修改的 LXGW WenKai Lite Regular，随应用分发；采用 SIL Open Font License 1.1，见 [字体来源](assets/fonts/SOURCE.md) 和 [完整许可](assets/fonts/LXGWWenKaiLite-OFL.txt)。界面操作图标来自 Phosphor Icons（MIT）。\n\nElectron 使用 MIT。构建时从锁定的 Electron 依赖复制 Chromium / Node 许可至 assets/legal，随应用打包。运行时不联网加载字体或设计素材。\n\n| 依赖 | 版本 | 许可 | 用途 |\n|---|---|---|---|\n'+rows.filter(x=>!x.development).map(x=>`| ${x.name} | ${x.version} | ${typeof x.license==='string'?x.license:JSON.stringify(x.license)} | 运行时 |`).join('\n')+'\n\n运行 `npm run licenses` 可重建许可清单。\n');
