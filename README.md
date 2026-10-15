# 동굴바리의 방울 대모험

작은 동굴 탐험가 **동굴바리**가 방울로 말썽꾸러기를 가두고 동굴을 구하는 1인용 2D 플랫폼 액션 게임입니다. PC·모바일 브라우저에서 설치나 로그인 없이 플레이합니다.

HTML·CSS·JavaScript·Canvas만 사용합니다. 빌드, 서버 애플리케이션, 외부 API, 이미지·음원 다운로드가 없습니다. 캐릭터와 맵은 직접 그렸으며, 효과음은 사용자 시작 동작 후 Web Audio로 합성합니다. 원작의 캐릭터·명칭·맵·시청각 리소스를 사용하지 않습니다.

## 게임 방법

- PC: `← / →` 또는 `A / D` 이동, `Space` 점프, `Z / J` 방울 발사, `Esc` 일시정지·재개.
- 모바일: 아래쪽 좌우·점프·방울 버튼을 누르세요. 이동과 점프·발사를 동시에 누를 수 있습니다.
- 방울에 적이 닿으면 6초간 갇혀 떠오릅니다. 갇힌 방울에 몸으로 닿아 터뜨리세요. 테두리 원이 남은 포획 시간을 표시합니다.
- 빈 방울은 안전합니다. 자유로운 적에게 닿으면 생명 1개가 줄고 2초간 무적 상태로 깜빡입니다.
- 생명은 3개이며 스테이지 사이에 유지됩니다. 서로 다른 5개 스테이지의 적을 모두 처치하면 우승합니다.
- 처치 점수는 스테이지에 따라 100~200점, 스테이지 완료 보너스는 250점입니다.
- 일시정지·재개, 다시 시작, 음소거 버튼을 제공합니다. 탭을 벗어나거나 창이 포커스를 잃으면 자동 일시정지합니다.
- 최고 점수는 같은 브라우저에 저장합니다. 저장소 접근이 차단되어도 플레이할 수 있습니다.

## 로컬 실행

Python 3가 있는 환경에서 저장소 폴더로 이동해 실행합니다.

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

브라우저에서 `http://localhost:8000`을 엽니다. 게임 자체에는 패키지 설치나 빌드가 필요하지 않습니다.

파일 구조:

- `index.html`: 한국어 UI와 게임 화면
- `style.css`: 반응형 화면 및 멀티터치 버튼
- `game.js`: 고정 시간 간격 물리 계산, 5개 맵, 도트 렌더링, 입력·오디오·저장
- `.github/workflows/pages.yml`: 정적 파일 3개만 업로드하는 Pages 배포
- `tests/browser.cjs`: 선택 실행하는 Chromium 기능 검사 (배포 파일에 포함하지 않음)

## GitHub Pages 배포

이 저장소의 배포 예상 주소는 **https://yunsangyeong.github.io/bubble-adventure/** 입니다. 이 주소 자체가 배포 완료를 의미하지는 않습니다.

1. GitHub의 `YunSangYeong/bubble-adventure` 저장소 → **Settings → Pages → Build and deployment → Source**에서 **GitHub Actions**를 선택합니다.
2. `main`에 파일을 푸시하면 `Deploy game to GitHub Pages` 워크플로가 실행됩니다. 이미 푸시했다면 **Actions**에서 해당 워크플로의 **Run workflow**를 실행합니다.
3. 워크플로의 배포 작업이 성공하고 위 주소에서 게임이 열리는지 확인합니다.

경로는 모두 상대 경로이므로 저장소 하위 URL에서도 동작합니다. GitHub Actions가 비활성화되어 있으면 저장소 설정에서 활성화해야 합니다.

## 티스토리 삽입

**Pages 배포 주소가 실제로 열리는 것을 확인한 뒤**, 티스토리 글의 HTML 모드에 아래 코드를 넣습니다. 높이에는 모바일 조작 버튼·안내 영역을 포함했습니다. 좁은 블로그 스킨이나 확대 글꼴에서는 iframe 내부 스크롤도 허용합니다.

```html
<div style="width:100%;max-width:1000px;margin:24px auto;">
  <iframe
    src="https://yunsangyeong.github.io/bubble-adventure/"
    title="동굴바리의 방울 대모험 — 1인용 방울 액션 게임"
    width="100%"
    height="1000"
    loading="lazy"
    allow="autoplay; fullscreen"
    allowfullscreen
    style="display:block;width:100%;height:clamp(720px,calc(60vw + 340px),1000px);border:0;border-radius:12px;background:#102534;"
  ></iframe>
</div>
```

iframe 안에서 시작 버튼을 눌러 소리를 활성화합니다. 블로그의 HTML 필터·스킨 설정에 따라 iframe 허용이 필요할 수 있습니다.

## 브라우저 검증

선택적인 개발 검증에만 Node.js, Playwright, Chromium이 필요합니다. 게임의 런타임 의존성은 아닙니다. 저장소 상위 폴더(`/workspace`)에서 정적 서버를 켜고, 저장소 폴더에서 다음을 실행합니다.

```sh
npm install --prefix /tmp/bubble-validation --cache /tmp/bubble-npm-cache playwright@1.64.1 --no-audit --no-fund
NODE_PATH=/tmp/bubble-validation/node_modules node tests/browser.cjs
```

시스템 Chromium 경로가 다르면 `CHROMIUM_PATH`, 서버 주소가 다르면 `GAME_URL`을 지정합니다. 기본값은 `/usr/bin/chromium`과 `http://127.0.0.1:8000/bubble-adventure/`입니다.

검사 항목: 실제 키보드 시작·이동·점프·발사·포획·접촉 처치, 탈출 시간, 빈 방울 안전성, 피격·무적, 게임 오버·초기화, 일시정지·재개·음소거·창 비활성화, 5개 스테이지 전환·우승, 390px 모바일 레이아웃과 3점 동시 터치·입력 해제, localStorage 차단, 콘솔 오류.

적 위치와 시간 경계는 브라우저 테스트에서만 임시로 주입하는 제어 인터페이스로 재현합니다. 모든 스테이지를 사람이 처음부터 끝까지 플레이했다는 의미는 아닙니다. 배포 코드에는 제어 인터페이스가 없습니다. 스크린샷은 `/tmp/bubble-desktop-victory.png`, `/tmp/bubble-mobile.png`에 저장합니다. 실제 iOS·Android 기기에서의 촉감과 오디오 출력은 별도 확인이 필요합니다.
