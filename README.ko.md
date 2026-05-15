# Obsidian Regex Refiner

[ [English](https://github.com/jaewonE/obsidian_regex_refiner) | [한국어](https://github.com/jaewonE/obsidian_regex_refiner/blob/master/README.ko.md) ]

![Obsidian Regex Refiner demo](assets/demo.gif)

Obsidian Regex Refiner는 활성 Markdown 노트에 재사용 가능한 텍스트 리팩터링 파이프라인을 적용하는 Obsidian 커뮤니티 플러그인입니다.

각 파이프라인은 DAG로 저장되며, 순서가 있는 단계들로 구성됩니다. 각 단계는 전체 정규식 치환 또는 전체 일반 텍스트 치환을 실행할 수 있습니다. 이 플러그인은 반복적인 노트 정리, 형식 변환, Markdown-safe 리팩터링을 위해 설계되었으며 vault 데이터를 Obsidian 밖으로 보내지 않습니다.

## 목적

Regex Refiner는 같은 찾기 및 바꾸기 순서를 매번 다시 구성하지 않고, 이미 정의한 텍스트 변환을 명령으로 실행할 수 있게 합니다.

일반적인 사용 예시는 다음과 같습니다.

- 반복되는 마크업 패턴을 다른 문법으로 변환합니다.
- 공백, 줄바꿈, 제목 주변 간격을 정규화합니다.
- 보호되어야 하는 영역은 유지하면서 가져온 Markdown을 정리합니다.
- 여러 개의 이름 붙은 변환 파이프라인을 저장하고 picker에서 필요한 항목을 실행합니다.

## 주요 기능

- 플러그인 설정에서 여러 DAG 파이프라인을 생성, 수정, 확장, 축소, 삭제할 수 있습니다.
- 휴지통 버튼과 삭제 전 확인 창을 통해 DAG 또는 단계를 제거할 수 있습니다.
- 각 DAG에 순서가 있는 `Regex` 또는 `Replace` 단계를 추가할 수 있습니다.
- 명령 팔레트 또는 지정한 단축키로 DAG를 실행할 수 있습니다.
- 키보드 방향키, `Enter`, 마우스 hover, click으로 실행할 DAG를 선택할 수 있습니다.
- 설정된 DAG가 없으면 비어 있는 상태 안내 메시지를 보여줍니다.
- DAG 설정을 JSON으로 내보낼 수 있습니다.
- JSON을 가져올 때 기존 DAG를 덮어쓰지 않고 뒤에 추가합니다.
- 잘못된 정규식이 있으면 실행을 중단하고 노트를 변경하지 않습니다.
- 다음 Markdown 보호 영역을 유지합니다.
  - YAML frontmatter
  - fenced code block
  - inline code
  - inline 및 block math
  - Markdown 표 구분자와 alignment row

## DAG 처리 방식

DAG는 이름이 있는 단계형 파이프라인입니다. `1.0.0` 버전에서는 설정에 표시된 위에서 아래 순서대로 단계가 실행됩니다.

각 단계의 동작은 다음과 같습니다.

- `Regex`는 **Find** 필드를 전역 JavaScript 정규식으로 컴파일합니다.
- `Replace`는 **Find** 필드를 일반 텍스트로 취급하고 모든 항목을 치환합니다.
- **Replace**는 두 단계 유형 모두에서 사용할 치환 텍스트입니다.

어떤 단계든 **Find** 필드가 비어 있거나 정규식이 잘못되어 있으면 DAG는 노트를 수정하지 않습니다.

## DAG 설정 방법

1. **Settings -> Community plugins -> Obsidian Regex Refiner**를 엽니다.
2. **Add DAG**를 선택합니다.
3. 새 DAG 행을 펼칩니다.
4. 명확한 **DAG name**을 입력합니다. 이 이름은 picker에 표시됩니다.
5. 실행할 각 변환마다 **Add step**을 선택합니다.
6. 각 단계에 다음 값을 설정합니다.
   - **Step name**: 변환의 짧은 제목입니다.
   - **Step description**: 단계가 수행하는 작업 설명입니다.
   - **Step type**: `Regex` 또는 `Replace`입니다.
   - **Find**: 검색할 정규식 패턴 또는 일반 텍스트입니다.
   - **Replace**: 치환할 텍스트입니다.
7. 실행하려는 순서대로 단계를 배치합니다.
8. 명령 팔레트에서 **Apply regex refiner DAG**를 실행하거나, **Settings -> Hotkeys**에서 단축키를 지정합니다.

예시 DAG:

```json
{
  "name": "Normalize spacing",
  "steps": [
    {
      "name": "Collapse multiple spaces",
      "description": "Convert consecutive spaces into a single space.",
      "type": "Regex",
      "find": " {2,}",
      "replace": " "
    }
  ]
}
```

## JSON 가져오기 및 내보내기

**Export JSON**을 사용하면 현재 DAG 설정을 복사할 수 있습니다.

**Import JSON**을 사용하면 설정을 다시 플러그인에 붙여 넣을 수 있습니다. 가져온 DAG는 기존 목록 뒤에 추가되며, 충돌을 피하기 위해 가져온 ID는 새로 생성됩니다.

허용되는 형식:

```json
{
  "dags": [
    {
      "name": "My DAG",
      "steps": [
        {
          "name": "Step 1",
          "description": "Example",
          "type": "Regex",
          "find": "foo",
          "replace": "bar"
        }
      ]
    }
  ]
}
```

```json
[
  {
    "name": "My DAG",
    "steps": []
  }
]
```

## 수동 설치

릴리스 asset을 다운로드한 뒤 다음 위치에 복사합니다.

```text
<Vault>/.obsidian/plugins/obsidian_regex_refiner/
```

필수 파일:

- `main.js`
- `manifest.json`
- `styles.css`

Obsidian을 다시 불러온 뒤 **Settings -> Community plugins**에서 플러그인을 활성화합니다.

## 개발

요구 사항:

- Node.js 18+
- npm

의존성 설치:

```bash
npm install
```

개발 빌드 실행:

```bash
npm run dev
```

프로덕션 빌드 생성:

```bash
npm run build
```

## 라이선스

Obsidian Regex Refiner는 GPL-3.0 라이선스로 배포됩니다.
