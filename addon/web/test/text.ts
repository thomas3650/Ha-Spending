import { getDefaultNormalizer } from "@testing-library/dom";

/** Numbers carry Intl's no-break space, which the default normalizer would turn into a plain one. */
export const KEEP_NBSP = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) };
