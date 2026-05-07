"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
};

type Member = {
  id: string;
  group_id: string;
  student_name: string;
};

type Role = {
  group_id: string;
  student_name: string;
  role_name: string;
};

type GroupView = Group & {
  members: Member[];
  roles: Role[];
  reflectionCount: number;
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

  const [title, setTitle] = useState("AI 다문화 동료와 함께하는 모둠활동");
  const [topic, setTopic] = useState("모두가 참여할 수 있는 학교 축제 만들기");
  const [objective, setObjective] = useState(
    "AI 다문화 동료의 필요와 강점을 파악하고 포용적인 협력 방안을 설계한다."
  );
  const [personaName, setPersonaName] = useState("민하");
  const [personaType, setPersonaType] = useState("language");

  const [error, setError] = useState("");

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
        personaName,
        personaType,
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
    patch: { name?: string; capacity?: number }
  ) {
    try {
      await api("updateGroup", { groupId, ...patch });
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

  useEffect(() => {
    loadLessons();
  }, []);

  // 30초 폴링으로 학생 활동 현황 갱신
  useEffect(() => {
    if (!selectedLesson) return;
    const id = setInterval(() => {
      refreshDashboard(selectedLesson.id);
    }, 30000);
    return () => clearInterval(id);
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
          <button
            onClick={loadLessons}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          >
            목록 새로고침
          </button>
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

              <div className="grid grid-cols-2 gap-3">
                <Field label="AI 동료 이름">
                  <input
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm"
                    value={personaName}
                    onChange={(e) => setPersonaName(e.target.value)}
                  />
                </Field>
                <Field label="페르소나 유형">
                  <select
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm"
                    value={personaType}
                    onChange={(e) => setPersonaType(e.target.value)}
                  >
                    <option value="language">언어 적응형</option>
                    <option value="culture">문화 오해형</option>
                    <option value="belonging">소속감 고민형</option>
                  </select>
                </Field>
              </div>

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

          {/* 우: 모둠 구성 + 활동 현황 */}
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
                <div className="rounded-3xl bg-indigo-50 p-6">
                  <p className="mb-2 text-xs font-semibold text-indigo-600">
                    학생 입장 안내
                  </p>
                  <h2 className="mb-3 text-2xl font-bold text-slate-900">
                    {selectedLesson.title}
                  </h2>
                  <div className="grid gap-3 text-sm md:grid-cols-2">
                    <div>
                      <p className="text-xs text-indigo-700">수업 코드</p>
                      <p className="font-mono text-base font-bold text-indigo-900">
                        {selectedLesson.id}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-indigo-700">학생 접속 주소</p>
                      <p className="break-all text-indigo-900">{studentUrl}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold">모둠 구성</h2>
                    <button
                      onClick={addGroup}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      + 모둠 추가
                    </button>
                  </div>

                  {groups.length === 0 && (
                    <p className="text-sm text-slate-500">
                      모둠이 없습니다. "+모둠 추가" 로 시작하세요.
                    </p>
                  )}

                  <div className="space-y-2">
                    {groups.map((g) => (
                      <GroupRow
                        key={g.id}
                        group={g}
                        onUpdate={(patch) => updateGroup(g.id, patch)}
                        onDelete={() => deleteGroup(g.id)}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold">모둠 활동 현황</h2>
                    <button
                      onClick={() => refreshDashboard(selectedLesson.id)}
                      className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold hover:bg-slate-200"
                    >
                      새로고침
                    </button>
                  </div>

                  {groups.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      모둠이 없습니다.
                    </p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {groups.map((g) => (
                        <article
                          key={g.id}
                          className="rounded-2xl border border-slate-200 p-4"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <h3 className="font-bold">{g.name}</h3>
                            <span className="text-xs text-slate-500">
                              {g.members.length}/{g.capacity}명
                            </span>
                          </div>

                          <p className="mb-1 text-xs font-bold text-slate-700">
                            입장 학생
                          </p>
                          {g.members.length === 0 ? (
                            <p className="mb-2 text-xs text-slate-400">없음</p>
                          ) : (
                            <ul className="mb-2 list-inside list-disc text-xs text-slate-700">
                              {g.members.map((m) => {
                                const role = g.roles.find(
                                  (r) => r.student_name === m.student_name
                                );
                                return (
                                  <li key={m.id}>
                                    {m.student_name}
                                    {role ? ` — ${role.role_name}` : ""}
                                  </li>
                                );
                              })}
                            </ul>
                          )}

                          <p className="text-xs text-slate-600">
                            성찰문 제출 {g.reflectionCount}명
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
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

function GroupRow({
  group,
  onUpdate,
  onDelete,
}: {
  group: GroupView;
  onUpdate: (patch: { name?: string; capacity?: number }) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [capacity, setCapacity] = useState(group.capacity);

  useEffect(() => {
    setName(group.name);
    setCapacity(group.capacity);
  }, [group.name, group.capacity]);

  return (
    <div className="grid items-center gap-2 rounded-xl border border-slate-200 p-2 md:grid-cols-[1fr_120px_auto_auto]">
      <input
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== group.name && onUpdate({ name })}
      />
      <input
        type="number"
        min={1}
        max={12}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        value={capacity}
        onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 4)}
        onBlur={() =>
          capacity !== group.capacity && onUpdate({ capacity })
        }
      />
      <span className="text-xs text-slate-500">
        {group.members.length}/{group.capacity}명
      </span>
      <button
        onClick={onDelete}
        className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
      >
        삭제
      </button>
    </div>
  );
}
