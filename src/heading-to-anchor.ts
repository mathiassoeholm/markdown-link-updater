export function headingToAnchor(heading: string) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\- ]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/\-+$/, "");
}
