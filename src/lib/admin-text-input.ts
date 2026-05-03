import type { ClipboardEvent } from "react";
import {
  countReplacementCharacters,
  repairLikelyMojibake,
} from "@/lib/text-encoding-repair";

function getPlainTextFromHtml(html: string): string {
  if (typeof document === "undefined") {
    return "";
  }

  const template = document.createElement("template");
  template.innerHTML = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n");

  return template.content.textContent?.replace(/\n{3,}/g, "\n\n").trim() ?? "";
}

function chooseBestClipboardText(plainText: string, htmlText: string): string {
  const repairedPlain = repairLikelyMojibake(plainText);
  if (!htmlText) {
    return repairedPlain;
  }

  const plainReplacementCount = countReplacementCharacters(repairedPlain);
  if (plainReplacementCount === 0) {
    return repairedPlain;
  }

  const repairedHtmlText = repairLikelyMojibake(getPlainTextFromHtml(htmlText));
  const htmlReplacementCount = countReplacementCharacters(repairedHtmlText);
  return htmlReplacementCount < plainReplacementCount ? repairedHtmlText : repairedPlain;
}

export function handleAdminTextPaste(
  event: ClipboardEvent<HTMLElement>,
  onRejectedText: (replacementCount: number) => void,
): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return;
  }

  const plainText = event.clipboardData.getData("text/plain");
  if (!plainText) {
    return;
  }

  const nextText = chooseBestClipboardText(
    plainText,
    event.clipboardData.getData("text/html"),
  );
  const replacementCount = countReplacementCharacters(nextText);
  if (replacementCount > 0) {
    event.preventDefault();
    onRejectedText(replacementCount);
    return;
  }

  if (nextText === plainText) {
    return;
  }

  event.preventDefault();
  const selectionStart = target.selectionStart ?? target.value.length;
  const selectionEnd = target.selectionEnd ?? target.value.length;
  target.setRangeText(nextText, selectionStart, selectionEnd, "end");
  target.dispatchEvent(new Event("input", { bubbles: true }));
}
