import type { Metadata, Route } from "next";
import Link from "next/link";
import { CalendarClock, Copyright, Gift, LogIn } from "lucide-react";
import { Callout, DocLink, LegalDoc, Mail, Refs, SITE_NAME } from "@/components/legal/legal-doc";

export const metadata: Metadata = {
  title: `이용약관 · ${SITE_NAME}`,
  description: `${SITE_NAME} 이용 조건과 운영 원칙`
};

export default function TermsPage() {
  return (
    <LegalDoc
      effective="2026. 11. 13."
      facts={[
        { icon: <Gift size={17} />, title: "무료", text: "모든 기능을 비용 없이 이용합니다." },
        { icon: <LogIn size={17} />, title: "로그인은 선택", text: "일정은 로그인 없이 볼 수 있습니다." },
        { icon: <CalendarClock size={17} />, title: "일정은 바뀔 수 있음", text: "실제 방송은 SOOP 방송국 공지가 우선합니다." },
        { icon: <Copyright size={17} />, title: "무단 전재 금지", text: "링크 공유는 자유, 복제·상업적 이용은 허락이 필요합니다." }
      ]}
      kind="terms"
      sections={[
        {
          id: "purpose",
          title: "목적과 효력",
          body: (
            <p>
              이 약관은 {SITE_NAME}(victory-broadcast.com, 이하 &lsquo;일정표&rsquo;)의 이용 조건과 운영자·이용자의 권리와
              의무를 정합니다. 일정표를 이용하면 이 약관에 동의한 것으로 봅니다.
            </p>
          )
        },
        {
          id: "service",
          title: "제공하는 서비스",
          body: (
            <>
              <ul>
                <li>방송인 빅토리님의 방송 일정표(달력·목록)</li>
                <li>SOOP 다시보기 연결과 장면 정보, 일정 검색</li>
                <li>하트·기대돼요 반응, 화면 설정, 화면 속 친구(빅타민)</li>
              </ul>
              <p>모든 기능은 무료입니다. Google 로그인은 하트를 계정 단위로 남기고 싶을 때만 선택해서 씁니다.</p>
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
              <Callout>
                <p>실제 방송 여부와 시간은 SOOP 방송국 공지가 우선합니다.</p>
              </Callout>
            </>
          )
        },
        {
          id: "rights",
          title: "권리의 귀속",
          body: (
            <>
              <ul>
                <li>일정표의 디자인, 글, 그림에 대한 권리는 운영자와 빅토리님에게 있습니다.</li>
                <li>방송·다시보기 영상과 이미지에 대한 권리는 각 권리자(방송인, SOOP 등)에게 있습니다.</li>
                <li>
                  개인적으로 보거나 링크를 공유하는 것은 자유입니다. 화면이나 내용을 허락 없이 복제해 다른 곳에 게시하거나
                  상업적으로 이용할 수 없습니다.
                </li>
              </ul>
              <Refs>
                <DocLink href="https://www.law.go.kr/법령/저작권법">저작권법</DocLink>
              </Refs>
            </>
          )
        },
        {
          id: "prohibited",
          title: "금지 행위",
          body: (
            <ul>
              <li>자동화 프로그램으로 과도한 요청을 보내 운영을 방해하는 행위</li>
              <li>비밀번호 화면을 우회하거나 비밀번호를 반복해서 추측하는 행위</li>
              <li>여러 기기나 프로그램을 써서 하트·기대돼요 수를 부풀리는 행위</li>
              <li>다른 사람의 계정을 쓰거나 다른 사람을 사칭하는 행위</li>
              <li>일정표의 보안 장치를 시험하거나 무력화하려는 행위</li>
            </ul>
          )
        },
        {
          id: "restriction",
          title: "이용 제한",
          body: (
            <p>
              금지 행위가 확인되면 운영자는 사전 안내 없이 접속을 제한하거나 해당 하트·기대돼요를 삭제할 수 있습니다. 이의가
              있으면 <Mail />로 알려 주세요.
            </p>
          )
        },
        {
          id: "changes",
          title: "서비스의 변경과 중단",
          body: (
            <p>
              기능은 개선을 위해 바뀌거나 없어질 수 있고, 점검이나 호스팅 업체 사정으로 일시 중단될 수 있습니다. 중요한
              변경이나 서비스 종료는 가능한 한 미리 일정표에 알립니다. 종료할 때 계정 정보는 개인정보처리방침에 따라
              파기합니다.
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
            <p>
              약관을 바꿀 때는 변경 내용과 시행일을 시행 7일 전에 이 페이지에 알립니다. 이용자에게 불리한 변경은 30일 전에
              알립니다.
            </p>
          )
        },
        {
          id: "law",
          title: "준거법과 분쟁 해결",
          body: (
            <p>
              이 약관은 대한민국 법을 따릅니다. 분쟁이 생기면 먼저 <Mail />로 협의하며, 협의가 되지 않으면 민사소송법에 따른
              관할 법원에서 해결합니다.
            </p>
          )
        }
      ]}
      title="이용약관"
    />
  );
}
