import type { Metadata, Route } from "next";
import Link from "next/link";
import { CalendarClock, Copyright, Gift, LogIn, Play } from "lucide-react";
// 다시보기 예시가 일정표의 실제 칩(.agenda-vod-inline) 스타일을 그대로 쓰도록 — 편집실도 같은 파일을 불러 쓴다.
import "@/components/poster/public-poster.css";
import {
  BrandIcon,
  Callout,
  DocLink,
  HeartDemo,
  LawRef,
  LegalDoc,
  LegalTable,
  Mail,
  Refs,
  SITE_NAME,
  UiDemo
} from "@/components/legal/legal-doc";
import styles from "@/components/legal/legal-doc.module.css";

// 내용이 고정된 문서라 빌드 때 미리 만들어 둔다(2026-11-13 소유자: "이 두 페이지만 로딩이 2배"). 요청마다 서버 렌더·로그인
// 확인을 거치지 않고, <Link> 프리페치가 문서 전체를 미리 받아 누르는 즉시 열린다. 이 페이지에서는 로그인 상태를 읽지 않는다.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: `이용약관 · ${SITE_NAME}`,
  description: `${SITE_NAME} 이용 조건과 운영 원칙`
};

// 다시보기 연결 예시 — 일정표 목록의 실제 다시보기 칩과 같은 마크업·클래스(public-poster.tsx의 agenda-vod-inline).
function ReplayDemo() {
  return (
    <a
      className="agenda-link vod agenda-vod-inline"
      data-act="legal-demo-replay"
      href="https://www.sooplive.com/station/toryvac"
      rel="noopener noreferrer"
      style={{ width: "min(320px, 100%)" }}
      target="_blank"
    >
      <Play aria-hidden="true" size={13} strokeWidth={2.6} />
      <span className="agenda-vod-title">마메마메 보스잡기</span>
      <em className="agenda-vod-dur">13시간 28분</em>
    </a>
  );
}

export default function TermsPage() {
  return (
    <LegalDoc
      effective="2026. 11. 13."
      facts={[
        { icon: <Gift size={17} />, title: "무료", text: "모든 기능을 비용 없이 이용합니다." },
        { icon: <LogIn size={17} />, title: "로그인은 선택", text: "일정은 로그인 없이 볼 수 있습니다." },
        { icon: <CalendarClock size={17} />, title: "일정은 바뀔 수 있음", text: "실제 방송은 방송국 공지를 우선시합니다." },
        { icon: <Copyright size={17} />, title: "무단 전재 금지", text: "링크 공유는 자유, 복제·상업적 이용은 허락이 필요합니다." }
      ]}
      kind="terms"
      sections={[
        {
          id: "purpose",
          title: "목적과 효력",
          body: (
            <>
              <p>
                이 약관은 {SITE_NAME}(victory-broadcast.com, 이하 &lsquo;일정표&rsquo;)의 이용 조건과 운영자·이용자의 권리와
                의무를 정합니다. 일정표를 이용하면 이 약관에 동의한 것으로 봅니다. 약관은 이 페이지에 늘 공개합니다.
              </p>
              <Refs>
                <LawRef article="제3조" detail="(약관의 작성·설명)" law="약관의규제에관한법률" label="약관규제법" />
              </Refs>
            </>
          )
        },
        {
          id: "service",
          title: "제공하는 서비스",
          body: (
            <>
              <LegalTable
                head={["서비스", "내용", "로그인"]}
                rows={[
                  ["방송 일정표", "달력·목록으로 보는 빅토리님의 방송 일정, 일정 검색", "필요 없음"],
                  ["다시보기 연결", "SOOP 다시보기 영상과 장면 정보 연결", "필요 없음"],
                  ["하트·기대돼요", "일정에 대한 반응 남기기", "선택(로그인하면 계정 단위)"],
                  ["화면 설정·빅타민", "글자·밝기·소리·배경, 화면 속 친구", "필요 없음"]
                ]}
              />
              <p>모든 서비스는 무료입니다.</p>
            </>
          )
        },
        {
          id: "account",
          title: "계정",
          body: (
            <p>
              로그인한 계정은 본인이 관리합니다. 다른 사람의 계정으로 로그인해서는 안 되며, 계정이 도용된 것 같으면{" "}
              <Mail />로 알려 주세요. 로그인 정보의 처리는 <Link href={"/privacy" as Route}>개인정보처리방침</Link>을 따릅니다.
            </p>
          )
        },
        {
          id: "accuracy",
          title: "정보의 정확성",
          body: (
            <>
              <p>
                운영자는 일정을 정확하게 올리도록 노력하지만, 일정은 바뀌거나 취소될 수 있고 반영이 늦어질 수 있습니다.
                다시보기 영상과 장면 정보는 SOOP에서 받아 오므로 SOOP 사정에 따라 보이지 않을 수 있습니다.
              </p>
              <UiDemo caption="일정 카드 아래의 다시보기 연결입니다. 영상 자체는 SOOP이 제공하고, 일정표는 연결만 합니다.">
                <ReplayDemo />
              </UiDemo>
              <Callout title="방송 여부의 기준">
                <p>실제 방송 여부와 시간은 SOOP 방송국 공지를 우선시합니다.</p>
              </Callout>
              <Refs>
                <DocLink brand="soop" href="https://www.sooplive.com/station/toryvac">
                  빅토리 SOOP 방송국
                </DocLink>
              </Refs>
            </>
          )
        },
        {
          id: "rights",
          title: "권리의 귀속",
          body: (
            <>
              <LegalTable
                head={["대상", "권리자", "이용 범위"]}
                rows={[
                  ["일정표의 디자인·글·그림", "운영자, 빅토리님", "개인 감상·링크 공유 자유"],
                  [
                    <span className={styles.vendor} key="v">
                      <BrandIcon brand="soop" />
                      방송·다시보기 영상과 이미지
                    </span>,
                    "방송인, SOOP 등 각 권리자",
                    "각 권리자의 정책을 따름"
                  ]
                ]}
              />
              <p>화면이나 내용을 허락 없이 복제해 다른 곳에 게시하거나 상업적으로 이용할 수 없습니다.</p>
              <Refs>
                <LawRef law="저작권법" />
              </Refs>
            </>
          )
        },
        {
          id: "prohibited",
          title: "금지 행위와 이용 제한",
          body: (
            <>
              <LegalTable
                head={["금지 행위", "조치"]}
                rows={[
                  ["자동화 프로그램으로 과도한 요청을 보내 운영을 방해", "접속 제한"],
                  ["비밀번호 화면 우회, 비밀번호 반복 추측", "접속 제한"],
                  ["여러 기기·프로그램으로 하트·기대돼요 수를 부풀림", "해당 반응 삭제, 접속 제한"],
                  ["다른 사람의 계정 사용, 사칭", "계정 이용 제한"],
                  ["보안 장치를 시험하거나 무력화하려는 시도", "접속 제한, 필요 시 관계 기관 신고"]
                ]}
              />
              <UiDemo caption="하트는 한 기기(또는 한 계정)에 일정당 한 번입니다. 같은 기기에서 다시 누르면 취소됩니다." hint="눌러 보세요">
                <HeartDemo />
              </UiDemo>
              <p>
                조치는 사전 안내 없이 할 수 있습니다. 이의가 있으면 <Mail />로 알려 주세요.
              </p>
              <Refs>
                <LawRef article="제48조" detail="(정보통신망 침해행위 금지)" law="정보통신망이용촉진및정보보호등에관한법률" label="정보통신망법" />
              </Refs>
            </>
          )
        },
        {
          id: "changes",
          title: "서비스의 변경과 중단",
          body: (
            <p>
              기능은 개선을 위해 바뀌거나 없어질 수 있고, 점검이나 호스팅 업체 사정으로 일시 중단될 수 있습니다. 중요한
              변경이나 서비스 종료는 가능한 한 미리 일정표에 알립니다. 종료할 때 계정 정보는{" "}
              <Link href={"/privacy" as Route}>개인정보처리방침</Link>에 따라 파기합니다.
            </p>
          )
        },
        {
          id: "liability",
          title: "책임의 제한",
          body: (
            <p>
              일정표는 무료로 제공되므로, 운영자는 고의나 중대한 과실이 없는 한 서비스 이용이나 중단, 일정 정보의 변경으로
              생긴 손해에 책임을 지지 않습니다.
            </p>
          )
        },
        {
          id: "terms-change",
          title: "약관의 변경",
          body: (
            <>
              <p>
                약관을 바꿀 때는 변경 내용과 시행일을 시행 7일 전에 이 페이지에 알립니다. 이용자에게 불리한 변경은 30일 전에
                알립니다.
              </p>
              <LegalTable head={["시행일", "내용"]} rows={[["2026. 11. 13.", "제정"]]} />
            </>
          )
        },
        {
          id: "law",
          title: "준거법과 분쟁 해결",
          body: (
            <>
              <p>
                이 약관은 대한민국 법을 따릅니다. 분쟁이 생기면 먼저 <Mail />로 협의하며, 협의가 되지 않으면 민사소송법에 따른
                관할 법원에서 해결합니다.
              </p>
              <Refs>
                <LawRef law="민사소송법" />
              </Refs>
            </>
          )
        }
      ]}
      title="이용약관"
    />
  );
}
