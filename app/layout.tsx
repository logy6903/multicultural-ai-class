import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 다문화 동료 협력학습",
  description:
    "교사가 다문화 주제 수업을 만들면, 학생 모둠은 AI 다문화 동료와 대화하며 필요와 강점을 파악하고 협력하는 수업용 웹앱입니다.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
