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

export function partySupportOverview(pctMatrix, popMatrix, limit = 3) {
  if (!popMatrix?.values?.length || !popMatrix?.classes?.length || !popMatrix?.parties?.length) return [];

  return popMatrix.parties.map((party, pi) => {
    const rows = popMatrix.classes
      .map((className, ci) => {
        const capturedPop = finiteNumber(popMatrix.values?.[ci]?.[pi]);
        const classCapturePct = finiteNumber(pctMatrix?.values?.[ci]?.[pi]);
        return { className, capturedPop, classCapturePct };
      })
      .filter((row) => row.className && row.capturedPop != null && row.capturedPop > 0);

    const totalCapturedPop = rows.reduce((total, row) => total + row.capturedPop, 0);
    const topClasses = rows
      .map((row) => ({
        ...row,
        partySharePct: totalCapturedPop > 0 ? row.capturedPop / totalCapturedPop : null,
      }))
      .sort((a, b) => b.capturedPop - a.capturedPop)
      .slice(0, limit);

    return { party, totalCapturedPop, topClasses };
  });
}
