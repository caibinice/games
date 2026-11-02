import {describe,it,expect} from 'vitest';
import {esc,marquee,shopScreen,characterScreen,coreScreen,battleScreen,navigation} from '../public/screens.mjs';
import {createMeta} from '../public/progression.mjs';
import {defaultProfile} from '../public/profile.mjs';
describe('mobile entry compatibility',()=>{
 it('escapes all text in one pass without replaceAll',()=>{const old=String.prototype.replaceAll;let actual;try{String.prototype.replaceAll=undefined;actual=esc(`&<>"' 中文`);}finally{String.prototype.replaceAll=old;}expect(actual).toBe('&amp;&lt;&gt;&quot;&#39; 中文');});
 it('renders every menu without Array.at / String.at / replaceAll',()=>{const at=Array.prototype.at,str=String.prototype.at,replace=String.prototype.replaceAll;let pages;try{Array.prototype.at=undefined;String.prototype.at=undefined;String.prototype.replaceAll=undefined;const p=createMeta(9),s={shopTab:0,inventoryTab:0,filterSlot:'',editDisabled:false,mode:'normal'};pages=[shopScreen(p,s),characterScreen(p,s),coreScreen(p,s),battleScreen(p,defaultProfile(),s),navigation('battle')];}finally{Array.prototype.at=at;String.prototype.at=str;String.prototype.replaceAll=replace;}expect(pages.every(s=>typeof s==='string'&&s.length>100)).toBe(true);});
 it('uses last announcement or the default when history is empty / absent',()=>{expect(marquee({history:['first','last']})).toContain('last');expect(marquee({history:[]})).toContain('免费畅玩版');expect(marquee({})).toContain('免费畅玩版');});
 it('keeps nickname and announcements escaped after compatibility changes',()=>{const p=createMeta();p.name='<img src=x onerror=1>';p.history=['<script>alert(1)</script>'];const html=battleScreen(p,defaultProfile(),{mode:'normal'});expect(html).not.toContain('<script>');expect(html).not.toContain('<img src=x');expect(html).toContain('&lt;script&gt;');expect(html).toContain('&lt;img src=x');});
});
