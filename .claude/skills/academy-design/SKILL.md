---
name: academy-design
description: Smart Academy의 UI 디자인 규칙 (라이트/다크 테마 토큰, 학원 브랜드 색상, 카드·배너·뱃지 패턴, 하단 탭 레이아웃, 대비 기준). src/components 나 src/pages 아래 화면·컴포넌트를 새로 만들거나 색상·배경·뱃지·카드·버튼 스타일을 수정하거나, 다크/라이트 모드 가독성 문제를 고치거나, 디자인 리뷰를 할 때 사용한다.
---

# Smart Academy 디자인 스킬

전체 설명은 `DESIGN_SYSTEM.md`. 이 스킬은 작업할 때 바로 적용할 규칙만 모았다.
색상 값의 원본은 `src/index.css` 의 `:root`(라이트) / `.dark`(다크)다. 스택: Tailwind v4 + shadcn/ui(radix-nova) + lucide-react.

## 1. 색은 토큰 클래스로만

고정 색(`#hex`, `text-white`, `bg-slate-900`, `text-blue-600`, `bg-amber-500/20` …)을 화면 코드에 쓰지 않는다. 토큰은 라이트/다크에서 자동 전환된다.

| 의미 | 면 | 그 위 글씨 |
|---|---|---|
| 페이지 | `bg-background` | `text-foreground`, 보조 `text-muted-foreground` |
| 카드 | `bg-card` (`<Card>`) | `text-card-foreground`, 보조 `text-muted-foreground` |
| 보조 면 | `bg-muted` | `text-muted-foreground` |
| 주요(학원 파랑) | `bg-primary` | `text-primary-foreground` |
| 강조 칩 | `bg-accent` | `text-accent-foreground` |
| 출석·완료 | `bg-success` | `text-success-foreground` |
| 주의·새 알림(노랑) | `bg-warning` | `text-warning-foreground` |
| 오류 | `bg-destructive/10` | `text-destructive` |

## 2. 면 패턴을 먼저 정한다

- **A. 테마 면 (기본)**: `Card`, `bg-card`, `bg-muted`, `glass` + `text-foreground` / `text-muted-foreground`
- **B. 색 면**: `bg-X` + 반드시 `text-X-foreground`. `bg-primary text-white` 금지 (다크에서 primary 가 밝은 파랑이라 흰 글씨가 안 보인다)
- **C. 틴트 면**: `bg-X/15` + `text-X`. 노랑만 예외: `bg-warning/25 text-warning-foreground dark:text-warning`

**금지**: 반투명 어두운 배경 + 고정 흰 글씨 / 고정 어두운 배경 + `text-foreground` / 그라데이션 옅은 구간 위 글씨.

## 3. 레이아웃·컴포넌트

- 로그인 후 화면은 `AppShell` 안에 넣는다. 탭 추가/변경은 `src/components/layout/tabs.ts` 만 고친다 (`guest` 로 게스트 공개 여부).
- 내용 폭 `max-w-screen-sm`, 탭 사이 간격 `gap-4`~`gap-5`, 카드 모서리는 shadcn 기본(`rounded-xl`).
- 빈 화면은 `EmptyState`(아이콘 + 제목 + 설명 + 선택 버튼).
- shadcn 컴포넌트 추가: `npx shadcn@latest add <name>` → 생성된 파일의 `import { cn } from "cn"` 은 `@/lib/utils` 로 고치고 `npm uninstall cn`.
- 버튼 안 아이콘은 `<Icon data-icon="inline-start" />` (radix-nova 버튼이 여백을 맞춘다).
- 테마는 `useTheme()` (`src/hooks/useTheme.ts`). `<html class="dark">` 를 직접 건드리지 않는다.

## 4. 확인

- 새 색 조합을 만들면 대비 4.5:1 이상인지 확인 (토큰끼리의 짝은 이미 확인됨).
- 끝내기 전에 라이트·다크 양쪽 스크린샷을 본다. 테마 전환 직후 0.15초는 색 전환 애니메이션 중이라 캡처가 어긋날 수 있으니 잠깐 기다린 뒤 찍는다.
