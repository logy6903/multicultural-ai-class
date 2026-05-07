"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase";

type Lesson = {
  id: string;
  title: string;
  topic: string;
  objective: string;
  persona_type: string;
  persona_name: string;
};

type Group = {
  id: string;
  lesson_id: string;
  name: string;
  capacity: number;
  position: number;
  persona_type?: string;
  persona_name?: string;
};

type Member = {
  id: string;
  lesson_id: string;
  group_id: string | null;
  student_name: string;
};

type Message = {
  id: string;
  group_id: string;
  role: "user" | "assistant";
  sender_name: string | null;
  content: string;
  created_at: string;
};

type RoleAssignment = {
  group_id: string;
  student_name: string;
  role_name: string;
  memo: string;
};

type ActivityRecord = {
  ai_needs: string;
  ai_strengths: string;
  group_solution: string;
  ai_feedback: string;
  final_revision: string;
};

type Step = "code" | "name" | "waiting" | "room";
type LeftTab = "overview" | "chat" | "roles";
type RightTab = "activity" | "reflection";

async function api(action: string, payload: Record<string, unknown> = {}) {
  const res = await fetch("/api/classroom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "요청 실패");
  return data;
}

const questionCards = [
  "이 활동에서 가장 낯설게 느껴지는 부분은 뭐야?",
  "우리가 어떤 도움을 주면 참여하기 편할까?",
  "네가 우리 모둠에 기여할 수 있는 점은 뭐야?",
  "우리 아이디어 중 부담스러운 부분이 있어?",
  "특정 문화를 너무 단순하게 표현한 부분이 있을까?",
  "더 포용적으로 만들려면 무엇을 바꾸면 좋을까?",
];

const roleOptions = [
  "언어 연결자",
  "문화 맥락 안내자",
  "감정·관계 조력자",
  "정보 지원자",
  "공정성 점검자",
  "발표 반영자",
];

const reflectionQuestions = [
  "처음에 나는 AI 다문화 동료에게 어떤 도움이 필요할 것이라고 예상했나요?",
  "실제 대화를 해보니 내 예상과 달랐던 점은 무엇이었나요?",
  "내가 맡은 역할은 AI 동료의 참여에 어떤 도움을 주었나요?",
  "혹시 상대의 필요를 묻지 않고 미리 판단한 부분은 없었나요?",
  "‘도움’은 일방적으로 베푸는 것이 아니라 함께 참여할 조건을 만드는 일이라는 말의 의미는 무엇인가요?",
  "실제 학급 친구와 협력할 때 내가 실천할 수 있는 태도는 무엇인가요?",
];

const emptyActivity: ActivityRecord = {
  ai_needs: "",
  ai_strengths: "",
  group_solution: "",
  ai_feedback: "",
  final_revision: "",
};

export default function GroupPage() {
  // ── 입장 흐름 ──────────────────────────────
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState("");
  const [studentName, setStudentName] = useState("");

  // ── 활동방 상태 ──────────────────────────────
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [roles, setRoles] = useState<RoleAssignment[]>([]);
  const [myActivity, setMyActivity] = useState<ActivityRecord>(emptyActivity);
  const [myReflection, setMyReflection] = useState<string[]>(
    reflectionQuestions.map(() => "")
  );

  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState("");

  const [leftTab, setLeftTab] = useState<LeftTab>("overview");
  const [rightTab, setRightTab] = useState<RightTab>("activity");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  function flash(msg: string) {
    setSavedFlash(msg);
    setTimeout(() => setSavedFlash(""), 1800);
  }

  // ── URL ?code= 자동 입력 ──────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get("code");
    if (urlCode) {
      setCode(urlCode);
      void lookupLesson(urlCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookupLesson(c: string) {
    try {
      setError("");
      const data = await api("lookupLesson", { code: c });
      setLesson(data.lesson);
      setStep("name");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  }

  async function joinLesson() {
    if (!lesson || !studentName.trim()) {
      setError("이름을 입력하세요.");
      return;
    }
    try {
      setError("");
      const data = await api("joinLesson", {
        lessonId: lesson.id,
        studentName: studentName.trim(),
      });
      setMember(data.member);
      if (data.member.group_id) {
        await loadGroupAndEnter(data.member.group_id, data.member.student_name);
      } else {
        setStep("waiting");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  }

  async function loadGroupAndEnter(groupId: string, sname: string) {
    const state = await api("getGroupState", {
      groupId,
      studentName: sname,
    });
    setLesson(state.lesson);
    setGroup(state.group);
    setMembers(state.members);
    setMessages(state.messages);
    setRoles(state.roles);
    if (state.myActivity) {
      setMyActivity({
        ai_needs: state.myActivity.ai_needs || "",
        ai_strengths: state.myActivity.ai_strengths || "",
        group_solution: state.myActivity.group_solution || "",
        ai_feedback: state.myActivity.ai_feedback || "",
        final_revision: state.myActivity.final_revision || "",
      });
    }
    if (state.myReflection?.answers) {
      setMyReflection(
        reflectionQuestions.map(
          (_, i) => state.myReflection.answers[i] || ""
        )
      );
    }
    setStep("room");
  }

  // ── 대기 단계: 본인 멤버십 변경 구독 ──────────────────────────────
  useEffect(() => {
    if (step !== "waiting" || !member) return;

    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`waiting-${member.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "members",
          filter: `id=eq.${member.id}`,
        },
        (payload) => {
          const next = payload.new as Member;
          if (next.group_id) {
            setMember(next);
            void loadGroupAndEnter(next.group_id, next.student_name);
          }
        }
      )
      .subscribe();

    // 폴링 보조 (Realtime 누락 대비, 5초마다)
    const poll = setInterval(async () => {
      try {
        const data = await api("getMyMembership", {
          lessonId: member.lesson_id,
          studentName: member.student_name,
        });
        if (data.member?.group_id) {
          setMember(data.member);
          void loadGroupAndEnter(
            data.member.group_id,
            data.member.student_name
          );
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, member?.id]);

  // ── 활동방 단계: 모둠 단위 Realtime 구독 ──────────────────────────────
  useEffect(() => {
    if (step !== "room" || !group) return;

    const supabase = getBrowserSupabase();
    const filter = `group_id=eq.${group.id}`;

    const channel = supabase
      .channel(`group-${group.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter },
        (payload) => {
          setMessages((prev) => {
            const m = payload.new as Message;
            if (prev.find((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "role_assignments",
          filter,
        },
        async () => {
          const { data } = await supabase
            .from("role_assignments")
            .select("*")
            .eq("group_id", group.id);
          setRoles((data as RoleAssignment[]) || []);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "members", filter },
        async () => {
          const { data } = await supabase
            .from("members")
            .select("*")
            .eq("group_id", group.id)
            .order("joined_at");
          setMembers((data as Member[]) || []);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [step, group]);

  // 메시지 도착 시 스크롤 하단으로
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── 액션 ──────────────────────────────
  async function sendMessage(text?: string) {
    const messageText = (text ?? chatInput).trim();
    if (!group || !messageText) return;
    try {
      setLoading(true);
      setError("");
      setChatInput("");
      await api("sendMessage", {
        groupId: group.id,
        senderName: studentName,
        text: messageText,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  async function saveMyRole(roleName: string, memo: string) {
    if (!group) return;
    try {
      await api("upsertMyRole", {
        groupId: group.id,
        studentName,
        roleName,
        memo,
      });
      flash("역할 저장됨");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  }

  async function saveMyActivity() {
    if (!group) return;
    try {
      await api("saveMyActivityRecord", {
        groupId: group.id,
        studentName,
        activityRecord: {
          aiNeeds: myActivity.ai_needs,
          aiStrengths: myActivity.ai_strengths,
          groupSolution: myActivity.group_solution,
          aiFeedback: myActivity.ai_feedback,
          finalRevision: myActivity.final_revision,
        },
      });
      flash("활동 기록 저장됨");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  }

  async function saveMyReflection() {
    if (!group) return;
    try {
      await api("saveMyReflection", {
        groupId: group.id,
        studentName,
        answers: myReflection,
      });
      flash("성찰문 제출됨");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  }

  const myRole = useMemo(
    () => roles.find((r) => r.student_name === studentName),
    [roles, studentName]
  );

  // ============================================================
  // 단계별 화면
  // ============================================================
  if (step === "code") {
    return (
      <EntryShell error={error}>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">학생 입장</h1>
        <p className="mt-2 text-sm text-slate-600">
          선생님이 안내한 수업 코드를 입력하세요.
        </p>
        <label className="mt-6 block">
          <span className="mb-1 block text-xs font-semibold">수업 코드</span>
          <input
            className="w-full rounded-xl border border-slate-200 p-3 font-mono text-sm"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="lesson_xxxxxxxx"
          />
        </label>
        <button
          onClick={() => lookupLesson(code)}
          disabled={!code.trim()}
          className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          다음
        </button>
      </EntryShell>
    );
  }

  if (step === "name" && lesson) {
    return (
      <EntryShell error={error}>
        <p className="text-xs font-semibold text-indigo-600">{lesson.title}</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">이름 입력</h1>
        <p className="mt-2 text-sm text-slate-600">
          모둠에서 표시될 자기 이름을 입력하세요. 선생님이 모둠을 배정해
          드릴 거예요.
        </p>

        <label className="mt-5 block">
          <span className="mb-1 block text-xs font-semibold">이름</span>
          <input
            className="w-full rounded-xl border border-slate-200 p-3 text-sm"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="홍길동"
            onKeyDown={(e) => e.key === "Enter" && joinLesson()}
            autoFocus
          />
        </label>

        <button
          onClick={joinLesson}
          disabled={!studentName.trim()}
          className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          입장
        </button>
        <button
          onClick={() => setStep("code")}
          className="mt-2 w-full text-xs text-slate-500 hover:underline"
        >
          ← 코드 다시 입력
        </button>
      </EntryShell>
    );
  }

  if (step === "waiting" && lesson && member) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <section className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-full bg-indigo-100" />
          <p className="text-xs font-semibold text-indigo-600">
            {lesson.title}
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-900">
            모둠 배정 대기 중
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            <strong className="text-slate-900">{member.student_name}</strong>
            님,<br />
            선생님이 모둠을 정해 주실 때까지 잠시만 기다려 주세요.<br />
            배정되면 자동으로 활동방으로 이동합니다.
          </p>
          <p className="mt-4 text-[11px] text-slate-400">
            화면을 닫지 마세요. 자동으로 새로고침됩니다.
          </p>
        </section>
      </main>
    );
  }

  if (!lesson || !group || step !== "room") return null;

  // ============================================================
  // 활동방 (16:9 풀화면)
  // 좌: 공유(개요·채팅·역할 분담)  우: 개인(활동 기록·성찰문)
  // ============================================================
  const leftTabs: { id: LeftTab; label: string }[] = [
    { id: "overview", label: "개요" },
    { id: "chat", label: "채팅" },
    { id: "roles", label: "역할 분담" },
  ];
  const rightTabs: { id: RightTab; label: string }[] = [
    { id: "activity", label: "활동 기록" },
    { id: "reflection", label: "성찰문" },
  ];

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-slate-50">
      {/* 헤더 */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="text-xs text-slate-500 hover:underline">
            ← 처음
          </Link>
          <span className="text-slate-300">|</span>
          <h1 className="truncate text-sm font-bold text-slate-900">
            {group.name}
          </h1>
          <span className="hidden truncate text-xs text-slate-500 md:inline">
            · {lesson.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            나: <strong className="text-slate-700">{studentName}</strong>
          </span>
          <span className="text-xs text-slate-400">|</span>
          <span className="text-xs text-slate-500">
            모둠원 {members.length}/{group.capacity}
          </span>
          {savedFlash && (
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
              {savedFlash}
            </span>
          )}
        </div>
      </header>

      {error && (
        <div className="shrink-0 bg-red-50 px-4 py-1.5 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* 본문 16:9 */}
      <div className="grid min-h-0 flex-1 grid-cols-[1.3fr_1fr] gap-3 p-3">
        {/* 좌: 공유 (개요 / 채팅 / 역할 분담) */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex shrink-0 border-b border-slate-200">
            {leftTabs.map((t) => (
              <TabButton
                key={t.id}
                active={leftTab === t.id}
                onClick={() => setLeftTab(t.id)}
              >
                {t.label}
              </TabButton>
            ))}
          </div>

          {/* 개요 */}
          {leftTab === "overview" && (
            <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
              <div className="mb-3 rounded-xl bg-indigo-50 p-3 text-xs leading-6 text-indigo-950">
                나는 실제 특정 국가나 문화를 대표하지 않는 가상의 AI 모둠원
                입니다. 도움을 받기도 하지만, 동시에 새로운 관점을 모둠에
                제공할 수 있는 동료입니다.
              </div>
              <Field
                label="AI 동료 이름"
                value={group.persona_name || lesson.persona_name}
              />
              <Field label="수업 주제" value={lesson.topic} />
              <Field label="학습 목표" value={lesson.objective} />
              <div className="mt-2">
                <p className="mb-1 text-xs font-bold text-slate-700">
                  현재 모둠원
                </p>
                <ul className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  {members.length === 0 ? (
                    <li>아직 입장한 모둠원이 없습니다.</li>
                  ) : (
                    members.map((m) => {
                      const r = roles.find(
                        (x) => x.student_name === m.student_name
                      );
                      return (
                        <li key={m.id}>
                          • {m.student_name}
                          {r ? ` — ${r.role_name}` : ""}
                          {m.student_name === studentName ? " (나)" : ""}
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* 채팅 (공유) */}
          {leftTab === "chat" && (
            <>
              <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-indigo-50 px-3 py-1.5">
                <span className="text-xs font-semibold text-indigo-600">
                  AI 다문화 동료
                </span>
                <span className="text-xs font-bold text-slate-900">
                  {group.persona_name || lesson.persona_name}
                </span>
                <span className="ml-auto text-[11px] text-slate-500">
                  모둠 공유 · 실시간
                </span>
              </div>

              <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-slate-100 px-3 py-2">
                {questionCards.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    disabled={loading}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs hover:bg-slate-200 disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-xl p-3 text-sm leading-6 ${
                      m.role === "assistant"
                        ? "bg-slate-50 text-slate-800"
                        : m.sender_name === studentName
                          ? "ml-auto max-w-[85%] bg-slate-900 text-white"
                          : "ml-auto max-w-[85%] bg-indigo-600 text-white"
                    }`}
                  >
                    <p className="mb-0.5 text-[10px] font-bold opacity-70">
                      {m.role === "assistant"
                        ? m.sender_name ||
                          group.persona_name ||
                          lesson.persona_name
                        : m.sender_name || "익명"}
                      {m.sender_name === studentName ? " (나)" : ""}
                    </p>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                ))}
                {loading && (
                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                    AI 동료가 답변을 작성하고 있습니다...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="flex shrink-0 gap-2 border-t border-slate-200 p-2">
                <input
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="AI 동료에게 질문하거나 모둠 의견을 적어보세요."
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={loading}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  보내기
                </button>
              </div>
            </>
          )}

          {/* 역할 분담 (공유) */}
          {leftTab === "roles" && (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <p className="mb-3 text-xs leading-5 text-slate-600">
                각자 자기 역할을 등록·수정합니다. 실시간으로 모둠원에게 공유됩니다.
              </p>

              <MyRoleEditor
                myRole={myRole}
                onSave={(role, memo) => saveMyRole(role, memo)}
              />

              <div className="mt-4">
                <p className="mb-2 text-xs font-bold text-slate-700">
                  모둠원 역할
                </p>
                {members.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    아직 입장한 모둠원이 없습니다.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {members.map((m) => {
                      const r = roles.find(
                        (x) => x.student_name === m.student_name
                      );
                      return (
                        <li
                          key={m.id}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                        >
                          <div className="font-bold text-slate-900">
                            {m.student_name}
                            {m.student_name === studentName ? " (나)" : ""}
                          </div>
                          <div className="text-slate-600">
                            {r ? (
                              <>
                                <span className="font-semibold">
                                  {r.role_name}
                                </span>
                                {r.memo && (
                                  <span className="text-slate-500">
                                    {" "}
                                    — {r.memo}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-slate-400">미등록</span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>

        {/* 우: 개인 (활동 기록 / 성찰문) */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex shrink-0 border-b border-slate-200">
            {rightTabs.map((t) => (
              <TabButton
                key={t.id}
                active={rightTab === t.id}
                onClick={() => setRightTab(t.id)}
              >
                {t.label}
              </TabButton>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {rightTab === "activity" && (
              <div className="space-y-3">
                <p className="text-xs leading-5 text-slate-500">
                  활동 기록은 본인만 볼 수 있고 교사에게만 제출됩니다.
                </p>

                <CompactTextarea
                  label="AI 동료가 필요로 한 도움"
                  value={myActivity.ai_needs}
                  onChange={(v) =>
                    setMyActivity((p) => ({ ...p, ai_needs: v }))
                  }
                />
                <CompactTextarea
                  label="AI 동료가 기여할 수 있는 강점"
                  value={myActivity.ai_strengths}
                  onChange={(v) =>
                    setMyActivity((p) => ({ ...p, ai_strengths: v }))
                  }
                />
                <CompactTextarea
                  label="우리 모둠의 해결안"
                  value={myActivity.group_solution}
                  onChange={(v) =>
                    setMyActivity((p) => ({ ...p, group_solution: v }))
                  }
                />
                <CompactTextarea
                  label="AI 동료에게 받은 피드백"
                  value={myActivity.ai_feedback}
                  onChange={(v) =>
                    setMyActivity((p) => ({ ...p, ai_feedback: v }))
                  }
                />
                <CompactTextarea
                  label="최종 수정 내용"
                  value={myActivity.final_revision}
                  onChange={(v) =>
                    setMyActivity((p) => ({ ...p, final_revision: v }))
                  }
                />
                <button
                  onClick={saveMyActivity}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
                >
                  활동 기록 저장
                </button>
              </div>
            )}

            {rightTab === "reflection" && (
              <div className="space-y-3">
                <p className="text-xs leading-5 text-slate-500">
                  성찰문은 본인만 볼 수 있고 교사에게만 제출됩니다.
                </p>

                {reflectionQuestions.map((q, idx) => (
                  <label key={q} className="block">
                    <span className="mb-1 block text-xs font-bold leading-5">
                      {idx + 1}. {q}
                    </span>
                    <textarea
                      className="h-16 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                      value={myReflection[idx]}
                      onChange={(e) =>
                        setMyReflection((prev) =>
                          prev.map((a, i) => (i === idx ? e.target.value : a))
                        )
                      }
                    />
                  </label>
                ))}

                <button
                  onClick={saveMyReflection}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
                >
                  성찰문 제출
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

// ============================================================
// 하위 컴포넌트
// ============================================================
function EntryShell({
  children,
  error,
}: {
  children: React.ReactNode;
  error: string;
}) {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <section className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-sm">
        <Link href="/" className="text-sm text-slate-500 hover:underline">
          ← 처음으로
        </Link>
        {error && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}
        {children}
      </section>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
        active
          ? "border-indigo-600 text-indigo-600"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2">
      <p className="mb-1 text-xs font-bold text-slate-700">{label}</p>
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-6 text-slate-700">
        {value}
      </p>
    </div>
  );
}

function CompactTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold">{label}</span>
      <textarea
        className="h-16 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function MyRoleEditor({
  myRole,
  onSave,
}: {
  myRole: RoleAssignment | undefined;
  onSave: (roleName: string, memo: string) => void;
}) {
  const [roleName, setRoleName] = useState(myRole?.role_name || roleOptions[0]);
  const [memo, setMemo] = useState(myRole?.memo || "");

  useEffect(() => {
    if (myRole) {
      setRoleName(myRole.role_name);
      setMemo(myRole.memo);
    }
  }, [myRole?.role_name, myRole?.memo]);

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
      <p className="mb-2 text-xs font-bold text-indigo-900">내 역할 등록</p>
      <div className="grid gap-2 md:grid-cols-[1fr_2fr]">
        <select
          value={roleName}
          onChange={(e) => setRoleName(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
        >
          {roleOptions.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="구체적으로 할 일"
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
        />
      </div>
      <button
        onClick={() => onSave(roleName, memo)}
        className="mt-2 w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
      >
        내 역할 저장
      </button>
    </div>
  );
}
