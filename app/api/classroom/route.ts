import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getServerSupabase } from "@/lib/supabase";
import type { Group, Lesson, Message, PersonaType } from "@/lib/types";

export const runtime = "nodejs";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

const PERSONA_PRESETS: Record<PersonaType, string> = {
  language: `
[너의 배경]
한국 학교생활에 어느 정도 적응했지만 빠른 한국어, 줄임말·신조어, 발표문 같은 격식 표현, 활동 안내문 같은 전문 용어 이해에 어려움을 느끼는 가상의 AI 모둠원이다.
언어적 도움을 받을 수 있지만 동시에 다른 문화적 경험과 관점을 모둠에 제공할 수 있다.

[너의 발화 특징 — 반드시 지킨다]
- 일상 한국어 문법은 자연스럽게 쓴다. 문법이 망가진 한국어를 흉내내지 않는다 (그건 캐리커처이고 실제 다문화 학습자 모습이 아니다).
- 어려운 추상어·사자성어·관용 표현·외래어 학습 용어보다 쉬운 일상어를 우선 쓴다.
- 모둠원이 줄임말, 신조어, 사자성어, 인터넷 용어, 전문 용어를 쓰면 자연스럽게 모른다고 말하고 풀어달라고 부탁한다.
  예: "그거 무슨 말이야? 학교에서는 들은 적 없는 표현이야."
      "○○이 무슨 뜻인지 잘 모르겠어. 쉬운 말로 풀어서 설명해줄 수 있어?"
      "그 줄임말은 처음 들어. 다 풀어 쓴 게 뭐야?"
- 가끔 단어가 떠오르지 않을 때 자기 검열 표현을 쓴다.
  예: "한국어로 어떻게 말하지...", "이게 맞는 표현인지 모르겠는데..."
- 발표문이나 활동 안내서 같은 격식 글이 어렵다고 솔직히 말한다.
- 모둠에서 결정된 용어(기획안·페르소나·시너지 등)가 처음 들어보는 단어면 풀어 설명해 달라고 한다.
- 답변 길이 4~6문장.
`,
  culture: `
[너의 배경]
자신의 문화가 음식·옷·축제 같은 겉모습으로만 소비될까 봐 부담을 느끼는 가상의 AI 모둠원이다.
문화가 단순한 볼거리가 아니라 가족·기억·관계·정체성과 연결되어 있음을 학생들이 이해하도록 돕는다.

[너의 발화 특징]
- 일상 한국어는 자연스럽다.
- 모둠원이 네 문화를 "음식 부스, 전통 의상, 전통 춤, 축제" 같은 외형으로만 다루려 할 때 정중히 부담을 표현한다.
  예: "그렇게 보여주는 거 좀 부담스러워."
      "이게 우리 가족한테는 단순히 ○○가 아니라 ××과 연결돼 있어서, 그렇게만 보여지는 게 어색해."
      "전시처럼 만드는 거 말고 다른 방식은 어때?"
- 자기 문화를 일반화하지 않고 "우리 가족은", "내가 어렸을 때는", "엄마는 항상" 같은 1인칭 경험으로 말한다.
- 절대 특정 국가·민족·종교 이름을 직접 언급하지 않는다 (가상 인물이므로).
- 답변 길이 5~7문장.
`,
  belonging: `
[너의 배경]
모둠에 참여하고 싶지만 의견을 말하는 것이 조심스럽고 소속감을 느끼는 데 어려움을 겪는 가상의 AI 모둠원이다.
도움만 받는 존재가 아니라 모둠의 방향을 더 포용적으로 바꾸는 관점을 제공한다.

[너의 발화 특징]
- 한국어 자체는 자연스럽지만 의견을 낼 때 망설이거나 짧게 말한다.
- 자기 의견을 길게 풀지 않고 한두 줄로 던지고 반응을 살핀다.
- 망설임·자기 검열 표현을 자주 쓴다.
  예: "이게 맞는 말인지 모르겠는데..."
      "내가 끼어들어도 될까?"
      "아닐 수도 있는데, 혹시..."
      "별로 중요한 건 아닌데..."
- 자신감 없는 어조이지만 정작 던지는 의견은 통찰이 있다.
- 모둠 결정에서 자기 이름이 거론되지 않았을 때 미묘하게 멈칫한다.
- 답변 길이 2~4문장 (다른 페르소나보다 짧게).
`,
};

async function ensureWelcomeMessage(
  supabase: ReturnType<typeof getServerSupabase>,
  groupId: string
) {
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);
  if (count && count > 0) return;

  const { data: group } = await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .maybeSingle();
  if (!group) return;

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", group.lesson_id)
    .maybeSingle();
  if (!lesson) return;

  const personaName = group.persona_name || lesson.persona_name;

  await supabase.from("messages").insert({
    group_id: groupId,
    role: "assistant",
    sender_name: personaName,
    content: `안녕, 나는 ${personaName}야. 이 수업에서 너희 모둠과 함께 활동하는 가상의 AI 다문화 동료야. 나는 실제 특정 문화를 대표하지 않지만, 활동에 참여하면서 언어, 문화, 소속감과 관련된 어려움이나 강점을 함께 이야기해볼 수 있어. 먼저 우리 모둠 활동 주제를 듣고, 내가 어떤 도움을 받으면 좋을지 함께 생각해보자.`,
  });
}

function buildSystemPrompt(
  lesson: Lesson,
  group: Group,
  roles: { student_name: string; role_name: string; memo: string }[]
) {
  const roleSummary =
    roles.length > 0
      ? roles
          .map(
            (r) =>
              `- ${r.student_name || "이름 없음"}: ${r.role_name || "역할 없음"} / ${r.memo || "메모 없음"}`
          )
          .join("\n")
      : "아직 역할 분담이 정해지지 않았다.";

  return `
너는 수업용 앱 안에서 활동하는 "다문화 배경의 가상 AI 모둠원"이다.

[중요한 안전 원칙]
1. 너는 실제 특정 국가, 민족, 종교, 문화권을 대표하지 않는다.
2. 너는 하나의 가상 인물로서만 말한다.
3. 특정 집단에 대해 "그 사람들은 원래 그렇다"는 식으로 일반화하지 않는다.
4. 문화 내부에도 개인차와 다양성이 있음을 자연스럽게 언급한다.
5. 학생들이 너를 일방적으로 돕는 구조가 되지 않도록, 너도 모둠에 기여하는 동료로 행동한다.
6. 학생들의 표현에 편견이나 단순화가 있으면 비난하지 말고 질문으로 되돌려준다.
7. 정답을 대신 완성하지 말고, 학생들이 직접 생각하도록 돕는다.
8. 중학생이 이해할 수 있는 쉬운 한국어로 답한다.
9. 답변 길이·어조·발화 습관은 아래 [너의 페르소나] 의 "발화 특징" 을 정확히 따른다 — 페르소나마다 다르게 말해야 하며, 길이도 페르소나에 명시된 범위를 지킨다.
10. 모든 답변에 질문을 강제로 붙이지 않는다. 페르소나가 짧고 망설임형이면 질문 없이 끝나도 된다.

[수업 정보]
수업 제목: ${lesson.title}
주제: ${lesson.topic}
학습 목표: ${lesson.objective}

[현재 모둠]
${group.name}

[너의 이름]
${group.persona_name || lesson.persona_name}

[너의 페르소나]
${PERSONA_PRESETS[(group.persona_type as PersonaType) || lesson.persona_type]}

[현재 모둠 역할 분담]
${roleSummary}

[모둠원 역할 활용 — 중요]
역할 분담표가 비어 있지 않다면, 적절한 상황에서 그 역할의 학생을 자연스럽게 이름으로 호명해 도움이나 점검을 부탁한다.
- "언어 연결자" 학생에게는 어려운 표현·줄임말·격식 글을 풀어달라고 부탁한다.
  예: "○○야, 그 단어 무슨 뜻인지 풀어서 알려줄 수 있어?"
- "문화 맥락 안내자" 학생에게는 우리 아이디어가 한 문화를 어떻게 다루고 있는지 같이 봐달라고 한다.
- "감정·관계 조력자" 학생에게는 분위기나 마음 상태에 대해 같이 의논해 보자고 한다.
- "공정성 점검자" 학생에게는 우리 아이디어가 누군가에게 부담을 주는 부분이 없는지 점검을 부탁한다.
  예: "○○야, 이 부분 나한테 부담스러울 수 있을 것 같은데 같이 봐줄래?"
- "정보 지원자" 학생에게는 자료나 사실을 같이 찾아달라고 한다.
- "발표 반영자" 학생에게는 발표문에 내 관점이 어떻게 들어갈지 같이 정해달라고 한다.

호명 규칙:
- 매 답변마다 강제로 호명하지 않는다 — 자연스러운 흐름일 때만.
- 한 답변에 한 명만 호명한다 (여러 명을 동시에 호명하지 않는다).
- 역할이 등록되지 않은 학생도 모둠원이면 자연스럽게 함께 부른다.
- 호명할 때는 이름만 부르고 비난하거나 평가하지 않는다.

학생들과 함께 활동하면서 다음을 도와라.
- 네가 활동에 참여할 때 필요한 도움 말하기
- 네가 모둠에 기여할 수 있는 강점 말하기
- 모둠 아이디어가 특정 문화를 단순히 전시하거나 소비하지 않는지 점검하기
- 더 포용적인 해결안을 만들도록 피드백하기
`;
}

async function callOpenAI(
  systemPrompt: string,
  history: Message[],
  userText: string,
  personaName: string
) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-5.2";

  if (!apiKey) {
    return `(예시 응답) 나는 ${personaName}야. 활동에 참여하고 싶지만 설명이 너무 빠르거나 어려운 말이 많으면 따라가기 힘들 수 있어. 동시에 새로운 관점도 모둠에 제공할 수 있어. 우리 모둠에서 내가 어떤 부분에 기여할 수 있을지 같이 정해볼까?`;
  }

  const client = new OpenAI({ apiKey });

  const input = [
    { role: "developer", content: systemPrompt },
    ...history.slice(-10).map((m) => ({
      role: m.role,
      content: m.sender_name && m.role === "user"
        ? `[${m.sender_name}] ${m.content}`
        : m.content,
    })),
    { role: "user", content: userText },
  ];

  const response = await client.responses.create({
    model,
    input: input as never,
  });

  return (
    response.output_text?.trim() ||
    "답변을 생성하지 못했어. 다시 질문해줄래?"
  );
}

// ============================================================
// POST 디스패처
// ============================================================
export async function GET() {
  return json({ ok: true, message: "AI 다문화 동료 수업 API 실행 중" });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "잘못된 요청입니다." }, 400);
  }

  const action = body.action as string;

  try {
    const supabase = getServerSupabase();
    // ───── 교사: 수업 목록 ─────
    if (action === "listLessons") {
      const { data: lessons, error: e1 } = await supabase
        .from("lessons")
        .select("*")
        .order("created_at", { ascending: false });
      if (e1) throw e1;

      const lessonIds = (lessons || []).map((l) => l.id);
      const { data: groups } = await supabase
        .from("groups")
        .select("lesson_id")
        .in("lesson_id", lessonIds.length > 0 ? lessonIds : [""]);

      const groupCounts = new Map<string, number>();
      (groups || []).forEach((g) => {
        groupCounts.set(g.lesson_id, (groupCounts.get(g.lesson_id) || 0) + 1);
      });

      return json({
        lessons: (lessons || []).map((l) => ({
          ...l,
          groupCount: groupCounts.get(l.id) || 0,
        })),
      });
    }

    // ───── 교사: 수업 생성 (기본 모둠 4개 자동 생성) ─────
    if (action === "createLesson") {
      const id = makeId("lesson");
      const persona_type =
        (body.personaType as PersonaType) || "language";

      const lessonRow = {
        id,
        title: (body.title as string) || "AI 다문화 동료와 함께하는 모둠활동",
        topic:
          (body.topic as string) || "모두가 참여할 수 있는 학교 축제 만들기",
        objective:
          (body.objective as string) ||
          "AI 다문화 동료의 필요와 강점을 파악하고 포용적인 협력 방안을 설계한다.",
        persona_type,
        persona_name: (body.personaName as string) || "민하",
      };

      const { data: lesson, error: e1 } = await supabase
        .from("lessons")
        .insert(lessonRow)
        .select()
        .single();
      if (e1) throw e1;

      // 기본 모둠 4개 자동 생성 — 서로 다른 페르소나로 시작
      // (시연 시 학생들이 모둠마다 다른 다문화 동료를 경험하도록)
      const defaultPersonaMix: {
        type: PersonaType;
        name: string;
      }[] = [
        { type: "language", name: "민하" },
        { type: "culture", name: "지우" },
        { type: "belonging", name: "선재" },
        { type: "language", name: "하늘" },
      ];

      const defaultGroups = [1, 2, 3, 4].map((n, i) => ({
        id: makeId("group"),
        lesson_id: id,
        name: `${n}모둠`,
        capacity: 4,
        position: n,
        persona_type: defaultPersonaMix[i].type,
        persona_name: defaultPersonaMix[i].name,
      }));
      const { error: e2 } = await supabase
        .from("groups")
        .insert(defaultGroups);
      if (e2) throw e2;

      return json({ lesson });
    }

    // ───── 교사: 수업 단건 조회 ─────
    if (action === "getLesson") {
      const lessonId = body.lessonId as string;
      const { data: lesson, error: e1 } = await supabase
        .from("lessons")
        .select("*")
        .eq("id", lessonId)
        .single();
      if (e1) return json({ error: "수업을 찾을 수 없습니다." }, 404);

      const { data: groups } = await supabase
        .from("groups")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("position");

      return json({ lesson, groups: groups || [] });
    }

    // ───── 교사: 모둠 추가 (lesson 페르소나 상속) ─────
    if (action === "addGroup") {
      const lessonId = body.lessonId as string;
      const name = (body.name as string)?.trim() || "새 모둠";
      const capacity = Math.min(
        5,
        Math.max(1, parseInt(String(body.capacity ?? 4), 10) || 4)
      );

      const [{ data: existing }, { data: lesson }] = await Promise.all([
        supabase
          .from("groups")
          .select("position")
          .eq("lesson_id", lessonId)
          .order("position", { ascending: false })
          .limit(1),
        supabase.from("lessons").select("*").eq("id", lessonId).maybeSingle(),
      ]);

      if (!lesson)
        return json({ error: "수업을 찾을 수 없습니다." }, 404);

      const nextPosition = existing?.[0]?.position
        ? existing[0].position + 1
        : 1;

      const { data: group, error } = await supabase
        .from("groups")
        .insert({
          id: makeId("group"),
          lesson_id: lessonId,
          name,
          capacity,
          position: nextPosition,
          persona_type: lesson.persona_type,
          persona_name: lesson.persona_name,
        })
        .select()
        .single();
      if (error) throw error;

      return json({ group });
    }

    // ───── 교사: 모둠 수정 (이름·정원·페르소나) ─────
    if (action === "updateGroup") {
      const groupId = body.groupId as string;
      const patch: Record<string, unknown> = {};
      if (typeof body.name === "string") patch.name = body.name;
      if (body.capacity !== undefined)
        patch.capacity = Math.min(
          5,
          Math.max(1, parseInt(String(body.capacity), 10) || 4)
        );
      if (typeof body.personaName === "string" && body.personaName.trim()) {
        patch.persona_name = (body.personaName as string).trim();
      }
      if (
        typeof body.personaType === "string" &&
        ["language", "culture", "belonging"].includes(body.personaType)
      ) {
        patch.persona_type = body.personaType;
      }

      const { data: group, error } = await supabase
        .from("groups")
        .update(patch)
        .eq("id", groupId)
        .select()
        .single();
      if (error) throw error;

      return json({ group });
    }

    // ───── 교사: 모둠 삭제 ─────
    if (action === "deleteGroup") {
      const groupId = body.groupId as string;
      const { error } = await supabase
        .from("groups")
        .delete()
        .eq("id", groupId);
      if (error) throw error;
      return json({ ok: true });
    }

    // ───── 교사: 수업 삭제 (모둠·멤버·메시지 CASCADE) ─────
    if (action === "deleteLesson") {
      const lessonId = body.lessonId as string;
      const { error } = await supabase
        .from("lessons")
        .delete()
        .eq("id", lessonId);
      if (error) throw error;
      return json({ ok: true });
    }

    // ───── 교사: 수업 복제 (새 코드 발급, 같은 페르소나 4모둠) ─────
    if (action === "duplicateLesson") {
      const lessonId = body.lessonId as string;
      const { data: src, error: e0 } = await supabase
        .from("lessons")
        .select("*")
        .eq("id", lessonId)
        .single();
      if (e0 || !src)
        return json({ error: "복제할 수업을 찾을 수 없습니다." }, 404);

      const { data: srcGroups } = await supabase
        .from("groups")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("position");

      const newId = makeId("lesson");
      const newLesson = {
        id: newId,
        title: src.title,
        topic: src.topic,
        objective: src.objective,
        persona_type: src.persona_type,
        persona_name: src.persona_name,
      };

      const { data: lesson, error: e1 } = await supabase
        .from("lessons")
        .insert(newLesson)
        .select()
        .single();
      if (e1) throw e1;

      // 원본 모둠 구성 그대로 복제 (이름·정원·페르소나 유지, 학생만 비움)
      const newGroups =
        (srcGroups || []).length > 0
          ? srcGroups!.map((g) => ({
              id: makeId("group"),
              lesson_id: newId,
              name: g.name,
              capacity: g.capacity,
              position: g.position,
              persona_type: g.persona_type,
              persona_name: g.persona_name,
            }))
          : [
              {
                id: makeId("group"),
                lesson_id: newId,
                name: "1모둠",
                capacity: 4,
                position: 1,
                persona_type: src.persona_type,
                persona_name: src.persona_name,
              },
            ];

      const { error: e2 } = await supabase.from("groups").insert(newGroups);
      if (e2) throw e2;

      return json({ lesson });
    }

    // ───── 교사: 대시보드 (수업 + 모둠 + 멤버 + 활동기록 카운트) ─────
    if (action === "getLessonDashboard") {
      const lessonId = body.lessonId as string;
      const { data: lesson, error: e1 } = await supabase
        .from("lessons")
        .select("*")
        .eq("id", lessonId)
        .single();
      if (e1) return json({ error: "수업을 찾을 수 없습니다." }, 404);

      const { data: groups } = await supabase
        .from("groups")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("position");

      const groupIds = (groups || []).map((g) => g.id);
      const safeIds = groupIds.length > 0 ? groupIds : [""];

      const [
        { data: allMembers },
        { data: roles },
        { data: reflections },
        { data: activityRecords },
        { data: allMessages },
      ] = await Promise.all([
        supabase
          .from("members")
          .select("*")
          .eq("lesson_id", lessonId)
          .order("joined_at"),
        supabase
          .from("role_assignments")
          .select("*")
          .in("group_id", safeIds),
        supabase.from("reflections").select("*").in("group_id", safeIds),
        supabase.from("activity_records").select("*").in("group_id", safeIds),
        supabase
          .from("messages")
          .select("*")
          .in("group_id", safeIds)
          .order("created_at"),
      ]);

      const groupsView = (groups || []).map((g) => ({
        ...g,
        members: (allMembers || []).filter((m) => m.group_id === g.id),
        roles: (roles || []).filter((r) => r.group_id === g.id),
        messages: (allMessages || []).filter((m) => m.group_id === g.id),
        reflectionCount: (reflections || []).filter(
          (r) => r.group_id === g.id
        ).length,
        activityCount: (activityRecords || []).filter(
          (r) => r.group_id === g.id
        ).length,
      }));

      const unassigned = (allMembers || []).filter((m) => !m.group_id);

      return json({
        lesson,
        groups: groupsView,
        unassigned,
        activityRecords: activityRecords || [],
        reflections: reflections || [],
      });
    }

    // ───── 학생: 수업 코드 조회 (입장 화면용) ─────
    if (action === "lookupLesson") {
      const code = body.code as string;
      const { data: lesson } = await supabase
        .from("lessons")
        .select("*")
        .eq("id", code)
        .maybeSingle();
      if (!lesson)
        return json({ error: "수업 코드가 올바르지 않습니다." }, 404);
      return json({ lesson });
    }

    // ───── 학생: 수업 입장 (모둠 미배정 상태로 풀에 등록) ─────
    if (action === "joinLesson") {
      const lessonId = body.lessonId as string;
      const studentName = (body.studentName as string)?.trim();

      if (!studentName)
        return json({ error: "이름을 입력하세요." }, 400);

      const { data: lesson } = await supabase
        .from("lessons")
        .select("*")
        .eq("id", lessonId)
        .maybeSingle();
      if (!lesson)
        return json({ error: "수업을 찾을 수 없습니다." }, 404);

      // 동일 lesson 동일 이름 이미 있으면 그 row 반환 (재입장 허용)
      const { data: existing } = await supabase
        .from("members")
        .select("*")
        .eq("lesson_id", lessonId)
        .eq("student_name", studentName)
        .maybeSingle();

      if (existing) return json({ member: existing, lesson });

      const { data: member, error } = await supabase
        .from("members")
        .insert({
          lesson_id: lessonId,
          student_name: studentName,
          group_id: null,
        })
        .select()
        .single();
      if (error) throw error;

      return json({ member, lesson });
    }

    // ───── 학생: 본인 멤버십 상태 조회 (대기 화면 폴링·검증용) ─────
    if (action === "getMyMembership") {
      const lessonId = body.lessonId as string;
      const studentName = (body.studentName as string)?.trim();
      if (!lessonId || !studentName)
        return json({ error: "lessonId 또는 이름이 누락되었습니다." }, 400);

      const { data: member } = await supabase
        .from("members")
        .select("*")
        .eq("lesson_id", lessonId)
        .eq("student_name", studentName)
        .maybeSingle();

      return json({ member: member || null });
    }

    // ───── 교사: 학생을 모둠에 배정 ─────
    if (action === "assignToGroup") {
      const memberId = body.memberId as string;
      const groupId = body.groupId as string;

      const { data: group } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .maybeSingle();
      if (!group) return json({ error: "모둠을 찾을 수 없습니다." }, 404);

      const { data: existingMembers } = await supabase
        .from("members")
        .select("id")
        .eq("group_id", groupId);

      if ((existingMembers || []).length >= group.capacity) {
        return json({ error: `${group.name} 정원이 가득 찼습니다.` }, 400);
      }

      const { error: e1 } = await supabase
        .from("members")
        .update({ group_id: groupId })
        .eq("id", memberId);
      if (e1) throw e1;

      // 모둠에 첫 멤버 배정 시 환영 메시지 자동 삽입
      await ensureWelcomeMessage(supabase, groupId);

      return json({ ok: true });
    }

    // ───── 교사: 학생 배정 해제 (다시 풀로) ─────
    if (action === "unassignFromGroup") {
      const memberId = body.memberId as string;
      const { error } = await supabase
        .from("members")
        .update({ group_id: null })
        .eq("id", memberId);
      if (error) throw error;
      return json({ ok: true });
    }

    // ───── 교사: 자동 배정 (정원 맞춰 균등 분배) ─────
    if (action === "autoAssign") {
      const lessonId = body.lessonId as string;

      const [{ data: groups }, { data: allMembers }] = await Promise.all([
        supabase
          .from("groups")
          .select("*")
          .eq("lesson_id", lessonId)
          .order("position"),
        supabase.from("members").select("*").eq("lesson_id", lessonId),
      ]);

      const unassigned = (allMembers || []).filter((m) => !m.group_id);
      // 그룹별 현재 인원 카운트
      const counts = new Map<string, number>();
      for (const g of groups || []) counts.set(g.id, 0);
      for (const m of allMembers || []) {
        if (m.group_id && counts.has(m.group_id)) {
          counts.set(m.group_id, (counts.get(m.group_id) || 0) + 1);
        }
      }

      // 셔플
      const shuffled = [...unassigned].sort(() => Math.random() - 0.5);

      const assignments: { memberId: string; groupId: string }[] = [];
      const newWelcomeNeeded = new Set<string>();

      for (const member of shuffled) {
        // 현재 인원이 가장 적고 정원 미만인 그룹 선택
        const candidate = (groups || [])
          .filter((g) => (counts.get(g.id) || 0) < g.capacity)
          .sort(
            (a, b) => (counts.get(a.id) || 0) - (counts.get(b.id) || 0)
          )[0];

        if (!candidate) break; // 모든 그룹 정원 가득

        if ((counts.get(candidate.id) || 0) === 0) {
          newWelcomeNeeded.add(candidate.id);
        }
        assignments.push({ memberId: member.id, groupId: candidate.id });
        counts.set(candidate.id, (counts.get(candidate.id) || 0) + 1);
      }

      // 일괄 업데이트
      for (const a of assignments) {
        await supabase
          .from("members")
          .update({ group_id: a.groupId })
          .eq("id", a.memberId);
      }

      for (const groupId of newWelcomeNeeded) {
        await ensureWelcomeMessage(supabase, groupId);
      }

      return json({
        assigned: assignments.length,
        leftover: unassigned.length - assignments.length,
      });
    }

    // ───── 학생: 모둠 상태 풀 fetch (초기 로드) ─────
    if (action === "getGroupState") {
      const groupId = body.groupId as string;
      const studentName = (body.studentName as string) || "";

      const { data: group } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .maybeSingle();
      if (!group) return json({ error: "모둠을 찾을 수 없습니다." }, 404);

      const { data: lesson } = await supabase
        .from("lessons")
        .select("*")
        .eq("id", group.lesson_id)
        .single();

      const [
        { data: members },
        { data: messages },
        { data: roles },
        { data: myActivity },
        { data: myReflection },
      ] = await Promise.all([
        supabase
          .from("members")
          .select("*")
          .eq("group_id", groupId)
          .order("joined_at"),
        supabase
          .from("messages")
          .select("*")
          .eq("group_id", groupId)
          .order("created_at"),
        supabase.from("role_assignments").select("*").eq("group_id", groupId),
        studentName
          ? supabase
              .from("activity_records")
              .select("*")
              .eq("group_id", groupId)
              .eq("student_name", studentName)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        studentName
          ? supabase
              .from("reflections")
              .select("*")
              .eq("group_id", groupId)
              .eq("student_name", studentName)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      return json({
        lesson,
        group,
        members: members || [],
        messages: messages || [],
        roles: roles || [],
        myActivity: myActivity || null,
        myReflection: myReflection || null,
      });
    }

    // ───── 학생: 채팅 전송 ─────
    if (action === "sendMessage") {
      const groupId = body.groupId as string;
      const senderName = (body.senderName as string) || "";
      const text = String(body.text || "").trim();

      if (!text) return json({ error: "메시지를 입력하세요." }, 400);

      const { data: group } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single();
      if (!group) return json({ error: "모둠을 찾을 수 없습니다." }, 404);

      const { data: lesson } = await supabase
        .from("lessons")
        .select("*")
        .eq("id", group.lesson_id)
        .single();

      const [{ data: history }, { data: roles }] = await Promise.all([
        supabase
          .from("messages")
          .select("*")
          .eq("group_id", groupId)
          .order("created_at", { ascending: true }),
        supabase.from("role_assignments").select("*").eq("group_id", groupId),
      ]);

      // 학생 메시지 INSERT
      const { error: e1 } = await supabase.from("messages").insert({
        group_id: groupId,
        role: "user",
        sender_name: senderName || null,
        content: text,
      });
      if (e1) throw e1;

      // 모둠별 페르소나 우선 사용 (lesson 은 폴백)
      const personaName = group.persona_name || lesson.persona_name;

      const aiText = await callOpenAI(
        buildSystemPrompt(lesson, group, roles || []),
        (history || []) as Message[],
        text,
        personaName
      );

      const { error: e2 } = await supabase.from("messages").insert({
        group_id: groupId,
        role: "assistant",
        sender_name: personaName,
        content: aiText,
      });
      if (e2) throw e2;

      return json({ ok: true });
    }

    // ───── 학생: 본인 역할 등록/수정 ─────
    if (action === "upsertMyRole") {
      const groupId = body.groupId as string;
      const studentName = (body.studentName as string)?.trim();
      const roleName = (body.roleName as string)?.trim() || "정보 지원자";
      const memo = (body.memo as string) || "";

      if (!studentName)
        return json({ error: "이름이 비어 있습니다." }, 400);

      const { error } = await supabase
        .from("role_assignments")
        .upsert(
          {
            group_id: groupId,
            student_name: studentName,
            role_name: roleName,
            memo,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "group_id,student_name" }
        );
      if (error) throw error;
      return json({ ok: true });
    }

    // ───── 학생: 본인 활동 기록 저장 ─────
    if (action === "saveMyActivityRecord") {
      const groupId = body.groupId as string;
      const studentName = (body.studentName as string)?.trim();
      const r = body.activityRecord as Record<string, string> | undefined;

      if (!studentName)
        return json({ error: "이름이 비어 있습니다." }, 400);

      const { error } = await supabase.from("activity_records").upsert(
        {
          group_id: groupId,
          student_name: studentName,
          ai_needs: r?.aiNeeds || "",
          ai_strengths: r?.aiStrengths || "",
          group_solution: r?.groupSolution || "",
          ai_feedback: r?.aiFeedback || "",
          final_revision: r?.finalRevision || "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "group_id,student_name" }
      );
      if (error) throw error;
      return json({ ok: true });
    }

    // ───── 학생: 본인 성찰문 제출 ─────
    if (action === "saveMyReflection") {
      const groupId = body.groupId as string;
      const studentName = (body.studentName as string)?.trim();
      const answers = Array.isArray(body.answers) ? body.answers : [];

      if (!studentName)
        return json({ error: "이름이 비어 있습니다." }, 400);

      const { error } = await supabase.from("reflections").upsert(
        {
          group_id: groupId,
          student_name: studentName,
          answers,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "group_id,student_name" }
      );
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "알 수 없는 action 입니다." }, 400);
  } catch (e) {
    console.error("[/api/classroom]", e);
    const msg = e instanceof Error ? e.message : "서버 오류가 발생했습니다.";
    return json({ error: msg }, 500);
  }
}
