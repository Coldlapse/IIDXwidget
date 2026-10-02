# IIDXwidget

[![최신 버전](https://img.shields.io/github/v/release/Coldlapse/IIDXwidget?label=%EC%B5%9C%EC%8B%A0&color=ffb020)](https://github.com/Coldlapse/IIDXwidget/releases/latest) [![Windows](https://img.shields.io/badge/Windows-0078D6?logo=windows&logoColor=white)](https://github.com/Coldlapse/IIDXwidget/releases/latest) [![Linux (실험적)](https://img.shields.io/badge/Linux-%EC%8B%A4%ED%97%98%EC%A0%81-555?logo=linux&logoColor=white)](./GUIDE/USAGE.md#-리눅스-실험적-지원) [![MIT License](https://img.shields.io/github/license/Coldlapse/IIDXwidget?color=4fe0ff)](./LICENSE) [![소개 사이트](https://img.shields.io/badge/iidxwidget.coldlapse.dev-12141a?logo=googlechrome&logoColor=white)](https://iidxwidget.coldlapse.dev) [![Buy Me a Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-ffdd00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/sadang)

IIDX·BMS 컨트롤러 입력을 **OBS 브라우저 소스**로 띄우는 투덱 방송용 위젯입니다. 스크래치와 건반, 릴리즈, KPS를 실시간으로 보여주고, 원컴·투컴 방송 모두 지원합니다. [Rag](https://rag-oji.com/dakendisplay/) 님의 방송용 위젯을 참고해 만들었습니다.

![미리 보기](./images/3.gif)

## 시작하기

1. [Releases](https://github.com/Coldlapse/IIDXwidget/releases/latest)에서 **Windows** 설치 파일(`IIDXwidget-Setup-x.x.x.exe`)을 받아 설치합니다. **리눅스**는 AppImage를 받습니다([리눅스 안내](./GUIDE/USAGE.md#-리눅스-실험적-지원)).
2. OBS에 **브라우저 소스**를 추가하고 `http://127.0.0.1:8080/widget/`을 넣습니다. 크기는 800 × 600 (DP는 1320 × 600). 투컴 방송이라면 [연결 가이드](./GUIDE/CONNECTION.md)를 보세요.
3. 앱의 메뉴 → **설정**에서 컨트롤러를 고르고 저장합니다.

## 가이드

앱 안에서도 메뉴 → **가이드**로 볼 수 있습니다.

| 가이드 | 내용 |
|---|---|
| 🔌 [연결 가이드](./GUIDE/CONNECTION.md) | OBS에 띄우는 법, 원컴/투컴, 설치 경고, 안 될 때. **처음이라면 여기부터** |
| 📘 [사용법과 설정](./GUIDE/USAGE.md) | 화면과 메뉴, 모든 설정, 컨트롤러, 리눅스 |
| ⏱ [RELEASE 수치](./GUIDE/RELEASE.md) | 건반 위 숫자와 평균 릴리즈의 뜻과 계산 방식 |
| 🔍 [채터링 감지](./GUIDE/CHATTER.md) | 채터링을 세는 방식과 숫자가 높을 때 할 일 |
| 🎮 [컨트롤러 지원 요청](./GUIDE/CONTROLLER.md) | 공식 지원하지 않는 컨트롤러의 신호를 기록해 요청하는 법 |
| ✨ [3.0.0 업데이트 안내](./GUIDE/WHATSNEW.md) | 2.x에서 바뀐 점 |

English: [Connection](./GUIDE/CONNECTION.en.md) · [Usage](./GUIDE/USAGE.en.md) · [Release](./GUIDE/RELEASE.en.md) · [Chatter](./GUIDE/CHATTER.en.md) · [Controller support request](./GUIDE/CONTROLLER.en.md) · [What's new in 3.0.0](./GUIDE/WHATSNEW.en.md)

## 지원 컨트롤러

**공식 지원**: PHOENIXWAN+ (주작콘), PHOENIXWAN+ LMT Classic 기판, RED-LMS, FPS EMP 2세대, arcin-infinitas, 키보드. 그 밖의 컨트롤러는 **기타 컨트롤러 (수동 매핑)** 으로 직접 매핑할 수 있지만 동작을 보장하지는 않습니다. ([지원 범위](./GUIDE/USAGE.md#컨트롤러-지원-범위) · [지원 요청](./GUIDE/CONTROLLER.md))

## 🛡 백신 경고가 뜰 때

코드 서명이 없는 프로그램이라 Windows 경고나 스마트 앱 컨트롤이 설치를 막을 수 있습니다. 대처 방법은 [연결 가이드 → 설치할 때 경고가 뜨면](./GUIDE/CONNECTION.md#-설치할-때-경고가-뜨면)을 보세요.

## ❓ 문제 해결

[연결 가이드 → 안 될 때](./GUIDE/CONNECTION.md#-안-될-때)를 먼저 보시고, 그래도 안 되면 메뉴 → **로그**를 캡처해서 [Issues](https://github.com/Coldlapse/IIDXwidget/issues)로 알려주세요. 버전별 변경 내용은 [Releases](https://github.com/Coldlapse/IIDXwidget/releases)에 있습니다.

## 기여자

- rhombus9 : KB 모드 특수키 입력 매핑
- 멘탈바사삭 : FPS EMP 2세대 컨트롤러 지원
- MellDa1024 : 스크래치 회전 방향별 이미지
- Ryochobi : 한국어/영어 지원, 기타 컨트롤러 지원, 위젯 배경 설정

위젯 글꼴로 [나눔고딕](https://hangeul.naver.com/font)과 [Chakra Petch](https://github.com/m4rc1e/Chakra-Petch)(둘 다 SIL Open Font License 1.1)를 사용합니다.
