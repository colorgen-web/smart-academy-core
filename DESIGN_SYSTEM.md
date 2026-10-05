# Smart Academy — 디자인 시스템

색상·테마·레이아웃 규칙. 새 화면이나 컴포넌트를 만들 때 이 규칙을 따르면 라이트/다크 모드 가독성 문제를 처음부터 막을 수 있습니다.
(mobileTennisWar 의 라이트 모드 가독성 감사에서 얻은 규칙을 Tailwind + shadcn 구조에 맞게 옮긴 것입니다.)

- 색상 값의 원본: `src/index.css` 의 `:root`(라이트) / `.dark`(다크)
- 작업할 때 바로 쓰는 요약: `.claude/skills/academy-design/SKILL.md`

## 1. 테마 전환 구조

- `<html class="dark">` 유무로 전환 (shadcn 기본 방식). Tailwind 에서는 `dark:` 접두사로 다크 전용 스타일을 줍니다.
- 사용자 선택은 `localStorage['academy_theme']` 에 `'light' | 'dark' | 'system'` 으로 저장. 기본값은 `system`(OS 설정 따라감).
- `index.html` 의 인라인 스크립트가 **첫 화면이 그려지기 전에** 테마를 적용해 깜빡임을 막습니다. `src/hooks/useTheme.ts` 와 키·규칙이 같아야 합니다.
- 설정 탭 → "화면 모드" 에서 전환. 코드에서는 `useTheme()` 의 `theme` / `setTheme` 을 씁니다.

## 2. 색상 토큰

모든 토큰은 라이트/다크 양쪽에 정의되어 **자동으로 전환**됩니다. 화면 코드에 `#3355ff`, `text-blue-600` 같은 고정 색을 쓰지 말고 아래 토큰 클래스를 쓰세요.

| 토큰 (Tailwind 클래스) | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `bg-background` / `text-foreground` | 아주 옅은 청회색 / 짙은 남색 | 짙은 남색 / 흰색 | 페이지 배경, 본문 |
| `bg-card` / `text-card-foreground` | 흰색 | 남색 | 카드 |
| `bg-muted` / `text-muted-foreground` | 옅은 회색 / 중간 회색 | 어두운 회색 / 밝은 회색 | 보조 면, 설명 글 |
| `bg-primary` / `text-primary-foreground` | 학원 파랑 `#325bda` / 흰색 | 밝은 파랑 `#729afb` / 짙은 남색 | 주요 버튼, 선택 상태, 활성 탭 |
| `bg-accent` / `text-accent-foreground` | 옅은 파랑 / 진한 파랑 | 어두운 파랑 / 밝은 파랑 | 아이콘 배경, 강조 칩 |
| `bg-success` / `text-success-foreground` | 초록 `#008240` / 흰색 | 밝은 초록 / 짙은 초록 | 출석·완료 |
| `bg-warning` / `text-warning-foreground` | 노랑 `#fac547` / 짙은 갈색 | 같음 | 주의·새 알림 (노란 면 위 글씨는 항상 짙은 색) |
| `bg-destructive` / `text-destructive` | 빨강 | 밝은 빨강 | 오류, 삭제 |
| `border-border`, `ring-ring` | | | 테두리, 포커스 링 |

> 모든 "글씨 / 배경" 조합은 **WCAG AA 4.5:1 이상**으로 맞춰 두었습니다. 토큰 값을 바꾸면 대비를 다시 계산하세요.

### 브랜드 색
앱 아이콘(`public/favicon.svg`)과 같은 계열입니다: **파랑**(기본), **노랑**(학사모·강조), **초록**(출석·체크).

## 3. 새 UI를 만들 때의 판단 기준 (가장 중요)

배경이 **테마를 따라가는지**, **고정되어 있는지**를 먼저 정하고, 그에 맞는 글자색을 고릅니다.

### 패턴 A — 테마를 따라가는 면 (기본값)
```tsx
<Card>                                  {/* 또는 bg-card / bg-muted / glass */}
  <p className="text-foreground">제목</p>
  <p className="text-muted-foreground">설명</p>
</Card>
```
배경과 글자가 둘 다 토큰이라 라이트/다크에서 **같이** 바뀝니다. 새 화면은 기본적으로 이 패턴을 씁니다.

### 패턴 B — 색이 있는 면 (브랜드 배너, 상태 뱃지)
```tsx
<div className="bg-primary text-primary-foreground">…</div>
<span className="bg-warning text-warning-foreground">…</span>
```
색 면을 쓸 때는 **반드시 짝이 되는 `*-foreground`** 를 글자색으로 씁니다. `bg-primary` 위에 `text-white` 를 직접 쓰면 다크 모드(밝은 파랑 면)에서 대비가 무너집니다.

### 패턴 C — 옅은 틴트 면 (아이콘 배경 등)
```tsx
<span className="bg-success/15 text-success">…</span>
```
불투명도를 낮춘 틴트 위에는 **같은 색의 진한 토큰**(`text-success`)을 글자색으로 씁니다. 노랑은 밝아서 예외: 라이트에서는 `text-warning-foreground`, 다크에서는 `dark:text-warning`.

### 절대 금지
- 반투명 어두운 배경(`bg-black/50` 등) + 고정 흰 글씨 → 라이트 모드에서 탁해지고 안 보입니다.
- 고정 어두운 배경(`bg-slate-900` 등) + `text-foreground` → 라이트 모드에서 글씨가 배경에 묻힙니다. **배경이 고정이면 글자색도 고정.**
- Tailwind 기본 팔레트 직접 사용(`bg-amber-500/20 text-amber-300` 등) → 테마를 따라가지 않아 한쪽 모드에서 대비가 깨집니다. 토큰을 쓰세요.
- 그라데이션의 옅은 구간 위에 글씨·뱃지를 두지 않습니다. 뱃지는 자체 불투명 배경을 줍니다.

## 4. 레이아웃

- **AppShell** (`src/components/layout/AppShell.tsx`): 상단 헤더 + 내용 + 하단 탭. 로그인 이후 모든 화면의 틀입니다.
- **BottomNav**: 탭 목록은 `src/components/layout/tabs.ts` 한 곳에서 관리 (홈·출석·수업·알림·설정). `guest: false` 인 탭은 게스트에게 자물쇠가 붙고, 내용 영역에 로그인 안내가 나옵니다.
- 내용 폭은 `max-w-screen-sm`(640px) 가운데 정렬 — 휴대폰 기준 디자인을 PC 에서도 그대로 보여 줍니다.
- 아이폰 노치/홈 바: 헤더·하단 탭은 `env(safe-area-inset-*)` 로 여백을 줍니다. 내용 하단 여백은 탭 높이(5rem)+safe area.
- `glass` 유틸리티: 반투명 카드 색 + 블러 + 테두리. 헤더·하단 탭처럼 내용 위에 떠 있는 요소에 씁니다.
- 아이콘은 `lucide-react` 만 씁니다.

## 5. 재발 방지 체크리스트 (리뷰할 때)

1. 고정 색(`#hex`, `text-white`, `bg-slate-*`, `text-blue-*`)이 화면 코드에 들어가지 않았는가 — 브랜드 SVG 아이콘 내부는 예외
2. 색 면(`bg-primary` 등) 위 글씨가 짝 토큰(`text-primary-foreground`)인가
3. 반투명 배경 위 글씨가 테마 토큰인가
4. 라이트·다크 **양쪽**에서 한 번씩 눈으로 확인했는가 (설정 → 화면 모드)
5. 글씨만으로 의미를 전달하지 않는가 — 상태는 아이콘/텍스트도 함께 (색맹 대응)

## 6. 작업 순서 (새 화면)

1. 필요한 컴포넌트가 `src/components/ui` 에 있는지 확인, 없으면 `npx shadcn@latest add <이름>`
   - 추가 후 `import { cn } from "cn"` 처럼 잘못 들어간 import 가 있으면 `@/lib/utils` 로 고치고 `cn` 패키지를 지울 것 (shadcn CLI 가 경로를 잘못 잡는 경우가 있음)
2. 면 패턴(A/B/C)을 정하고 토큰 클래스만 사용
3. 빈 상태는 `EmptyState` 컴포넌트 사용
4. 라이트/다크 양쪽 확인
