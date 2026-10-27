import {expect,it} from 'vitest';
import type {BroadcastTag} from '@/lib/domain/schedule-types';
import {contentColorTagIds,swapContentColorOrder} from '@/lib/tags/swap-content-colors';
const tag=(id:string,kind:BroadcastTag['kind']='content',colorKey=id):BroadcastTag=>({id,tagKey:id,displayName:id,colorKey,kind,parentId:null,sortOrder:0,isActive:true,isDefault:false});
const tags=[tag('a'),tag('b'),tag('c'),tag('m','modifier'),tag('n','modifier'),tag('d'),{...tag('child'),parentId:'a'},tag('same','content','a')];
it('preserves the third and later slots, count and input for six selected tags',()=>{
 const original=['m','a','n','b','c','d'];
 expect(swapContentColorOrder(original,tags)).toEqual(['m','b','n','a','c','d']);
 expect(original).toEqual(['m','a','n','b','c','d']);
 expect(swapContentColorOrder(swapContentColorOrder(original,tags)!,tags)).toEqual(original);
});
it('ignores modifier/unknown IDs and parent-inherited duplicate colors',()=>{
 expect(swapContentColorOrder(['a','child','m','b','c'],tags)).toEqual(['b','child','m','a','c']);
 expect(swapContentColorOrder(['missing','a','same','m','b'],tags)).toEqual(['missing','b','same','m','a']);
 const original=['a','child','m','b','c'],pair=contentColorTagIds(original,tags),swapped=swapContentColorOrder(original,tags,pair)!;
 expect(swapContentColorOrder(swapped,tags,pair)).toEqual(original);
 expect(contentColorTagIds(['m','b','n','a','c'],tags)).toEqual(['b','a']);
});
it('has no action unless there are two distinct content colors',()=>{
 for(const ids of [[],['a'],['m','n'],['a','same','child','m']])expect(swapContentColorOrder(ids,tags)).toBeNull();
});
