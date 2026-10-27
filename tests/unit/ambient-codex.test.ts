// Former ecology catalogue retired by Owner2026-10-27; original evidence remains.
import {expect,it} from 'vitest';
import {ART_SLOTS,ART_FAMILIES,artSlot,batchPrompt,codexMasterPrompt,pilotPrompt,slotFiles} from '@/components/shared/ambient/art/manifest';
import {CODEX} from '@/components/shared/ambient/world/codex';
import skyBefore from '../fixtures/ambient-sky-catalog-v1.json';
it('preserves every accepted sky/celestial slot and removes ecology generation catalogues',()=>{
  expect(ART_SLOTS).toEqual(skyBefore);expect(ART_SLOTS).toHaveLength(9);
  expect(CODEX).toEqual([]);expect(ART_FAMILIES).toEqual({});
  for(const id of ['tree-pine','tree-oak-spring','flower-spring','fish-palechub','bug-firefly','animal-hare'])expect(artSlot(id)).toBeUndefined();
  for(const slot of ART_SLOTS){expect(slot.category).toBe('sky');expect(slotFiles(slot).length).toBe(slot.variants??1);}
});
it('rejects fresh ecology prompts while preserving sky and partial-file copy flows',()=>{
  expect(()=>codexMasterPrompt(2)).toThrow(/retired/);
  expect(()=>batchPrompt([{...ART_SLOTS[0],id:'tree-pine',category:'tree'}],'retired')).toThrow(/retired/);
  const sun=ART_SLOTS[0],one=slotFiles(sun)[0];const prompt=batchPrompt([sun],'one',{files:[one]});
  expect(prompt).toContain(one);expect(prompt).not.toContain(slotFiles(sun)[1]);
  expect(codexMasterPrompt()).toContain('moon-phase');expect(pilotPrompt()).toContain('cloud-wisp');
  expect(pilotPrompt()).not.toMatch(/tree-pine|먼저 소나무/);
});
