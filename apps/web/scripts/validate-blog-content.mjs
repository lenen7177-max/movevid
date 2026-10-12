import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const locales = ["en", "zh", "jp"];
const collections = ["blog", "author", "category"];

function listCollectionFiles(collection, locale) {
  const dir = path.join(projectRoot, "content", collection, locale);
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".mdx"))
    .sort();
}

function listCollectionSlugs(collection, locale) {
  return listCollectionFiles(collection, locale).map((file) => file.replace(/\.mdx$/, ""));
}

function parseFrontmatter(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const frontmatterMatch = source.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatterMatch) {
    throw new Error(`Missing frontmatter in ${filePath}`);
  }

  const data = {};
  const lines = frontmatterMatch[1].split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (rawValue === "true" || rawValue === "false") {
      data[key] = rawValue === "true";
      continue;
    }

    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      try {
        data[key] = JSON.parse(rawValue);
        continue;
      } catch {
        data[key] = rawValue;
        continue;
      }
    }

    if (
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    ) {
      data[key] = rawValue.slice(1, -1);
      continue;
    }

    data[key] = rawValue;
  }

  return data;
}

function diffSet(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

const errors = [];

for (const collection of collections) {
  const baseline = listCollectionSlugs(collection, locales[0]);

  for (const locale of locales.slice(1)) {
    const current = listCollectionSlugs(collection, locale);
    const missingInLocale = diffSet(baseline, current);
    const extraInLocale = diffSet(current, baseline);

    if (missingInLocale.length > 0) {
      errors.push(`[${collection}] ${locale} missing slugs: ${missingInLocale.join(", ")}`);
    }

    if (extraInLocale.length > 0) {
      errors.push(`[${collection}] ${locale} has extra slugs: ${extraInLocale.join(", ")}`);
    }
  }
}

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

for (const locale of locales) {
  const authorSlugs = new Set(listCollectionSlugs("author", locale));
  const categorySlugs = new Set(listCollectionSlugs("category", locale));
  const blogFiles = listCollectionFiles("blog", locale);

  for (const file of blogFiles) {
    const filePath = path.join(projectRoot, "content", "blog", locale, file);
    const frontmatter = parseFrontmatter(filePath);
    const slug = file.replace(/\.mdx$/, "");

    const requiredFields = ["title", "date", "author", "categories"];
    for (const field of requiredFields) {
      if (!(field in frontmatter)) {
        errors.push(`[blog] ${locale}/${slug} missing required field: ${field}`);
      }
    }

    if (typeof frontmatter.date !== "string" || !dateRegex.test(frontmatter.date)) {
      errors.push(`[blog] ${locale}/${slug} has invalid date format: ${String(frontmatter.date)}`);
    }

    if (typeof frontmatter.author !== "string" || !authorSlugs.has(frontmatter.author)) {
      errors.push(
        `[blog] ${locale}/${slug} references unknown author: ${String(frontmatter.author)}`,
      );
    }

    if (!Array.isArray(frontmatter.categories) || frontmatter.categories.length === 0) {
      errors.push(`[blog] ${locale}/${slug} must define non-empty categories`);
    } else {
      for (const category of frontmatter.categories) {
        if (typeof category !== "string" || !categorySlugs.has(category)) {
          errors.push(`[blog] ${locale}/${slug} references unknown category: ${String(category)}`);
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error("Blog content validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Blog content validation passed.");
