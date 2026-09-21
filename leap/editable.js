// 사전 정보 전체(어원/뜻/동의어·반의어/예문/숙어/회화)를 인라인으로 직접 수정할 수
// 있게 해주는 공용 렌더러예요. dictionary.html(새 단어 등록)과 edit.html(기존 게시물
// 수정) 양쪽에서 재사용합니다. 각 render* 함수는 컨테이너를 입력 필드들로 채우고,
// 대응하는 collect* 함수는 그 필드들에서 다시 데이터를 읽어옵니다.

function makeEditInput(value, placeholder, extraClass) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = `edit-inline-input ${extraClass || ""}`.trim();
  input.value = value || "";
  if (placeholder) input.placeholder = placeholder;
  return input;
}

function makeEditTextarea(value, placeholder, extraClass) {
  const ta = document.createElement("textarea");
  ta.className = `edit-inline-textarea ${extraClass || ""}`.trim();
  ta.value = value || "";
  if (placeholder) ta.placeholder = placeholder;
  ta.rows = 2;
  return ta;
}

// ---------- 뜻(정의) ----------
function renderEditableDefinitions(container, definitions) {
  container.innerHTML = "";
  const list = definitions && definitions.length > 0 ? definitions : [{ pos: "", text: "", koreanGloss: "" }];
  list.forEach((d) => {
    const row = document.createElement("div");
    row.className = "edit-definition-row";
    row.appendChild(makeEditInput(d.pos, "품사", "edit-definition-pos"));
    row.appendChild(makeEditTextarea(d.text, "영어 뜻풀이", "edit-definition-text"));
    row.appendChild(makeEditInput(d.koreanGloss, "한글 뜻풀이", "edit-definition-gloss"));
    container.appendChild(row);
  });
}

function collectDefinitions(container) {
  return [...container.querySelectorAll(".edit-definition-row")]
    .map((row) => ({
      pos: row.querySelector(".edit-definition-pos").value.trim(),
      text: row.querySelector(".edit-definition-text").value.trim(),
      koreanGloss: row.querySelector(".edit-definition-gloss").value.trim(),
    }))
    .filter((d) => d.text || d.koreanGloss);
}

// ---------- 동의어 / 반의어 (쉼표로 구분된 입력창 하나) ----------
function renderEditableWordList(input, words) {
  input.value = (words || []).join(", ");
}

function collectWordList(input) {
  return input.value
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
}

// ---------- 예문 ----------
function renderEditableExamples(container, examples) {
  container.innerHTML = "";
  const list = examples && examples.length > 0 ? examples : [{ en: "", ko: "" }];
  list.forEach((ex) => {
    const row = document.createElement("div");
    row.className = "edit-example-row";
    row.appendChild(makeEditInput(ex.en, "영어 예문", "edit-example-en"));
    row.appendChild(makeEditInput(ex.ko, "한글 번역", "edit-example-ko"));
    container.appendChild(row);
  });
}

function collectExamples(container) {
  return [...container.querySelectorAll(".edit-example-row")]
    .map((row) => ({
      en: row.querySelector(".edit-example-en").value.trim(),
      ko: row.querySelector(".edit-example-ko").value.trim(),
    }))
    .filter((e) => e.en || e.ko);
}

// ---------- 숙어 ----------
function renderEditableIdioms(container, idioms) {
  container.innerHTML = "";
  const list = idioms && idioms.length > 0 ? idioms : [{ phrase: "", gloss: "", example: "", exampleGloss: "" }];
  list.forEach((idiom) => {
    const row = document.createElement("div");
    row.className = "edit-idiom-row";
    row.appendChild(makeEditInput(idiom.phrase, "숙어 표현", "edit-idiom-phrase"));
    row.appendChild(makeEditInput(idiom.gloss, "뜻", "edit-idiom-gloss"));
    row.appendChild(makeEditInput(idiom.example, "예문 (영어)", "edit-idiom-example"));
    row.appendChild(makeEditInput(idiom.exampleGloss, "예문 번역", "edit-idiom-example-gloss"));
    container.appendChild(row);
  });
}

function collectIdioms(container) {
  return [...container.querySelectorAll(".edit-idiom-row")]
    .map((row) => ({
      phrase: row.querySelector(".edit-idiom-phrase").value.trim(),
      gloss: row.querySelector(".edit-idiom-gloss").value.trim(),
      example: row.querySelector(".edit-idiom-example").value.trim(),
      exampleGloss: row.querySelector(".edit-idiom-example-gloss").value.trim(),
    }))
    .filter((i) => i.phrase || i.gloss);
}

// ---------- 회화 ----------
function renderEditableConversation(container, conversation) {
  container.innerHTML = "";
  const list = conversation && conversation.length > 0 ? conversation : [{ en: "", ko: "" }];
  list.forEach((c) => {
    const row = document.createElement("div");
    row.className = "edit-conversation-row";
    row.appendChild(makeEditInput(c.en, "영어 문장", "edit-conversation-en"));
    row.appendChild(makeEditInput(c.ko, "한글 번역", "edit-conversation-ko"));
    container.appendChild(row);
  });
}

function collectConversation(container) {
  return [...container.querySelectorAll(".edit-conversation-row")]
    .map((row) => ({
      en: row.querySelector(".edit-conversation-en").value.trim(),
      ko: row.querySelector(".edit-conversation-ko").value.trim(),
    }))
    .filter((c) => c.en || c.ko);
}
