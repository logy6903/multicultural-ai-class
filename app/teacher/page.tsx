"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase";

type Lesson = {
  id: string;
  title: string;
  topic: string;
  objective: string;
  persona_type: string;
  persona_name: string;
  created_at: string;
  groupCount?: number;
};

type Group = {
  id: string;
  lesson_id: string;
  name: string;
  capacity: number;
  position: number;
  persona_type: "language" | "culture" | "belonging";
  persona_name: string;
};

type Member = {
  id: string;
  lesson_id: string;
  group_id: string | null;
  student_name: string;
  joined_at: string;
};

type ActivityRecord = {
  group_id: string;
  student_name: string;
  ai_needs: string;
  ai_strengths: string;
  group_solution: string;
  ai_feedback: string;
  final_revision: string;
  updated_at: string;
};

type Reflection = {
  group_id: string;
  student_name: string;
  answers: string[];
  updated_at: string;
};

const reflectionQuestions = [
  "처음에 나는 AI 다문화 동료에게 어떤 도움이 필요할 것이라고 예상했나요?",
  "실제 대화를 해보니 내 예상과 달랐던 점은 무엇이었나요?",
  "내가 맡은 역할은 AI 동료의 참여에 어떤 도움을 주었나요?",
  "혹시 상대의 필요를 묻지 않고 미리 판단한 부분은 없었나요?",
  "‘도움’은 일방적으로 베푸는 것이 아니라 함께 참여할 조건을 만드는 일이라는 말의 의미는 무엇인가요?",
  "실제 학급 친구와 협력할 때 내가 실천할 수 있는 태도는 무엇인가요?",
];

type Role = {
  group_id: string;
  student_name: string;
  role_name: string;
};

type GroupView = Group & {
  members: Member[];
  roles: Role[];
  reflectionCount: number;
  activityCount: number;
};

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

export default function TeacherPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [groups, setGroups] = useState<GroupView[]>([]);
  const [unassigned, setUnassigned] = useState<Member[]>([]);
  const [activityRecords, setActivityRecords] = useState<ActivityRecord[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [viewingStudent, setViewingStudent] = useState<Member | null>(null);

  const [title, setTitle] = useState("AI 다문화 동료와 함께하는 모둠활동");
  const [topic, setTopic] = useState("모두가 참여할 수 있는 학교 축제 만들기");
  const [objective, setObjective] = useState(
    "AI 다문화 동료의 필요와 강점을 파악하고 포용적인 협력 방안을 설계한다."
  );

  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState("");

  function flash(msg: string) {
    setSavedFlash(msg);
    setTimeout(() => setSavedFlash(""), 1800);
  }

  async function loadLessons() {
    try {
      const data = await api("listLessons");
      setLessons(data.lessons);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  }

  async function refreshDashboard(lessonId: string) {
    try {
      const data = await api("getLessonDashboard", { lessonId });
      setSelectedLesson(data.lesson);
      setGroups(data.groups);
      setUnassigned(data.unassigned || []);
      setActivityRecords(data.activityRecords || []);
      setReflections(data.reflections || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  }

  async function createLesson() {
    try {
      setError("");
      const data = await api("createLesson", {
        title,
        topic,
        objective,
      });
      await loadLessons();
      await refreshDashboard(data.lesson.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  }

  async function addGroup() {
    if (!selectedLesson) return;
    const nextNum =
      groups.length > 0
        ? Math.max(...groups.map((g) => g.position)) + 1
        : 1;
    try {
      await api("addGroup", {
        lessonId: selectedLesson.id,
        name: `${nextNum}모둠`,
        capacity: 4,
      });
      await refreshDashboard(selectedLesson.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  }

  async function updateGroup(
    groupId: string,
    patch: {
      name?: string;
      capacity?: number;
      personaName?: string;
      personaType?: string;
    }
  ) {
    try {
      await api("updateGroup", { groupId, ...patch });
      if (selectedLesson) await refreshDashboard(selectedLesson.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  }

  async function deleteGroup(groupId: string) {
    if (!selectedLesson) return;
    if (!confirm("모둠을 삭제할까요? 모둠 안의 데이터도 함께 삭제됩니다.")) return;
    try {
      await api("deleteGroup", { groupId });
      await refreshDashboard(selectedLesson.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  }

  async function regenerateCode() {
    if (!selectedLesson) return;
    if (
      !confirm(
        "현재 수업의 구성을 그대로 복제해 새 코드를 발급합니다. 진행할까요?"
      )
    )
      return;
    try {
      const res = await api("duplicateLesson", { lessonId: selectedLesson.id });
      await loadLessons();
      await refreshDashboard(res.lesson.id);
      flash(`새 코드 발급: ${res.lesson.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  }

  async function deleteLesson() {
    if (!selectedLesson) return;
    if (
      !confirm(
        `'${selectedLesson.title}' 수업을 삭제할까요? 모둠·학생·채팅 모두 함께 삭제됩니다.`
      )
    )
      return;
    try {
      await api("deleteLesson", { lessonId: selectedLesson.id });
      setSelectedLesson(null);
      setGroups([]);
      setUnassigned([]);
      await loadLessons();
      flash("수업 삭제됨");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  }

  async function assignMember(memberId: string, groupId: string) {
    if (!selectedLesson || !groupId) return;
    try {
      await api("assignToGroup", { memberId, groupId });
      flash("배정 완료");
      await refreshDashboard(selectedLesson.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  }

  async function unassignMember(memberId: string) {
    if (!selectedLesson) return;
    try {
      await api("unassignFromGroup", { memberId });
      flash("배정 해제");
      await refreshDashboard(selectedLesson.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  }

  async function autoAssignAll() {
    if (!selectedLesson) return;
    if (
      !confirm(
        "미배정 학생을 정원이 남은 모둠에 무작위로 분배합니다. 진행할까요?"
      )
    )
      return;
    try {
      const res = await api("autoAssign", { lessonId: selectedLesson.id });
      flash(
        `자동 배정 완료: ${res.assigned}명 배정${
          res.leftover ? ` (정원 부족 ${res.leftover}명 잔여)` : ""
        }`
      );
      await refreshDashboard(selectedLesson.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  }

  useEffect(() => {
    loadLessons();
  }, []);

  // 선택한 수업의 변경을 Realtime 으로 즉시 반영
  // members / role_assignments / reflections 변경 시 대시보드 재조회
  useEffect(() => {
    if (!selectedLesson) return;
    const lessonId = selectedLesson.id;
    const supabase = getBrowserSupabase();

    const refetch = () => refreshDashboard(lessonId);

    const channel = supabase
      .channel(`teacher-${lessonId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "members",
          filter: `lesson_id=eq.${lessonId}`,
        },
        refetch
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "role_assignments" },
        refetch
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reflections" },
        refetch
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_records" },
        refetch
      )
      .subscribe();

    // 폴링 보조 (Realtime 누락 대비 — 3초)
    const poll = setInterval(refetch, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLesson?.id]);

  const studentUrl =
    selectedLesson && typeof window !== "undefined"
      ? `${window.location.origin}/group?code=${selectedLesson.id}`
      : "";

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/" className="text-sm text-slate-500 hover:underline">
              ← 처음으로
            </Link>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              교사용 수업 관리
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {savedFlash && (
              <span className="rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                {savedFlash}
              </span>
            )}
            <button
              onClick={loadLessons}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              목록 새로고침
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          {/* 좌: 수업 생성 + 수업 목록 */}
          <section className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-bold">새 수업 만들기</h2>

              <Field label="수업 제목">
                <input
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>
              <Field label="주제">
                <textarea
                  className="h-20 w-full rounded-xl border border-slate-200 p-3 text-sm"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </Field>
              <Field label="학습 목표">
                <textarea
                  className="h-24 w-full rounded-xl border border-slate-200 p-3 text-sm"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                />
              </Field>

              <p className="mb-3 text-xs leading-5 text-slate-500">
                수업 생성 시 모둠 4개가 서로 다른 AI 페르소나로 자동 구성됩니다.
                생성 후 우측 모둠 구성창에서 각 모둠의 AI 동료 이름·유형을
                자유롭게 변경할 수 있어요.
              </p>

              <button
                onClick={createLesson}
                className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white hover:bg-slate-800"
              >
                수업 생성 (모둠 4개 자동)
              </button>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-bold">수업 목록</h2>
              <div className="grid gap-3">
                {lessons.length === 0 && (
                  <p className="text-sm text-slate-500">
                    아직 생성된 수업이 없습니다.
                  </p>
                )}
                {lessons.map((lesson) => (
                  <button
                    key={lesson.id}
                    onClick={() => refreshDashboard(lesson.id)}
                    className={`rounded-2xl border p-3 text-left transition ${
                      selectedLesson?.id === lesson.id
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <p className="font-bold">{lesson.title}</p>
                    <p className="mt-1 truncate text-xs text-slate-600">
                      {lesson.topic}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-slate-500">
                      {lesson.id} · 모둠 {lesson.groupCount ?? 0}개
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 우: 모둠 구성 + 입장 학생 + 활동 현황 */}
          <section className="space-y-6">
            {!selectedLesson && (
              <div className="rounded-3xl bg-white p-12 text-center shadow-sm">
                <p className="text-sm text-slate-500">
                  좌측에서 수업을 선택하거나 새로 만드세요.
                </p>
              </div>
            )}

            {selectedLesson && (
              <>
                {/* 학생 입장 안내 (한 줄) */}
                <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-indigo-50 px-4 py-3">
                  <p className="text-sm font-bold text-slate-900">
                    {selectedLesson.title}
                  </p>
                  <p className="font-mono text-xs font-bold text-indigo-900">
                    코드 · {selectedLesson.id}
                  </p>
                  <div className="ml-auto flex flex-wrap gap-1.5">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(studentUrl);
                        flash("학생 접속 링크 복사됨");
                      }}
                      className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-indigo-700 shadow-sm hover:bg-indigo-100"
                    >
                      학생 링크 복사
                    </button>
                    <button
                      onClick={regenerateCode}
                      title="현재 수업을 복제해 새 코드 발급"
                      className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50"
                    >
                      새 코드 발급
                    </button>
                    <button
                      onClick={deleteLesson}
                      title="현재 수업 전체 삭제"
                      className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-rose-700 shadow-sm hover:bg-rose-50"
                    >
                      수업 삭제
                    </button>
                  </div>
                </div>

                {/* 모둠 구성창 (한 덩어리) */}
                <div className="rounded-3xl bg-white p-6 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-xl font-bold">모둠 구성</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        학생이 코드+이름으로 입장하면 미배정 풀에 나타납니다.
                        모둠별로 다른 AI 페르소나를 설정할 수 있습니다.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={addGroup}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        + 모둠 추가
                      </button>
                      <button
                        onClick={autoAssignAll}
                        disabled={
                          unassigned.length === 0 || groups.length === 0
                        }
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        자동 배정 ({unassigned.length}명)
                      </button>
                    </div>
                  </div>

                  {/* 전체 입장 학생 — 미배정·배정 한 자리에서 보기 */}
                  {(() => {
                    const allMembers: Member[] = [
                      ...unassigned,
                      ...groups.flatMap((g) => g.members),
                    ];
                    return (
                      <div className="mb-5 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-3">
                        <p className="mb-2 text-xs font-bold text-amber-900">
                          전체 입장 학생 ({allMembers.length}명) · 미배정{" "}
                          {unassigned.length}명
                        </p>
                        {allMembers.length === 0 ? (
                          <p className="text-xs text-amber-700">
                            아직 입장한 학생이 없습니다. 학생이 코드+이름으로
                            입장하면 여기에 실시간으로 추가됩니다.
                          </p>
                        ) : (
                          <ul className="flex flex-wrap gap-2">
                            {allMembers.map((m) => {
                              const currentGroup = m.group_id
                                ? groups.find((g) => g.id === m.group_id)
                                : null;
                              return (
                                <li
                                  key={m.id}
                                  className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 shadow-sm"
                                >
                                  <button
                                    onClick={() => setViewingStudent(m)}
                                    title="제출물 보기"
                                    className="text-sm font-semibold text-slate-900 hover:text-indigo-600 hover:underline"
                                  >
                                    {m.student_name}
                                  </button>
                                  <span
                                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                                      currentGroup
                                        ? "bg-indigo-100 text-indigo-700"
                                        : "bg-amber-200 text-amber-900"
                                    }`}
                                  >
                                    {currentGroup ? currentGroup.name : "미배정"}
                                  </span>
                                  <select
                                    className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                                    value={m.group_id || ""}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      if (v === "") {
                                        unassignMember(m.id);
                                      } else if (v !== m.group_id) {
                                        assignMember(m.id, v);
                                      }
                                    }}
                                  >
                                    <option value="">미배정</option>
                                    {groups.map((g) => {
                                      const full =
                                        g.members.length >= g.capacity &&
                                        g.id !== m.group_id;
                                      return (
                                        <option
                                          key={g.id}
                                          value={g.id}
                                          disabled={full}
                                        >
                                          {g.name} ({g.members.length}/
                                          {g.capacity}
                                          {full ? " · 가득" : ""})
                                        </option>
                                      );
                                    })}
                                  </select>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })()}

                  {/* 모둠 카드 */}
                  {groups.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      모둠이 없습니다. "+모둠 추가" 로 시작하세요.
                    </p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {groups.map((g) => (
                        <GroupCard
                          key={g.id}
                          group={g}
                          onUpdate={(patch) => updateGroup(g.id, patch)}
                          onDelete={() => deleteGroup(g.id)}
                          onUnassign={unassignMember}
                          onViewStudent={(m) => setViewingStudent(m)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* 학생 제출물 모달 */}
      {viewingStudent && (
        <StudentSubmissionsModal
          member={viewingStudent}
          group={
            viewingStudent.group_id
              ? groups.find((g) => g.id === viewingStudent.group_id) || null
              : null
          }
          activity={
            activityRecords.find(
              (r) =>
                r.group_id === viewingStudent.group_id &&
                r.student_name === viewingStudent.student_name
            ) || null
          }
          reflection={
            reflections.find(
              (r) =>
                r.group_id === viewingStudent.group_id &&
                r.student_name === viewingStudent.student_name
            ) || null
          }
          onClose={() => setViewingStudent(null)}
        />
      )}
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

function GroupCard({
  group,
  onUpdate,
  onDelete,
  onUnassign,
  onViewStudent,
}: {
  group: GroupView;
  onUpdate: (patch: {
    name?: string;
    capacity?: number;
    personaName?: string;
    personaType?: string;
  }) => void;
  onDelete: () => void;
  onUnassign: (memberId: string) => void;
  onViewStudent: (member: Member) => void;
}) {
  const [name, setName] = useState(group.name);
  const [capacity, setCapacity] = useState(group.capacity);
  const [personaName, setPersonaName] = useState(group.persona_name || "");
  const [personaType, setPersonaType] = useState(
    group.persona_type || "language"
  );

  useEffect(() => {
    setName(group.name);
    setCapacity(group.capacity);
    setPersonaName(group.persona_name || "");
    setPersonaType(group.persona_type || "language");
  }, [
    group.name,
    group.capacity,
    group.persona_name,
    group.persona_type,
  ]);

  const full = group.members.length >= group.capacity;

  return (
    <article className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
      {/* 헤더: 이름 + 인원 + 삭제 */}
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== group.name && onUpdate({ name })}
        />
        <span
          className={`text-[11px] ${
            full ? "font-bold text-rose-600" : "text-slate-500"
          }`}
        >
          {group.members.length}/{group.capacity}
        </span>
        <button
          onClick={onDelete}
          title="모둠 삭제"
          className="rounded-md px-1.5 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600"
        >
          삭제
        </button>
      </div>

      {/* 정원 + AI 동료 */}
      <div className="grid grid-cols-[64px_1fr_104px] gap-2">
        <input
          type="number"
          min={1}
          max={5}
          title="정원"
          className="rounded-md border border-slate-200 px-2 py-1.5 text-xs"
          value={capacity}
          onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 4)}
          onBlur={() =>
            capacity !== group.capacity && onUpdate({ capacity })
          }
        />
        <input
          placeholder="AI 동료 이름 (예: 민하)"
          className="rounded-md border border-slate-200 px-2 py-1.5 text-xs"
          value={personaName}
          onChange={(e) => setPersonaName(e.target.value)}
          onBlur={() =>
            personaName !== (group.persona_name || "") &&
            personaName.trim() &&
            onUpdate({ personaName })
          }
        />
        <select
          title="페르소나 유형"
          className="rounded-md border border-slate-200 px-2 py-1.5 text-xs"
          value={personaType}
          onChange={(e) => {
            const v = e.target.value;
            setPersonaType(v as GroupView["persona_type"]);
            if (v !== group.persona_type) onUpdate({ personaType: v });
          }}
        >
          <option value="language">언어 적응형</option>
          <option value="culture">문화 오해형</option>
          <option value="belonging">소속감 고민형</option>
        </select>
      </div>

      {/* 학생 */}
      <div>
        {group.members.length === 0 ? (
          <p className="rounded-md bg-slate-50 px-2 py-1.5 text-[11px] text-slate-400">
            아직 배정된 학생이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1">
            {group.members.map((m) => {
              const role = group.roles.find(
                (r) => r.student_name === m.student_name
              );
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px]"
                >
                  <button
                    onClick={() => onViewStudent(m)}
                    title="제출물 보기"
                    className="font-semibold hover:text-indigo-600 hover:underline"
                  >
                    {m.student_name}
                  </button>
                  {role && (
                    <span className="text-slate-500">— {role.role_name}</span>
                  )}
                  <button
                    onClick={() => onUnassign(m.id)}
                    title="배정 해제"
                    className="ml-0.5 rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-[10px] text-slate-400">
        활동 기록 {group.activityCount}명 · 성찰문 {group.reflectionCount}명
      </p>
    </article>
  );
}

function StudentSubmissionsModal({
  member,
  group,
  activity,
  reflection,
  onClose,
}: {
  member: Member;
  group: Group | null;
  activity: ActivityRecord | null;
  reflection: Reflection | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold text-indigo-600">
              {group ? group.name : "미배정"} · 학생 제출물
            </p>
            <h2 className="text-xl font-bold text-slate-900">
              {member.student_name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold hover:bg-slate-200"
          >
            닫기
          </button>
        </div>

        {/* 내용 */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* 활동 기록 */}
          <section>
            <h3 className="mb-2 text-sm font-bold text-slate-900">
              활동 기록
              {activity && (
                <span className="ml-2 text-xs font-normal text-slate-500">
                  마지막 저장 {new Date(activity.updated_at).toLocaleString("ko-KR")}
                </span>
              )}
            </h3>
            {!activity ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">
                아직 제출되지 않았습니다.
              </p>
            ) : (
              <div className="space-y-2">
                <SubmissionField
                  label="AI 동료가 필요로 한 도움"
                  value={activity.ai_needs}
                />
                <SubmissionField
                  label="AI 동료가 기여할 수 있는 강점"
                  value={activity.ai_strengths}
                />
                <SubmissionField
                  label="우리 모둠의 해결안"
                  value={activity.group_solution}
                />
                <SubmissionField
                  label="AI 동료에게 받은 피드백"
                  value={activity.ai_feedback}
                />
                <SubmissionField
                  label="최종 수정 내용"
                  value={activity.final_revision}
                />
              </div>
            )}
          </section>

          {/* 성찰문 */}
          <section>
            <h3 className="mb-2 text-sm font-bold text-slate-900">
              성찰문
              {reflection && (
                <span className="ml-2 text-xs font-normal text-slate-500">
                  마지막 저장 {new Date(reflection.updated_at).toLocaleString("ko-KR")}
                </span>
              )}
            </h3>
            {!reflection ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">
                아직 제출되지 않았습니다.
              </p>
            ) : (
              <div className="space-y-2">
                {reflectionQuestions.map((q, idx) => (
                  <SubmissionField
                    key={q}
                    label={`${idx + 1}. ${q}`}
                    value={reflection.answers[idx] || ""}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SubmissionField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-slate-700">{label}</p>
      <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800">
        {value || (
          <span className="text-slate-400">— 빈 칸 —</span>
        )}
      </p>
    </div>
  );
}
