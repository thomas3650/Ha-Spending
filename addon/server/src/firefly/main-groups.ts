import type { WireRule, WireRuleGroup } from "./wire";

export function findRuleGroup(groups: WireRuleGroup[], title: string): WireRuleGroup | null {
  return groups.find((g) => g.attributes.title === title) ?? null;
}

/**
 * Category name → main group, as Firefly III's rules would tag them: in rule order, the later rule winning. `tags` is
 * every tag an active rule adds, also the losing tag of a conflict.
 */
export function mapCategories(rules: WireRule[]): {
  mapping: Map<string, string>;
  conflicts: string[];
  tags: Set<string>;
} {
  const mapping = new Map<string, string>();
  const conflicts: string[] = [];
  const added = new Set<string>();
  const ordered = [...rules].sort((a, b) => a.attributes.order - b.attributes.order);
  for (const rule of ordered) {
    if (!rule.attributes.active) continue;
    const categories = rule.attributes.triggers.filter((t) => t.active && t.type === "category_is");
    const tags = rule.attributes.actions.filter((a) => a.active && a.type === "add_tag");
    for (const { value } of tags) added.add(value);
    for (const { value: category } of categories) {
      for (const { value: tag } of tags) {
        const before = mapping.get(category);
        if (before !== undefined && before !== tag && !conflicts.includes(category)) conflicts.push(category);
        mapping.set(category, tag);
      }
    }
  }
  return { mapping, conflicts, tags: added };
}
