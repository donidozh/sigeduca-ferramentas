const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'gpe/arquivo-digital-servidores.user.js'),'utf8');
function fixture(pathname,frame=false){
 const registrations=[],listeners={},dom=[];
 const window={addEventListener:(event,fn)=>listeners[event]=fn,dispatchEvent:event=>registrations.push(event.detail)};window.self=window;window.top=frame?{}:window;
 const context={window,location:{pathname,hash:''},document:{readyState:'loading',addEventListener:(event,fn)=>dom.push([event,fn])},setTimeout(){},CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}}};
 vm.runInNewContext(source,context);return {registrations,listeners,dom,context};
}
test('GPE registra instalação própria em GRH e transforma apenas cadastro de servidores',()=>{
 const base=fixture('/grh/hwmgrhservidor.aspx');assert.equal(base.registrations[0].titulo,'Arquivo Digital - GPE');assert.equal(base.dom[0][0],'DOMContentLoaded');
 const other=fixture('/grh/outra.aspx');assert.equal(other.registrations.length,1);assert.equal(other.dom.length,0);
 assert.equal(base.registrations[0].url,'hwmgrhservidor.aspx#arquivo-digital-gpe');assert.ok(base.registrations[0].installUrl.endsWith('/gpe/arquivo-digital-servidores.user.js'));
});
test('GED, GPO, iframes e carregamento duplicado não criam outra interface GPE',()=>{
 for(const path of ['/ged/hwmconaluno.aspx','/gpo/inicio.aspx'])assert.equal(fixture(path).registrations.length,0);
 assert.equal(fixture('/grh/hwmgrhservidor.aspx',true).registrations.length,0);
 const f=fixture('/grh/hwmgrhservidor.aspx');vm.runInNewContext(source,f.context);assert.equal(f.registrations.length,1);assert.equal(f.dom.length,1);
});
