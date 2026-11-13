import type { Metadata } from "next";
import { Ban, EyeOff, LogIn, ShieldCheck } from "lucide-react";
import {
  Callout,
  DocLink,
  GoogleLoginDemo,
  HeartDemo,
  LawRef,
  LegalDoc,
  LegalTable,
  Mail,
  Refs,
  SITE_NAME,
  Steps,
  ThemeDemo,
  UiDemo,
  Vendor
} from "@/components/legal/legal-doc";

// 개인정보처리방침. 개인정보 보호법 제30조가 정한 기재 사항 순서로 쓴다. 내용은 실제 코드·DB와 맞춘다 —
// 기록 범위를 바꾸면 이 글도 같이 고친다. 근거: 기록은 개발자만(lib/activity/kinds.ts isTrackedRole),
// 보관 기한(db/migrations/0165·0166 cron), 하트(0040·0140), 쿠키(lib/ui/view-cookie.ts), 위치(wrangler placement·Supabase 서울).
export const metadata: Metadata = {
  title: `개인정보처리방침 · ${SITE_NAME}`,
  description: `${SITE_NAME}의 개인정보 처리 목적·항목·보유 기간·위탁·국외 이전·권리 행사 방법`
};

export default function PrivacyPage() {
  return (
    <LegalDoc
      effective="2026. 11. 13."
      facts={[
        { icon: <LogIn size={17} />, title: "회원가입 없음", text: "일정표는 로그인 없이 볼 수 있습니다." },
        { icon: <EyeOff size={17} />, title: "방문 기록 없음", text: "시청자와 방송인의 방문·클릭을 저장하지 않습니다." },
        { icon: <Ban size={17} />, title: "광고·분석 도구 없음", text: "외부 방문자 분석이나 광고 추적 코드를 쓰지 않습니다." },
        { icon: <ShieldCheck size={17} />, title: "판매·제공 없음", text: "개인정보를 팔거나 다른 곳에 넘기지 않습니다." }
      ]}
      kind="privacy"
      sections={[
        {
          id: "purpose",
          title: "처리 목적과 항목",
          body: (
            <>
              <p>
                {SITE_NAME}(victory-broadcast.com, 이하 &lsquo;일정표&rsquo;)는 아래 목적에 필요한 최소한의 정보만
                처리합니다. 일정을 보는 데에는 어떤 개인정보도 필요하지 않습니다.
              </p>
              <LegalTable
                head={["구분", "처리 항목", "목적"]}
                rows={[
                  [
                    "하트·기대돼요 (로그인 없이)",
                    "브라우저가 만든 무작위 기기 번호, 누른 일정, 누른 시각",
                    "한 기기에서 한 번만 누를 수 있게 함"
                  ],
                  [
                    "Google 로그인 (선택)",
                    "Google 계정 이메일, 계정 고유값, Google이 함께 보내는 이름·프로필 사진 주소, 가입·최근 로그인 시각",
                    "로그인, 계정 단위 하트, 관리자 확인"
                  ],
                  ["계정으로 누른 하트", "계정 고유값, 누른 일정, 누른 시각", "같은 계정의 중복 하트 방지"],
                  [
                    "개발자 이용 기록",
                    "개발자 본인의 화면 이동·버튼 누름, 그 시각과 머문 시간, 기기 종류, 되돌릴 수 없게 변환한 이메일",
                    "오류 추적과 고장 수리"
                  ]
                ]}
              />
              <UiDemo
                caption="일정 카드 오른쪽의 하트입니다. 실제 일정표에서 누르면 표 첫 줄의 정보가 저장되고, 다시 누르면 바로 지워집니다. (이 예시는 저장하지 않습니다.)"
                hint="눌러 보세요"
              >
                <HeartDemo />
              </UiDemo>
              <UiDemo
                caption="일정표와 같은 실제 로그인 버튼입니다. 로그인은 이 버튼을 직접 누를 때만 이루어지며, Google 비밀번호·메일·드라이브 파일은 받지 않습니다."
                hint="실제 로그인"
              >
                <GoogleLoginDemo next="/privacy" />
              </UiDemo>
              <p>
                개발자 이용 기록은 사이트를 만들고 관리하는 개발자 본인의 기록입니다. 시청자와 방송인의 방문이나 버튼 누름은
                로그인 여부와 관계없이 기록하지 않습니다.
              </p>
              <Refs>
                <LawRef article="제15조" detail="제1항 제4호(계약 이행)" />
                <LawRef article="제16조" detail="(최소 수집)" />
              </Refs>
            </>
          )
        },
        {
          id: "retention",
          title: "보유 기간과 파기",
          body: (
            <>
              <LegalTable
                head={["항목", "보유 기간"]}
                rows={[
                  ["하트·기대돼요 (기기 번호)", "누른 사람이 취소하거나 해당 일정이 완전히 삭제될 때까지"],
                  ["Google 계정 정보", "삭제 요청이 처리되거나 서비스를 종료할 때까지"],
                  ["계정으로 누른 하트", "취소하거나 해당 일정이 완전히 삭제될 때까지"],
                  ["개발자 이용 기록", "오류 진단 기록 3일, 나머지 400일(약 13개월)"]
                ]}
              />
              <p>
                보유 기간이 지난 정보는 매일 새벽(03:50, 한국 시간) 자동으로 데이터베이스에서 삭제합니다. 전자 파일 형태의
                정보는 복구할 수 없는 방법으로 지우며, 종이 문서로는 개인정보를 보관하지 않습니다.
              </p>
              <Refs>
                <LawRef article="제21조" detail="(파기)" />
              </Refs>
            </>
          )
        },
        {
          id: "cookies",
          title: "쿠키 등 자동 수집 장치",
          body: (
            <>
              <p>
                일정표는 화면 설정을 기억하기 위해 쿠키와 브라우저 저장소를 씁니다. 대부분은 이용하시는 기기에만 남고 서버로
                보내지 않습니다.
              </p>
              <LegalTable
                head={["이름", "용도", "보관 기간"]}
                rows={[
                  [<code key="v">vic_view</code>, "마지막으로 본 달 기억", "브라우저를 닫을 때까지"],
                  [<code key="l">vic_lt</code>, "페이지가 뜨기 전 잠깐 보이는 로딩 화면을 편집실 모양으로 그릴지 일정표 모양으로 그릴지 기억", "30일"],
                  [<code key="s">sb-…-auth-token</code>, "로그인 상태 유지(로그인한 경우만)", "로그아웃할 때까지"],
                  ["화면 설정 (브라우저 저장소)", "글자 크기·글꼴, 밝기, 소리, 배경 효과, 화면 속 친구(빅타민) 기록", "직접 지울 때까지, 서버로 보내지 않음"],
                  [<code key="a">vic:anonId:v1</code>, "하트용 기기 번호(브라우저 저장소)", "직접 지울 때까지"]
                ]}
              />
              <UiDemo
                caption="설정 창(톱니바퀴)과 같은 실제 화면 모드 버튼입니다. 고른 값은 이 기기의 브라우저에만 저장되고 서버로 보내지 않습니다."
                hint="바꿔 보세요"
              >
                <ThemeDemo />
              </UiDemo>
              <Callout title="거부하는 방법">
                <p>
                  브라우저 설정의 &lsquo;쿠키 및 사이트 데이터&rsquo;에서 저장을 막거나 지울 수 있습니다. 막으면 화면
                  설정과 로그인이 유지되지 않지만, 일정은 그대로 볼 수 있습니다.
                </p>
              </Callout>
              <Refs>
                <LawRef article="제30조" detail="제1항(자동 수집 장치)" />
              </Refs>
            </>
          )
        },
        {
          id: "outsourcing",
          title: "처리 위탁",
          body: (
            <>
              <p>사이트 운영을 위해 아래 업체에 처리를 맡깁니다. 각 업체와의 데이터 처리 약정에 보호·비밀유지·삭제 의무가 담겨 있습니다.</p>
              <LegalTable
                head={["수탁자", "맡긴 업무", "약정"]}
                rows={[
                  [
                    <Vendor brand="cloudflare" key="cv">
                      Cloudflare, Inc.
                    </Vendor>,
                    "웹페이지 전달, 보안, 사이트 서버 실행",
                    <DocLink href="https://www.cloudflare.com/cloudflare-customer-dpa/" key="c">
                      데이터 처리 부속약정
                    </DocLink>
                  ],
                  [
                    <Vendor brand="supabase" key="sv">
                      Supabase, Inc.
                    </Vendor>,
                    "데이터베이스 보관, 로그인 처리",
                    <DocLink href="https://supabase.com/legal/dpa" key="s">
                      데이터 처리 부속약정
                    </DocLink>
                  ]
                ]}
              />
              <Refs>
                <LawRef article="제26조" detail="(업무위탁)" />
              </Refs>
            </>
          )
        },
        {
          id: "abroad",
          title: "국외 이전",
          body: (
            <>
              <p>
                두 수탁자는 미국 회사입니다. 데이터베이스는 서울 지역(AWS ap-northeast-2)에 두고, 사이트 서버도 서울 가까이에서
                실행되도록 설정했습니다. 다만 두 회사의 해외 운영·지원 인력과 전 세계 네트워크를 거칠 수 있어, 아래와 같이
                국외 이전으로 안내합니다.
              </p>
              <LegalTable
                head={["항목", "Cloudflare", "Supabase"]}
                rows={[
                  ["이전되는 정보", "접속 정보(IP 주소, 요청 시각·주소, 브라우저 정보)", "1항 표의 계정 정보·하트·개발자 이용 기록"],
                  ["이전 국가", "미국 및 Cloudflare 네트워크가 있는 국가", "미국(데이터 보관 위치는 서울)"],
                  ["시기와 방법", "사이트에 접속할 때마다 암호화 통신(HTTPS)으로", "로그인·하트 등 기능을 쓸 때 암호화 통신으로"],
                  ["받는 자 연락처", "dpo@cloudflare.com", "privacy@supabase.com"],
                  ["목적과 보유 기간", "사이트 전달·보안, 업체 방침에 따름", "데이터 보관·로그인 처리, 2항과 같음"]
                ]}
              />
              <Callout title="거부하는 방법과 그 영향">
                <p>
                  로그인하지 않으면 계정 정보는 이전되지 않습니다. 접속 정보 처리는 사이트를 보여 드리는 데 꼭 필요해서,
                  거부하시면 사이트를 이용하실 수 없습니다.
                </p>
              </Callout>
              <Refs>
                <LawRef article="제28조의8" detail="제1항 제3호 가목" />
                <DocLink brand="supabase" href="https://supabase.com/docs/guides/platform/regions">
                  Supabase 지역 안내
                </DocLink>
                <DocLink brand="cloudflare" href="https://developers.cloudflare.com/workers/configuration/placement/">
                  Cloudflare 서버 위치 설정
                </DocLink>
              </Refs>
            </>
          )
        },
        {
          id: "third-party",
          title: "제3자 제공과 외부 서비스",
          body: (
            <>
              <p>
                개인정보를 다른 곳에 제공하지 않습니다. 법령에 따라 수사기관 등이 정해진 절차로 요구하는 경우만 예외입니다.
              </p>
              <h3>브라우저가 직접 연결하는 곳</h3>
              <ul>
                <li>
                  <Vendor brand="google">
                    <strong>Google</strong>
                  </Vendor>
                  : 로그인 버튼을 누르면 Google 로그인 화면으로 이동합니다. 인증은 Google이 처리하고,
                  일정표는 그 결과만 받습니다.
                </li>
                <li>
                  <Vendor brand="soop">
                    <strong>SOOP</strong>
                  </Vendor>
                  : 방송 미리보기·다시보기 이미지는 브라우저가 SOOP에서 직접 받고, 다시보기 창을 열면 SOOP
                  영상 플레이어를 불러옵니다. 이때 IP 주소와 브라우저 정보가 SOOP에 전달될 수 있습니다.
                </li>
                <li>글꼴과 이 문서의 업체 아이콘은 일정표가 직접 제공하므로, 이것들을 받으려고 외부에 연결하지 않습니다.</li>
              </ul>
              <p>각 서비스가 직접 처리하는 정보는 그 서비스의 방침을 따릅니다.</p>
              <Refs>
                <LawRef article="제17조" detail="(제3자 제공)" />
                <DocLink brand="google" href="https://policies.google.com/privacy">
                  Google 개인정보처리방침
                </DocLink>
                <DocLink brand="soop" href="https://www.sooplive.com/policy/policy2.html">
                  SOOP 개인정보처리방침
                </DocLink>
                <DocLink brand="cloudflare" href="https://www.cloudflare.com/privacypolicy/">
                  Cloudflare 개인정보처리방침
                </DocLink>
                <DocLink brand="supabase" href="https://supabase.com/privacy">
                  Supabase 개인정보처리방침
                </DocLink>
              </Refs>
            </>
          )
        },
        {
          id: "children",
          title: "만 14세 미만 아동",
          body: (
            <>
              <p>
                법은 만 14세 미만 아동의 정보를 <strong>동의를 근거로</strong> 처리할 때 법정대리인의 동의를 받도록 정하고
                있습니다. 일정표는 나이를 묻지 않고, 동의를 근거로 하는 처리도 하지 않습니다. 로그인과 하트는 이용자가 직접
                요청한 기능을 제공하기 위한 처리입니다.
              </p>
              <p>
                아동이 로그인한 사실을 알게 된 법정대리인이 요청하시면, 확인 후 해당 계정과 하트를 지체 없이 삭제합니다.
              </p>
              <Refs>
                <LawRef article="제22조의2" detail="(아동의 개인정보 보호)" />
              </Refs>
            </>
          )
        },
        {
          id: "rights",
          title: "정보주체의 권리와 행사 방법",
          body: (
            <>
              <p>
                언제든 내 정보의 열람, 정정, 삭제, 처리 정지를 요청하실 수 있습니다. <Mail />로 보내 주시거나 이 페이지의
                &lsquo;문의하기&rsquo;를 이용해 주세요(문의 창은 메일 앱을 열어 줄 뿐 사이트에 내용을 저장하지 않습니다). 메일은 로그인에 쓴 계정
                이메일로 보내 주시면 본인 확인이 빠릅니다. 대리인이 요청하시는 경우 위임장을 확인합니다.
              </p>
              <Steps
                items={[
                  { title: "요청 접수", text: "이메일로 원하는 처리를 알려 주세요." },
                  { title: "본인 확인", text: "계정 이메일 등으로 확인합니다." },
                  { title: "처리", text: "열람·정정·삭제·정지를 진행합니다." },
                  { title: "결과 안내", text: "10일 안에 결과나 거절 사유를 알려 드립니다." }
                ]}
              />
              <p>
                화면에 자동 탈퇴 버튼은 없으며, 계정 삭제는 운영자가 직접 처리합니다. 로그인 없이 쓰신 화면 설정은 서버에
                없으니 브라우저에서 바로 지우실 수 있습니다. 지운 정보도 데이터베이스 업체의 복구용 백업에는 정해진 기간 동안
                남았다가 사라질 수 있으며, 백업으로 복구하는 경우에는 복구 직후 그간의 삭제 요청을 다시 적용합니다.
              </p>
              <Refs>
                <LawRef article="제35조" detail="(열람)" />
                <LawRef article="제36조" detail="(정정·삭제)" />
                <LawRef article="제37조" detail="(처리정지)" />
                <LawRef article="제38조" detail="(행사 방법)" />
              </Refs>
            </>
          )
        },
        {
          id: "safety",
          title: "안전성 확보 조치",
          body: (
            <>
              <ul>
                <li>모든 통신을 HTTPS로 암호화합니다.</li>
                <li>편집 화면은 관리자 계정만 들어갈 수 있고, 서버가 요청마다 권한을 다시 확인합니다.</li>
                <li>데이터베이스 접근 열쇠는 서버에만 두고 브라우저에 보내지 않습니다.</li>
                <li>개발자 이용 기록의 이메일은 되돌릴 수 없는 값(해시)으로만 저장합니다.</li>
                <li>보유 기간이 지난 기록은 매일 자동으로 삭제합니다.</li>
              </ul>
              <Refs>
                <LawRef article="제29조" detail="(안전조치의무)" />
              </Refs>
            </>
          )
        },
        {
          id: "officer",
          title: "개인정보 보호책임자",
          body: (
            <>
              <LegalTable
                head={["구분", "내용"]}
                rows={[
                  ["보호책임자", "운영자(사이트 개발·관리 담당)"],
                  ["연락처", <Mail key="m" />],
                  ["담당 업무", "개인정보 처리 총괄, 열람·삭제 등 요청 처리, 고충 처리"]
                ]}
              />
              <Refs>
                <LawRef article="제31조" detail="(보호책임자)" />
              </Refs>
            </>
          )
        },
        {
          id: "remedy",
          title: "권익 침해 구제",
          body: (
            <>
              <p>운영자의 답변이 충분하지 않으면 아래 기관에 분쟁 조정이나 상담을 신청하실 수 있습니다.</p>
              <LegalTable
                head={["기관", "연락처", "누리집"]}
                rows={[
                  ["개인정보분쟁조정위원회", "1833-6972", <DocLink href="https://www.kopico.go.kr" key="k">kopico.go.kr</DocLink>],
                  ["개인정보침해신고센터", "118 (국번 없이)", <DocLink href="https://privacy.kisa.or.kr" key="p">privacy.kisa.or.kr</DocLink>],
                  ["대검찰청 사이버수사과", "1301 (국번 없이)", <DocLink href="https://www.spo.go.kr" key="s">spo.go.kr</DocLink>],
                  ["경찰청 사이버수사국", "182 (국번 없이)", <DocLink href="https://ecrm.police.go.kr" key="e">ecrm.police.go.kr</DocLink>]
                ]}
              />
            </>
          )
        },
        {
          id: "changes",
          title: "처리방침 변경",
          body: (
            <>
              <p>
                내용을 바꿀 때는 변경 내용과 시행일을 시행 7일 전에, 이용자 권리에 중요한 변경은 30일 전에 이 페이지에
                알립니다. 따로 동의가 필요한 변경은 시행 전에 동의를 받습니다.
              </p>
              <LegalTable head={["시행일", "내용"]} rows={[["2026. 11. 13.", "제정"]]} />
            </>
          )
        }
      ]}
      title="개인정보처리방침"
    />
  );
}
