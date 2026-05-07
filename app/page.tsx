import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <section className="mx-auto max-w-4xl rounded-3xl bg-white p-10 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-indigo-600">
          AI 다문화 동료 기반 협력학습 MVP
        </p>

        <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900">
          AI 다문화 동료와 함께하는 모둠활동 앱
        </h1>

        <p className="mb-8 text-lg leading-8 text-slate-700">
          교사가 다문화 주제 수업을 만들면, 학생 모둠은 AI 다문화 동료와
          대화하며 필요와 강점을 파악하고, 역할을 나누어 공동 산출물을
          완성합니다.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/teacher"
            className="rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white transition hover:bg-slate-800"
          >
            <h2 className="mb-2 text-xl font-bold">교사용 화면</h2>
            <p className="text-sm text-slate-300">
              수업을 생성하고 모둠 활동 결과를 확인합니다.
            </p>
          </Link>

          <Link
            href="/group"
            className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 transition hover:bg-slate-50"
          >
            <h2 className="mb-2 text-xl font-bold">학생 모둠 화면</h2>
            <p className="text-sm text-slate-600">
              수업 코드를 입력하고 AI 다문화 동료와 활동합니다.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
