# ADR-0002: 비공개 일정 본문은 AES-256-GCM으로 저장 암호화한다 (운영자 에스크로우)

Status: Accepted
Date: 2026-06-17 (소급 기록 2026-07-12)
Related: `db/migrations/0045_event_secret_cipher.sql`, `lib/private-layer/secret-crypto.ts`

## Context

비공개(owner_private / work) 일정은 방송 전 유출되면 안 되는 내용이다. RLS는 애플리케이션 경로를 막지만,
**DB 스누핑(백업 유출, Supabase 콘솔 열람, 덤프)** 에는 무력하다.

## Decision

비공개 이벤트는 평문 컬럼(`public_title`/`public_description`)에 중립 플레이스홀더('비공개')만 남기고,
실제 제목·설명·`private_meta`를 AES-256-GCM으로 암호화해 `events.secret_cipher`에 저장한다.
포맷 `v1$<iv>$<tag>$<ct>`(base64). 키는 서버 환경변수 `PRIVATE_DATA_ENC_KEY`(base64 32바이트).

**위협 모델은 DB 스누핑까지다. E2EE가 아니다.** 서버는 런타임에 복호화하므로 서버·운영자는 평문을 볼 수 있다.

## Rationale

E2EE(클라이언트 키)로 가면 다중 기기·역할 공유(작업자가 work 일정을 봐야 함)·검색·서버 렌더가 전부 깨진다.
1인 스트리머 운영 + 신뢰하는 소수 협업자라는 실제 구조에서는 운영자 에스크로우가 비용 대비 옳다.

## Consequences

- **키 분실 = 비공개 본문 영구 복구 불가.** `PRIVATE_DATA_ENC_KEY`는 반드시 별도 백업.
- 배포 순서 주의: 키를 환경에 넣기 **전**에 암호화 쓰기 코드가 배포되면 저장이 실패한다.
- 암호문 컬럼은 인덱스·검색 대상이 아니다(비공개 본문 검색 기능은 없다).

## Revisit Conditions

위협 모델에 "서버 운영자 불신"이 추가되거나, 외부 협업자에게 비공개 열람을 열어야 할 때.

## Validation

암호화/복호화 왕복 단위 테스트, 비공개 이벤트 저장 후 DB에서 평문이 안 보이는지 직접 확인.
