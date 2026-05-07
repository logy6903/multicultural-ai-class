export type PersonaType = "language" | "culture" | "belonging";

export type Lesson = {
  id: string;
  title: string;
  topic: string;
  objective: string;
  persona_type: PersonaType;
  persona_name: string;
  created_at: string;
};

export type Group = {
  id: string;
  lesson_id: string;
  name: string;
  capacity: number;
  position: number;
  persona_type: PersonaType;
  persona_name: string;
  created_at: string;
};

export type Member = {
  id: string;
  group_id: string;
  student_name: string;
  joined_at: string;
};

export type Message = {
  id: string;
  group_id: string;
  role: "user" | "assistant";
  sender_name: string | null;
  content: string;
  created_at: string;
};

export type RoleAssignment = {
  id: string;
  group_id: string;
  student_name: string;
  role_name: string;
  memo: string;
  updated_at: string;
};

export type ActivityRecord = {
  id: string;
  group_id: string;
  student_name: string;
  ai_needs: string;
  ai_strengths: string;
  group_solution: string;
  ai_feedback: string;
  final_revision: string;
  updated_at: string;
};

export type Reflection = {
  id: string;
  group_id: string;
  student_name: string;
  answers: string[];
  updated_at: string;
};
