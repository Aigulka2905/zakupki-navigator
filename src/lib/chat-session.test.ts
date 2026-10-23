import { describe, it, expect } from "vitest";
import { sessionTitle } from "./chat-session";

// Диалоги в «Истории» и в боковой панели чата были подписаны началом ответа ассистента.
describe("sessionTitle", () => {
  it("первый вопрос пользователя", () => {
    expect(sessionTitle({ title: "Какие сроки подачи заявок?", lastMessage: "Согласно ч. 3 ст. 42…" })).toBe("Какие сроки подачи заявок?");
  });
  it("вопроса нет — последнее сообщение", () => {
    expect(sessionTitle({ title: null, lastMessage: "Здравствуйте!" })).toBe("Здравствуйте!");
  });
  it("старый сервер без title — последнее сообщение", () => {
    expect(sessionTitle({ lastMessage: "Ответ" })).toBe("Ответ");
  });
  it("пробелы и переносы схлопываются", () => {
    expect(sessionTitle({ title: "  Как\n\nподать   заявку? ", lastMessage: "" })).toBe("Как подать заявку?");
  });
});
