import { describe, expect, it } from "vitest";
import { findRuleGroup, mapCategories } from "../src/firefly/main-groups";
import type { WireRule, WireRuleGroup } from "../src/firefly/wire";

interface Part {
  type: string;
  value: string;
  active?: boolean;
}

function rule(order: number, triggers: Part[], actions: Part[], active = true): WireRule {
  const parts = (xs: Part[]) => xs.map((x) => ({ type: x.type, value: x.value, active: x.active ?? true }));
  return {
    id: String(order),
    attributes: { title: `Rule ${order}`, order, active, triggers: parts(triggers), actions: parts(actions) },
  };
}

const category = (value: string, active = true) => ({ type: "category_is", value, active });
const tag = (value: string, active = true) => ({ type: "add_tag", value, active });

function group(id: string, title: string, active = true): WireRuleGroup {
  return { id, attributes: { title, order: Number(id), active } };
}

describe("mapCategories", () => {
  it("maps category_is to add_tag in rule order, the later rule winning", () => {
    const rules = [
      rule(2, [category("Streaming")], [tag("Abonnementer")]),
      rule(1, [category("Streaming"), category("Café")], [tag("Fritid")]),
    ];
    const { mapping, conflicts } = mapCategories(rules);
    expect(mapping.get("Streaming")).toBe("Abonnementer");
    expect(mapping.get("Café")).toBe("Fritid");
    expect(conflicts).toEqual(["Streaming"]);
  });

  it("names a conflict once and not a category mapped twice to the same main group", () => {
    const rules = [
      rule(1, [category("Streaming")], [tag("Fritid")]),
      rule(2, [category("Streaming")], [tag("Abonnementer")]),
      rule(3, [category("Streaming")], [tag("Fritid")]),
      rule(4, [category("Café")], [tag("Mad")]),
      rule(5, [category("Café")], [tag("Mad")]),
    ];
    const { mapping, conflicts } = mapCategories(rules);
    expect(mapping.get("Streaming")).toBe("Fritid");
    expect(conflicts).toEqual(["Streaming"]);
  });

  it("ignores inactive rules, triggers and actions and other kinds", () => {
    const rules = [
      rule(1, [category("Gaver")], [tag("Fritid")], false),
      rule(2, [category("Café", false), category("Husleje")], [tag("Bolig")]),
      rule(3, [category("Tandlæge")], [tag("Fritid", false), tag("Sundhed")]),
      rule(4, [{ type: "description_contains", value: "Netto" }], [tag("Mad")]),
      rule(5, [category("Brændstof")], [{ type: "set_category", value: "Bil" }]),
    ];
    const { mapping, conflicts } = mapCategories(rules);
    expect([...mapping]).toEqual([
      ["Husleje", "Bolig"],
      ["Tandlæge", "Sundhed"],
    ]);
    expect(conflicts).toEqual([]);
  });
});

describe("mapCategories' tags", () => {
  it("lists every tag an active rule adds, also a conflict's losing tag", () => {
    const rules = [
      rule(1, [category("Streaming")], [tag("Fritid")]),
      rule(2, [category("Streaming")], [tag("Abonnementer")]),
      rule(3, [{ type: "description_contains", value: "Netto" }], [tag("Mad")]),
      rule(4, [category("Gaver")], [tag("Gaveudgifter")], false),
      rule(5, [category("Tandlæge")], [tag("Tand", false), tag("Sundhed")]),
    ];
    expect([...mapCategories(rules).tags].sort()).toEqual(["Abonnementer", "Fritid", "Mad", "Sundhed"]);
  });
});

describe("findRuleGroup", () => {
  it("finds the rule group by its exact title, active or not", () => {
    const groups = [group("1", "Andet"), group("2", "Hovedgrupper", false)];
    expect(findRuleGroup(groups, "hovedgrupper")).toBeNull();
    expect(findRuleGroup(groups, "Hovedgrupper ")).toBeNull();
    expect(findRuleGroup(groups, "Hovedgrupper")?.id).toBe("2");
  });
});
