import { Link } from 'react-router'

import { Article, Item, Items, LegalLayout } from '@/pages/legal/LegalLayout'
import { LEGAL_EFFECTIVE_DATE, OPERATOR, SERVICE_NAME } from '@/legal/operator'

export function TermsPage() {
  return (
    <LegalLayout title="이용약관">
      <Article title="제1조 (목적)">
        <p>
          이 약관은 {SERVICE_NAME}(이하 &lsquo;서비스&rsquo;)의 운영자(이하 &lsquo;운영자&rsquo;)가 제공하는 학원 관리
          서비스의 이용 조건과 절차, 운영자와 회원의 권리·의무 및 책임 사항을 정하는 것을 목적으로 합니다.
        </p>
      </Article>

      <Article title="제2조 (용어의 정의)">
        <Items>
          <Item n={1}>&lsquo;회원&rsquo;이란 이 약관에 동의하고 회원가입을 마친 사람을 말합니다.</Item>
          <Item n={2}>
            &lsquo;원장&rsquo;은 학원을 등록해 운영자의 승인을 받은 회원, &lsquo;강사&rsquo;·&lsquo;학부모&rsquo;·&lsquo;학생&rsquo;은
            학원 코드로 가입을 신청해 해당 학원 원장의 승인을 받은 회원을 말합니다.
          </Item>
          <Item n={3}>&lsquo;학원 코드&rsquo;란 학원 가입 신청에 쓰는 6자리 코드를 말합니다.</Item>
          <Item n={4}>
            &lsquo;학생 정보&rsquo;란 원장이 학원 운영을 위해 서비스에 입력하는 학생 명단, 학부모 연락처, 반·출석 기록 등을
            말합니다.
          </Item>
        </Items>
      </Article>

      <Article title="제3조 (약관의 효력과 변경)">
        <Items>
          <Item n={1}>이 약관은 서비스 화면에 게시하고, 회원가입 시 동의를 받아 효력이 생깁니다.</Item>
          <Item n={2}>
            운영자는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 시행일과 변경 사유를 시행 7일
            전(회원에게 불리한 경우 30일 전)부터 공지사항으로 알립니다.
          </Item>
          <Item n={3}>회원이 변경된 약관에 동의하지 않으면 이용을 중단하고 탈퇴할 수 있습니다.</Item>
        </Items>
      </Article>

      <Article title="제4조 (회원가입)">
        <Items>
          <Item n={1}>회원가입은 카카오 또는 네이버 계정으로 로그인한 뒤, 회원 정보를 입력하고 약관에 동의하여 신청합니다.</Item>
          <Item n={2}>만 14세 이상만 회원으로 가입할 수 있습니다.</Item>
          <Item n={3}>
            카카오와 네이버 계정은 서로 다른 회원으로 취급하며, 휴대폰 번호는 회원 한 명만 사용할 수 있습니다.
          </Item>
          <Item n={4}>
            다른 사람의 정보를 도용하거나 사실과 다른 정보를 입력한 경우 가입을 거절하거나 이용을 제한할 수 있습니다.
          </Item>
        </Items>
      </Article>

      <Article title="제5조 (서비스의 내용)">
        <p>운영자는 다음 서비스를 제공합니다.</p>
        <ul className="list-disc pl-5">
          <li>학원 등록·승인 및 학원 코드를 이용한 가입 신청·승인</li>
          <li>학생 명단, 반·시간표, 출석 관리</li>
          <li>학부모·학생 회원의 자녀(본인) 수업·출석 확인</li>
          <li>출석·가입 승인·학원 공지 등 알림</li>
          <li>운영자 공지사항</li>
        </ul>
        <p>서비스는 현재 무료로 제공되며, 유료 서비스를 도입하는 경우 미리 알리고 별도 동의를 받습니다.</p>
      </Article>

      <Article title="제6조 (학원 등록과 승인)">
        <Items>
          <Item n={1}>학원 등록은 원장 유형으로 가입한 회원이 신청하며, 운영자가 확인 후 승인 또는 거절할 수 있습니다.</Item>
          <Item n={2}>
            회원가입 시 고르는 회원 유형은 본인이 선택한 것이며, 원장·강사 기능은 운영자 또는 해당 학원 원장의 승인을 받은
            경우에만 사용할 수 있습니다.
          </Item>
          <Item n={3}>원장은 학원 코드가 퍼진 경우 새 코드로 바꿀 수 있으며, 가입 신청을 확인한 뒤 승인해야 합니다.</Item>
        </Items>
      </Article>

      <Article title="제7조 (원장의 의무)">
        <Items>
          <Item n={1}>
            원장은 학생 정보를 입력하기 전에 「개인정보 보호법」 등 관련 법령에 따른 적법한 근거를 갖추어야 하며, 만 14세
            미만 학생의 정보는 법정대리인의 동의 등 법령이 정한 요건을 갖추어야 합니다.
          </Item>
          <Item n={2}>
            원장은 학부모 연락처를 정확하게 입력해야 하며, 가입 신청을 승인할 때 신청자의 이름과 연락처가 실제 학부모·학생인지
            확인해야 합니다. 잘못된 입력이나 승인으로 학생 정보가 다른 사람에게 보여지지 않도록 주의해야 합니다.
          </Item>
          <Item n={3}>원장은 학원 알림 기능을 학원 운영과 관련된 내용으로만 사용해야 합니다.</Item>
          <Item n={4}>
            학원이 입력·관리하는 학생 정보에 대한 책임은 해당 학원에 있으며, 운영자는 이를 처리할 수 있는 기능과 보호 조치를
            제공합니다.
          </Item>
        </Items>
      </Article>

      <Article title="제8조 (회원의 의무)">
        <p>회원은 다음 행위를 해서는 안 됩니다.</p>
        <ul className="list-disc pl-5">
          <li>다른 사람의 정보 도용, 허위 정보 입력</li>
          <li>권한 없이 다른 학원이나 다른 회원의 정보에 접근하려는 행위</li>
          <li>알림·공지 기능을 이용한 광고, 스팸, 욕설·비방 등 다른 사람에게 피해를 주는 내용 전송</li>
          <li>서비스의 정상적인 운영을 방해하는 행위 (비정상적인 반복 요청, 보안 취약점 악용 등)</li>
          <li>그 밖에 관련 법령이나 이 약관을 위반하는 행위</li>
        </ul>
      </Article>

      <Article title="제9조 (서비스의 변경과 중단)">
        <Items>
          <Item n={1}>운영자는 서비스 개선을 위해 기능을 추가·변경할 수 있으며, 중요한 변경은 미리 공지합니다.</Item>
          <Item n={2}>
            설비 점검·교체, 장애, 천재지변, 수탁 업체 사정 등 불가피한 경우 서비스 제공이 일시 중단될 수 있으며, 가능한 경우
            미리 알립니다.
          </Item>
          <Item n={3}>운영자가 서비스를 종료하는 경우 30일 전에 공지하고, 회원이 필요한 자료를 확인할 수 있도록 안내합니다.</Item>
        </Items>
      </Article>

      <Article title="제10조 (회원 탈퇴와 이용 제한)">
        <Items>
          <Item n={1}>
            회원은 언제든지 [설정 → 회원 탈퇴]에서 탈퇴할 수 있습니다. 다만 운영 중인 학원의 원장이나 운영자 권한이 있는
            회원은 학원 정리나 권한 해제 후 탈퇴할 수 있습니다.
          </Item>
          <Item n={2}>탈퇴 시 개인정보는 <Link to="/privacy" className="text-primary underline underline-offset-4">개인정보 처리방침</Link>에 따라 처리됩니다.</Item>
          <Item n={3}>
            회원이 제8조를 위반한 경우 운영자는 경고, 일시 정지, 학원 승인 취소, 이용 제한 등의 조치를 할 수 있으며, 회원은
            이에 대해 이의를 제기할 수 있습니다.
          </Item>
        </Items>
      </Article>

      <Article title="제11조 (책임의 제한)">
        <Items>
          <Item n={1}>
            운영자는 천재지변, 수탁 업체 장애 등 운영자의 고의나 과실 없이 발생한 서비스 중단에 대해 책임을 지지 않습니다.
          </Item>
          <Item n={2}>
            학원과 회원 사이의 수업, 수강료, 출결 판단 등 학원 운영에 관한 사항은 해당 학원과 회원 사이의 문제이며, 운영자는
            고의나 중대한 과실이 없는 한 이에 대해 책임을 지지 않습니다.
          </Item>
          <Item n={3}>운영자는 회원이 입력한 정보의 정확성에 대해 책임을 지지 않습니다.</Item>
        </Items>
      </Article>

      <Article title="제12조 (분쟁 해결)">
        <Items>
          <Item n={1}>
            서비스 이용에 관한 문의나 불만은{' '}
            <a href={`mailto:${OPERATOR.email}`} className="text-primary underline underline-offset-4">
              {OPERATOR.email}
            </a>
            로 접수하며, 운영자는 성실히 처리합니다.
          </Item>
          <Item n={2}>이 약관은 대한민국 법률에 따르며, 분쟁이 생기면 「민사소송법」에 따른 관할 법원에서 해결합니다.</Item>
        </Items>
      </Article>

      <Article title="부칙">
        <p>이 약관은 {LEGAL_EFFECTIVE_DATE}부터 시행합니다.</p>
      </Article>
    </LegalLayout>
  )
}
