function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/\{#[^}]+}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeImageSrc(src: string) {
  if (src.startsWith("./assets/")) {
    return `/blog-assets/${src.replace("./assets/", "")}`;
  }
  if (src.startsWith("assets/")) {
    return `/blog-assets/${src.replace("assets/", "")}`;
  }
  return src;
}

function inline(value: string) {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\[([^\]]+)]\(([^)]+)\)/g, (_match, label, href) => {
    const url = escapeHtml(href);
    const external = /^https?:\/\//.test(href);
    return `<a href="${url}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return html;
}

function renderTable(lines: string[]) {
  const rows = lines
    .filter((line) => !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line))
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => inline(cell.trim()))
    );
  if (!rows.length) return "";
  const [head, ...body] = rows;
  return `<div class="md-table-wrap"><table><thead><tr>${head
    .map((cell) => `<th>${cell}</th>`)
    .join("")}</tr></thead><tbody>${body
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

export function markdownToHtml(markdown: string) {
  const rawLines = markdown.split(/\r?\n/);
  const lines = rawLines.filter((line) => {
    const trimmed = line.trim();
    return (
      trimmed !== "---" &&
      !/^\*\*(Meta Title|Meta Description|Primary keyword|Secondary keywords):\*\*/i.test(trimmed)
    );
  });

  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    const image = trimmed.match(/^!\[([^\]]*)]\(([^)]+)\)$/);
    if (image) {
      html.push(
        `<figure><img src="${escapeHtml(normalizeImageSrc(image[2]))}" alt="${escapeHtml(
          image[1]
        )}" loading="lazy" /></figure>`
      );
      i += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length, 4);
      const text = heading[2].replace(/\s*\{#[^}]+}\s*$/, "");
      const explicit = heading[2].match(/\{#([^}]+)}/)?.[1];
      const id = explicit || slugify(text);
      html.push(`<h${level} id="${escapeHtml(id)}">${inline(text)}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^\|.+\|$/.test(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) {
        tableLines.push(lines[i]);
        i += 1;
      }
      html.push(renderTable(tableLines));
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quote.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      html.push(`<blockquote>${quote.map(inline).join("<br />")}</blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i += 1;
      }
      html.push(`<ul>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      html.push(`<ol>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ol>`);
      continue;
    }

    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !/^!\[/.test(lines[i].trim()) &&
      !/^\|.+\|$/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^>\s?/.test(lines[i].trim())
    ) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    // Unsupported or malformed Markdown must still advance the cursor. Without
    // this guard, a line such as a broken image declaration loops forever.
    if (!paragraph.length) {
      html.push(`<p>${inline(trimmed)}</p>`);
      i += 1;
      continue;
    }
    html.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }

  return html.join("\n");
}
