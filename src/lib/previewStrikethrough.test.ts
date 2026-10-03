import { describe, expect, it } from "vitest";
import { toggleStrikethroughInContent } from "./previewStrikethrough";

describe("toggleStrikethroughInContent", () => {
  it.each([
    ["antes texto depois", "texto", "antes ~~texto~~ depois"],
    ["antes ~~texto~~ depois", "texto", "antes texto depois"],
    ["~~um dois tres~~", "dois", "~~um~~ dois ~~tres~~"],
    ["texto", "ausente", null],
    ["texto", "   ", null],
  ])("alterna a seleção de %s", (content, selection, expected) => {
    expect(toggleStrikethroughInContent(content, selection)).toBe(expected);
  });
});
