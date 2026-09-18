export interface ToastMessage {
  id: number;
  text: string;
  tone: "info" | "success" | "danger";
}

export function Toasts({ toasts }: { toasts: ToastMessage[] }) {
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
