import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PackageUploader } from "./PackageUploader";
import type { UploadItem } from "@/hooks/usePackageUpload";

const item = (key: string, p: Partial<UploadItem> = {}): UploadItem => ({
  key, file: new File(["x"], `${key}.pdf`), role: "doc", status: "done", progress: 100, retryable: true, ...p,
});

describe("PackageUploader", () => {
  it("показывает статусы и итог загрузки", () => {
    render(<PackageUploader
      items={[item("a"), item("b", { status: "uploading", progress: 40 }), item("c", { status: "error", error: "Сеть недоступна" })]}
      onAdd={vi.fn()} onRemove={vi.fn()} onRetry={vi.fn()} />);
    expect(screen.getByText(/40%/)).toBeInTheDocument();
    expect(screen.getByText("Сеть недоступна")).toBeInTheDocument();
    expect(screen.getByText(/Загружено 1 из 3/)).toBeInTheDocument();
  });

  it("повтор — только у файла с ошибкой загрузки; убрать — у любого", () => {
    const onRetry = vi.fn();
    const onRemove = vi.fn();
    render(<PackageUploader
      items={[item("a"), item("c", { status: "error", error: "Сеть" }), item("d", { status: "error", error: "Файл больше 50 МБ", retryable: false })]}
      onAdd={vi.fn()} onRemove={onRemove} onRetry={onRetry} />);
    expect(screen.getAllByRole("button", { name: /Повторить загрузку/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку: c.pdf" }));
    expect(onRetry).toHaveBeenCalledWith("c");
    fireEvent.click(screen.getByRole("button", { name: "Убрать: a.pdf" }));
    expect(onRemove).toHaveBeenCalledWith("a");
  });

  it("выбранные файлы передаются в onAdd", () => {
    const onAdd = vi.fn();
    const { container } = render(<PackageUploader items={[]} onAdd={onAdd} onRemove={vi.fn()} onRetry={vi.fn()} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const f = new File(["x"], "ТЗ.pdf");
    fireEvent.change(input, { target: { files: [f] } });
    expect(onAdd).toHaveBeenCalledWith([f]);
  });
});
