function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function classCompatPopMatrix(matrix, classes = []) {
  if (!matrix?.values?.length || !matrix?.classes?.length) return null;

  const popsByClass = new Map(
    classes
      .map((c) => [c?.name, finiteNumber(c?.pop)])
      .filter(([name, pop]) => name && pop != null),
  );

  return {
    parties: matrix.parties ?? [],
    classes: matrix.classes,
    values: matrix.values.map((row) =>
      matrix.classes.map((className, ci) => {
        const compat = finiteNumber(row?.[ci]);
        const pop = popsByClass.get(className);
        if (compat == null || pop == null) return null;
        return Math.round(compat * pop);
      }),
    ),
  };
}
