import { expect, it } from "vitest";
import { getContentIssues } from "./contentValidation";

it("内容定义与引用一致", () => {
  expect(getContentIssues()).toEqual([]);
});