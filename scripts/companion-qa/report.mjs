import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PLANNED_NATIVE_CASE_COUNT, NATIVE_FLOATING_TIDY_TITLES } from './catalog.mjs';
export const sha = value => createHash('sha256').update(value).digest('hex');
export function writeNewJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); }
export function evidenceFiles(directory) {
  const result = [];
  const visit = relative => {
    for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })) {
      const child = path.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw Error('Linked evidence is not accepted');
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile()) { const bytes = fs.readFileSync(path.join(directory, child)); result.push({ path: child.replaceAll('\\', '/'), bytes: bytes.length, sha256: sha(bytes) }); }
    }
  };
  visit(''); return result;
}
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export function writeReport(directory, report) {
  writeNewJson(path.join(directory, 'report.json'), report);
  const rows = report.stages.map(stage => `| ${stage.name} | ${stage.status} | ${stage.detail ?? ''} |`).join('\n');
  const plannedCases = report.nativeEntries?.plannedSelectedCases ?? PLANNED_NATIVE_CASE_COUNT;
  const entrySummary = report.nativeEntries ? `성격 선택 실물: ${report.nativeEntries.passedEntries}/27 통과, 미실행${report.nativeEntries.notRunEntries}, 건너뜀${report.nativeEntries.skippedEntries}, 실패${report.nativeEntries.failedEntries}. 전체 선택${report.nativeEntries.selectedCaseCount}/${plannedCases}, 실제 통과${report.nativeEntries.selectedPassedCases}/${plannedCases}. 순수9 ACK 모델과 별도입니다.` : `성격 선택 실물27개와 전체${plannedCases}개: 아직 미실행. 순수9 ACK 통과를 실물 통과로 세지 않습니다.`;
  const tidy = report.nativeEntries?.floatingTidy;
  const tidySummary = tidy ? `부유 집 정리 실물: ${tidy.passed}/${tidy.required} 통과, 미실행${tidy.notRun}, 건너뜀${tidy.skipped}, 실패${tidy.failed}. 두 정확한 제목의 실제 결과이며 순수 목표·경로 계약과 별도입니다.` : `부유 집 정리 실물${NATIVE_FLOATING_TIDY_TITLES.length}개: 아직 미실행. 기존95개 결과를 새97개 검증으로 승격하지 않습니다.`;
  const body = `# 빅타민 일일 검수\n\n${report.createdAtKst} · ${report.status}\n\nSnapshot content SHA: ${report.sourceDigest ?? 'not prepared'}\n\n전체 설정 교차 ${report.universe.normalizedPreferenceCrossProduct.toLocaleString('en-US')}개를 모두 검사한 결과가 아닙니다.\n\n| 단계 | 상태 | 근거 |\n|---|---|---|\n${rows}\n\n${entrySummary}\n\n${tidySummary}\n\n실제 UI: ${report.nativeCoverage.coveredPairs}/${report.nativeCoverage.requiredPairs} pairwise 쌍. 미실행·미관측은 통과로 세지 않습니다. 매일9성격 표본은 full90초이며 plannedMotion과 실제 observedMotion을 구분합니다. OFF/soft/reduced는 별도 선택 회귀 범위이고, 허용된 수면·식사 시간은 끊임없는 성격 재롱으로 주장하지 않습니다.\n\n자동 검출 결과는 후보이며 원본 동영상·실측과 독립 검토가 필요합니다. 원본 자산·운영 DB·실제 로그인/RLS·OBS·인간 미술 승인을 대신하지 않습니다.\n\n보존 정책: 현재 자동 삭제는 없습니다. 이 실행의 소스 사본·.next·동영상·로그·실패 증거가 로컬 .scratch-pw/companion-daily 아래 계속 쌓입니다. 원본 트리와 기존 사용자 자료, node_modules 연결은 삭제하지 않습니다. 용량과 보존 기한을 별도로 관리해야 하며, 성공7일/실패30일 정리는 아직 구현되지 않았습니다. 이 로컬 보고서와 source-freeze.json은 공개 배포·커밋용이 아닙니다.\n`;
  fs.writeFileSync(path.join(directory, 'report.md'), body, { flag: 'wx' });
  fs.writeFileSync(path.join(directory, 'report.html'), `<!doctype html><html lang="ko"><meta charset="utf-8"><title>빅타민 일일 검수</title><style>body{max-width:960px;margin:32px auto;padding:20px;background:#faf5e9;color:#332b24;font:16px/1.6 system-ui}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><main><pre>${escape(body)}</pre></main></html>`, { flag: 'wx' });
}
