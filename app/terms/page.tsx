import type { Metadata, Route } from "next";
import Link from "next/link";
import { LegalDoc, Mail, SITE_NAME } from "@/components/legal/legal-doc";

export const metadata: Metadata = {
  title: `이용약관 · ${SITE_NAME}`,
  description: "일정표를 이용할 때 지켜 주실 것과 운영 원칙을 안내합니다."
};

const EFFECTIVE = "시행일: 2026년 11월 13일";

export default function TermsPage() {
  return (
    <LegalDoc
      effective={EFFECTIVE}
      kind="terms"
      lead="일정표를 이용할 때 지켜 주실 것과 운영 원칙을 안내합니다."
      sections={[
        {
          id: "service",
          title: "서비스 소개",
          body: (
            <>
              <p>
                {SITE_NAME}(victory-broadcast.com)는 방송인 빅토리님의 방송 일정과 다시보기 정보를 모아 보여 주는 무료
                서비스입니다. 일정표는 로그인 없이 볼 수 있고, Google 로그인은 하트를 계정 단위로 남기고 싶을 때만
                선택해서 씁니다.
              </p>
              <p>이 사이트를 이용하면 이 약관에 동의한 것으로 봅니다.</p>
            </>
          )
        },
        {
          id: "accuracy",
          title: "일정 정보",
          body: (
            <>
              <p>
                일정은 바뀌거나 취소될 수 있고, 반영이 늦을 수 있습니다. 실제 방송 여부와 시간은 SOOP 방송국 공지가
                우선합니다. 다시보기 영상과 장면 정보는 SOOP에서 받아 오며, SOOP 사정에 따라 보이지 않을 수 있습니다.
              </p>
            </>
          )
        },
        {
          id: "rights",
          title: "권리",
          body: (
            <>
              <ul>
                <li>사이트의 디자인, 글, 그림은 운영자와 빅토리님에게 권리가 있습니다.</li>
                <li>방송·다시보기 영상과 이미지의 권리는 각 권리자(방송인, SOOP 등)에게 있습니다.</li>
                <li>
                  개인적으로 보거나 링크를 공유하는 것은 자유입니다. 화면이나 내용을 허락 없이 복제해 다른 곳에 올리거나
                  상업적으로 쓰지 말아 주세요.
                </li>
              </ul>
            </>
          )
        },
        {
          id: "rules",
          title: "하지 말아 주세요",
          body: (
            <>
              <ul>
                <li>자동화 프로그램으로 사이트에 과도한 요청을 보내 운영을 방해하는 일</li>
                <li>비밀번호 화면을 우회하거나 비밀번호를 반복해 추측하는 일</li>
                <li>여러 기기나 프로그램으로 하트·기대돼요 수를 부풀리는 일</li>
                <li>다른 사람의 계정으로 로그인하는 일</li>
              </ul>
              <p>이런 일이 확인되면 접속을 막거나 해당 하트를 지울 수 있습니다.</p>
            </>
          )
        },
        {
          id: "changes",
          title: "서비스 변경과 중단",
          body: (
            <>
              <p>
                기능은 더 나은 방향으로 바뀌거나 없어질 수 있고, 점검이나 호스팅 업체 사정으로 잠시 멈출 수 있습니다.
                중요한 변경이나 서비스 종료는 가능한 한 미리 사이트에 알립니다. 서비스를 끝낼 때 계정 정보 처리는{" "}
                <Link href={"/privacy" as Route}>개인정보처리방침</Link>을 따릅니다.
              </p>
              <p>
                무료 서비스이므로 운영자는 고의나 중대한 과실이 없는 한 서비스 이용이나 중단으로 생긴 손해에 책임을 지지
                않습니다.
              </p>
            </>
          )
        },
        {
          id: "misc",
          title: "약관 변경과 문의",
          body: (
            <>
              <p>
                약관을 바꿀 때는 바뀌는 내용과 시행일을 시행 7일 전에 이 페이지에 알립니다. 이 약관은 대한민국 법을
                따릅니다.
              </p>
              <p>
                문의: <Mail />
              </p>
            </>
          )
        }
      ]}
      title="이용약관"
    />
  );
}
