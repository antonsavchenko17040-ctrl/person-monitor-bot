export function quoteQuery(value) {
  return `"${String(value ?? "").replaceAll('"', "").trim()}"`;
}

export function subjectNames(subject) {
  return [subject.full_name, ...(subject.aliases ?? [])]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
}

export function buildNameQuery(subject) {
  const names = subjectNames(subject).map(quoteQuery);
  if (!names.length) return "";
  return names.length === 1 ? names[0] : `(${names.join(" OR ")})`;
}

export function buildContextQuery(subject) {
  const context = [subject.organization, subject.position, subject.city]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .slice(0, 2)
    .map(quoteQuery);
  return context.join(" OR ");
}
