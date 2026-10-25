import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
import {MemberInsights} from '@/components/studio/member-insights';

vi.mock('@/lib/insights/actions',()=>({getMemberInsightsAction:vi.fn(),getOwnerSecurityAction:vi.fn()}));

it('keeps the non-security member surface to its three public-scope tabs without an empty security slot',async()=>{
 vi.stubGlobal('React',await import('react'));
 try{
  const output=renderToStaticMarkup(createElement(MemberInsights,{year:2026,month:6,canSecurity:false}));
  expect(output.match(/role="tab"/g)).toHaveLength(3);
  expect(output).toContain('트렌드');expect(output).toContain('일정');expect(output).toContain('참여');
  expect(output).not.toContain('보안');expect(output).not.toContain('하이라이트');expect(output).not.toContain('insights-tab-wide');
  expect(output.match(/class="insights-tab-row"/g)).toHaveLength(1);
 }finally{vi.unstubAllGlobals();}
});
